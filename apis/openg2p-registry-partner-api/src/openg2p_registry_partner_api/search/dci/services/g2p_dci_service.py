import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from openg2p_registry_core.helpers import TemplateHelper
from openg2p_fastapi_common.service import BaseService
from openg2p_fastapi_common.context import get_async_session_maker

from sqlalchemy import select

from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException
from openg2p_registry_core.models import G2PRegisterDefinition, DataModel, OutgoingTemplate, G2PRegistryDocument
from openg2p_registry_core.search import PartnerRegisterSearch

from ..schemas import (
    DciSearchResponseItem,
    DciRequestHeader,
    DciSearchRequest,
    DciSearchResultData,
    DciSearchResultPagination,
    DciSearchStatusReasonCode,
    DciStatusCode,
)
from ..queries import AllowedSearchFields, decode_dci_search
from ....config import Settings

_logger = logging.getLogger("g2p-dci-service")
_config = Settings.get_config()

class G2PDciService(BaseService):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    async def search(
        self,
        signature: str,
        header: DciRequestHeader,
        message: DciSearchRequest,
        consent_scopes_by_ref: Optional[Dict[str, Optional[List[str]]]] = None,
    ) -> List[DciSearchResponseItem]:
        # consent_scopes_by_ref maps reference_id -> effective_data_scopes the
        # response must be clamped to (the PEP field-level enforcement). It is
        # None when consent enforcement is disabled (return all fields); an
        # entry's value being None likewise means "no clamp" for that item.

        allowed = AllowedSearchFields(_config.dci_allowed_search_fields)
        searches = [
            decode_dci_search(item.search_criteria, allowed, _config.dci_id_type_columns)
            for item in message.search_request
        ]
        pages = await self._run_search(searches, allowed.as_set())

        data_model_id = await self._get_data_model_id()
        templates: Dict[str, tuple] = {}
        dci_search_response_items: List[DciSearchResponseItem] = []
        for search_request_item, page in zip(message.search_request, pages):
            search_criteria = search_request_item.search_criteria
            template_store_id, template_bucket = await self._template_for(
                search_criteria.reg_type, data_model_id, templates
            )
            reg_records = [
                self._render_reg_record_with_template(record, template_store_id, bucket=template_bucket)
                for record in page.records
            ]

            if consent_scopes_by_ref is not None:
                allowed_scopes = consent_scopes_by_ref.get(search_request_item.reference_id)
                if allowed_scopes is not None:
                    reg_records = [
                        self._clamp_record_fields(record, allowed_scopes)
                        for record in reg_records
                    ]

            dci_search_response_items.append(DciSearchResponseItem(
                reference_id=search_request_item.reference_id,
                timestamp=datetime.now().isoformat(),
                status=DciStatusCode.SUCCESS.value,
                data=DciSearchResultData(
                    reg_type=search_criteria.reg_type,
                    reg_record_type=search_criteria.reg_record_type,
                    reg_records=reg_records,
                ),
                pagination=DciSearchResultPagination(
                    page_number=page.page,
                    page_size=page.page_size,
                    total_count=page.total_count,
                ),
                locale="en",
            ))
            _logger.info(
                "Search completed for reference_id: %s, found %s items",
                search_request_item.reference_id,
                page.total_count,
            )

        _logger.info(
            "Search completed for transaction_id: %s, found %s items",
            message.transaction_id,
            len(dci_search_response_items),
        )
        return dci_search_response_items

    async def _run_search(self, searches, allowed_columns: set[str]):
        try:
            return await PartnerRegisterSearch(allowed_columns).search_batch(searches)
        except G2PRegistryException as exc:
            if exc.code == G2PRegistryErrorCodes.INVALID_REQUEST.value[1]:
                raise G2PRegistryException(
                    code=DciSearchStatusReasonCode.SEARCH_CRITERIA_INVALID.value,
                    message=exc.message,
                ) from exc
            raise

    async def _template_for(self, register_mnemonic: str, data_model_id: str, cache: Dict[str, tuple]):
        if register_mnemonic not in cache:
            register_id = await self._get_register_id(register_mnemonic)
            if not register_id:
                raise G2PRegistryException(
                    code=G2PRegistryErrorCodes.REGISTER_NOT_FOUND.value[1],
                    message=f"Register '{register_mnemonic}' was not found.",
                )
            cache[register_mnemonic] = await self._get_template_store_id(register_id, data_model_id)
        return cache[register_mnemonic]

    @staticmethod
    def _clamp_record_fields(record: Dict[str, Any], allowed_scopes: List[str]) -> Dict[str, Any]:
        """Return a copy of a rendered registry record keeping only the fields
        the Consent Manager permitted (``effective_data_scopes``).

        Scope names are matched against the record's TOP-LEVEL keys (the
        template output field names — i.e. the shared scope<->field catalog).
        Strict allow-list: any field not in the effective scopes is dropped, so
        a narrower policy or consent can only ever remove fields, never add.
        """
        if not isinstance(record, dict):
            return record
        allowed = set(allowed_scopes or [])
        return {key: value for key, value in record.items() if key in allowed}

    def _render_reg_record_with_template(
        self,
        record: Dict[str, Any],
        template_store_id: str,
        bucket=None,
    ) -> Dict[str, Any]:
        from openg2p_registry_core.models.enum import DocumentBucket

        template_helper = TemplateHelper.get_component()
        return template_helper.render_with_template(
            document_store_id=template_store_id,
            data=record,
            expand_data=False,
            bucket=bucket or DocumentBucket.TEMPLATES,
        )

    async def _get_register_id(self, register_mnemonic: str) -> str:
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            register_id: str = (
                await session.execute(
                    select(G2PRegisterDefinition.register_id)
                    .where(G2PRegisterDefinition.register_mnemonic == register_mnemonic)
                )
            ).scalar_one_or_none()
            return register_id

    async def _get_data_model_id(self) -> str:
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            data_model_id: str = (
                await session.execute(
                    select(DataModel.data_model_id)
                    .where(DataModel.data_model_mnemonic == "DCI")
                )
            ).scalar_one_or_none()
            return data_model_id

    async def _get_template_store_id(self, register_id: str, data_model_id: str) -> tuple[str, object]:
        """Resolve outgoing template document_id → (document_store_id, bucket)."""
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            result = await session.execute(
                select(
                    G2PRegistryDocument.document_store_id,
                    G2PRegistryDocument.bucket,
                )
                .join(
                    OutgoingTemplate,
                    OutgoingTemplate.template_document_id == G2PRegistryDocument.document_id,
                )
                .where(
                    OutgoingTemplate.register_id == register_id,
                    OutgoingTemplate.data_model_id == data_model_id,
                )
            )
            row = result.one_or_none()
            if not row:
                raise ValueError(
                    f"Template not found for register_id={register_id}, "
                    f"data_model_id={data_model_id}"
                )
            return row.document_store_id, row.bucket
