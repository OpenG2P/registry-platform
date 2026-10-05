import importlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, List, Dict, Any, Tuple

from openg2p_registry_core.errors import G2PRegistryException
from openg2p_registry_core.schemas import DeepSearchResultData
from openg2p_fastapi_common.service import BaseService
from openg2p_fastapi_common.context import get_async_session_maker

from sqlalchemy import JSON, cast, literal, select, func, or_, true
from sqlalchemy.dialects.postgresql import JSONB

from openg2p_registry_core.services import G2PRegisterHierarchicalService, G2PRegisterService
from openg2p_registry_core.helpers import TemplateHelper
from openg2p_registry_core.models import G2PRegisterDefinition, DataModel, OutgoingTemplate, G2PRegistryDocument
from openg2p_registry_core.models import ActivityStatusEnum, ActivityVerificationStatusEnum, RegisterPurposeEnum
from openg2p_registry_core.models import G2PActivityAggregate, G2PActivityContext
from openg2p_registry_core.services import AllowedFields, G2PActivityRegistryService, G2PDataScopeService
from openg2p_registry_core.helpers.ethiopian_calendar import format_ethiopian_date

from ..schemas import (
    DciSearchStatusReasonCode,
    DciSearchResponseItem,
    DciSearchCriteria,
    DciRequestHeader,
    DciSearchRequest,
    DciSearchResultData,
    DciSearchResultPagination,
    DciStatusCode,
)
from ..helpers import DciQueryHelper
from ..helpers.query_helper import DciQueryResult
from ....config import Settings

_logger = logging.getLogger("g2p-dci-service")
_config = Settings.get_config()

@dataclass
class ConsentScopeGrant:
    """The data scopes one search item may return, and when the consent was issued.

    ``scope_ids`` are data scope IDs (``<controller>.<name>``); ``issued_at``
    (naive UTC) picks each scope's version. None: the consent carried no issue
    time, and each scope's first version is read.
    """

    scope_ids: List[str] = field(default_factory=list)
    issued_at: Optional[datetime] = None


class G2PDciService(BaseService):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.register_service = G2PRegisterService.get_component()
        self.data_scopes = G2PDataScopeService.get_component() or G2PDataScopeService()

    async def search(
        self,
        signature: str,
        header: DciRequestHeader,
        message: DciSearchRequest,
        consent_scopes_by_ref: Optional[Dict[str, ConsentScopeGrant]] = None,
        consent_subjects_by_ref: Optional[Dict[str, str]] = None,
    ) -> List[DciSearchResponseItem]:
        # consent_scopes_by_ref maps reference_id -> the data scopes the item
        # may return (the PEP field-level enforcement). The internal records are
        # filtered to those scopes' fields BEFORE the output template renders
        # them, so a renderer never sees a field outside the consent. None when
        # consent enforcement is disabled (no filtering); an item missing from
        # it gets nothing.

        dci_search_response_items: List[DciSearchResponseItem] = []
        for search_request_item in message.search_request:
            search_criteria: DciSearchCriteria = search_request_item.search_criteria

            register_id: str = await self._get_register_id(search_criteria.reg_type)
            data_model_id: str = await self._get_data_model_id()
            template_store_id, template_bucket = await self._get_template_store_id(
                register_id, data_model_id
            )

            is_activity = await self._is_activity_register(search_criteria.reg_type)
            model_class = (
                self._get_activity_model_class(search_criteria.reg_type)
                if is_activity
                else self._get_model_class(search_criteria.reg_type)
            )

            # Consent enforcement is on when the controller passed the subjects map
            # (even an empty one); then every item either names its consented
            # subject or is an allow-listed search across subjects.
            consent_enforced = consent_subjects_by_ref is not None
            consent_subject = (consent_subjects_by_ref or {}).get(search_request_item.reference_id)
            aggregate_records = None
            search_result_data = []
            subject_id = None
            query_result = None
            is_aggregate = is_activity and _is_aggregate_request(search_criteria.reg_record_type)
            _require_consent_subject_or_bulk(consent_enforced, consent_subject, search_criteria, is_aggregate)
            allowed = await self._allowed_fields(consent_scopes_by_ref, search_request_item.reference_id)
            state_type = (
                await self._state_context_type(register_id, search_criteria.reg_record_type)
                if is_activity and not is_aggregate
                else None
            )
            if is_aggregate or state_type:
                # A subject's derived views. The query names the subject and,
                # in an expression, filters on the view's own fields (e.g. the
                # crop year and season), so one synchronous call answers
                # "what did this person sow this season".
                subject_id, filters = DciQueryHelper.parse_subject_query(
                    search_criteria, allow_missing_subject=is_aggregate
                )
                if subject_id is None and consent_subject:
                    # A consent names one person: never answer for all subjects under it.
                    raise G2PRegistryException(
                        code=DciSearchStatusReasonCode.SEARCH_CRITERIA_INVALID.value,
                        message="subject_id is required for a search under a person's consent",
                    )
                _, current_page, page_size, _ = self._get_registry_search_parameters(
                    search_criteria, parse_query=False
                )
                if is_aggregate:
                    # A subject's roll-ups (e.g. a person's season summary) rather
                    # than its activities — what an eligibility check reads.
                    aggregate_records, total_count = await self._aggregate_search(
                        search_criteria.reg_type, register_id, subject_id, filters, current_page, page_size,
                        allowed=allowed,
                    )
                else:
                    # The subject's contexts' current state (e.g. each crop season:
                    # stage, area sown, yield, verified) from the projection.
                    aggregate_records, total_count = await self._state_search(
                        search_criteria.reg_type, register_id, state_type, subject_id, filters,
                        current_page, page_size, allowed=allowed,
                    )
            else:
                if is_activity and _names_subject(search_criteria):
                    # One subject's activities, filtered on any of the activity's
                    # plain fields (type, date, verification, promoted payload fields).
                    subject_id, filters = DciQueryHelper.parse_subject_query(search_criteria)
                    _, current_page, page_size, sort_by = self._get_registry_search_parameters(
                        search_criteria, parse_query=False
                    )
                    query_result = DciQueryResult(filter_conditions=[
                        model_class.subject_id == subject_id,
                        *DciQueryHelper.translate_filters(filters, _plain_columns(model_class, exclude={"search_text"})),
                    ])
                else:
                    query_result, current_page, page_size, sort_by = self._get_registry_search_parameters(
                        search_criteria, model_class
                    )
                if is_activity:
                    search_result_data, total_count = await self._activity_search(
                        model_class, query_result, current_page, page_size, sort_by
                    )
                elif query_result.filter_conditions:
                    search_result_data, total_count = await self._expression_search(
                        register_id, model_class, query_result.filter_conditions, current_page, page_size, sort_by
                    )
                else:
                    search_result_data, total_count = await self.register_service.deep_search_in_a_register(
                        register_id=register_id,
                        search_text=query_result.search_text,
                        current_page=current_page,
                        page_size=page_size,
                        sort_by=sort_by,
                    )

            # The consent names one person: what is returned must be theirs. This
            # check runs whatever the search returned (even nothing): the searched
            # subject itself must be the consented one.
            if consent_subject:
                if is_activity:
                    searched = subject_id or (query_result.search_text if query_result else None)
                    # Raises when nothing was searched for (no subject) or it is not the consented person.
                    await self._require_subject_link(search_criteria.reg_type, searched, consent_subject)
                    # A text search can match other subjects' activities: all must be the searched one's.
                    if any(self._deep_search_result_data_to_dict(d).get("subject_id") != searched
                           for d in (search_result_data or [])):
                        raise G2PRegistryException(
                            code=DciSearchStatusReasonCode.SEARCH_CRITERIA_INVALID.value,
                            message="The consent's subject is not the person searched",
                        )
                else:
                    self._require_records_of_subject(search_result_data or [], consent_subject)

            # PEP field-level enforcement: each internal record (with its linked
            # records) is filtered to the consented scopes' fields, then rendered.
            # The consent-subject checks above ran on the unfiltered records.
            if aggregate_records is not None:
                reg_records = aggregate_records  # filtered before the register shaped them
            else:
                nested_keys = await self.data_scopes.nested_keys() if allowed is not None and not is_activity else {}
                reg_records = [
                    self._render_reg_record_with_template(
                        self._filter_record(
                            self._deep_search_result_data_to_dict(datum), allowed, search_criteria.reg_type,
                            is_activity, nested_keys,
                        ),
                        template_store_id,
                        bucket=template_bucket,
                    )
                    for datum in search_result_data
                ]

            dci_deep_search_result_data = DciSearchResultData(
                reg_type = search_criteria.reg_type,
                reg_record_type = search_criteria.reg_record_type,
                reg_records = reg_records
            )

            pagination = DciSearchResultPagination(
                page_number = current_page,
                page_size = page_size,
                total_count = total_count
            )

            dci_search_response_item = DciSearchResponseItem(
                reference_id = search_request_item.reference_id,
                timestamp = datetime.now().isoformat(),
                status = DciStatusCode.SUCCESS.value,
                data = dci_deep_search_result_data,
                pagination = pagination,
                locale="en"
            )
            dci_search_response_items.append(dci_search_response_item)

            _logger.info(f"Search completed for reference_id: {search_request_item.reference_id}, found {total_count} items")

        _logger.info(f"Search completed for transaction_id: {message.transaction_id}, found {len(dci_search_response_items)} items")
        return dci_search_response_items

    async def _expression_search(
        self, register_id: str, model_class, filter_conditions: list, current_page: int, page_size: int,
        sort_by: Optional[str],
    ) -> Tuple[List[DeepSearchResultData], int]:
        """Exact-field search. Each record comes with its linked records (a person's land,
        household, …), as an idtype-value search returns it, so one call gets the whole record."""
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            # Total count
            count_query = select(func.count()).select_from(
                select(model_class).filter(*filter_conditions).subquery()
            )
            total_count = (await session.execute(count_query)).scalar() or 0

            # Sorting
            order_by_clause = None
            if sort_by:
                column_name = sort_by.lstrip("-")
                sort_column = getattr(model_class, column_name, None)
                if sort_column is not None:
                    order_by_clause = sort_column.desc() if sort_by.startswith("-") else sort_column.asc()

            # Paginated query
            offset = (current_page - 1) * page_size
            query = select(model_class).filter(*filter_conditions)
            if order_by_clause is not None:
                query = query.order_by(order_by_clause)
            query = query.offset(offset).limit(page_size)

            results = (await session.execute(query)).scalars().all()

            definition = await self.register_service.validate_register_definition(register_id, session)
            hierarchy = G2PRegisterHierarchicalService.get_component() or G2PRegisterHierarchicalService()
            search_results = []
            for record in results:
                record_dict = await hierarchy.enrich_record_hierarchy(definition, record, session)
                search_results.append(DeepSearchResultData(**record_dict))

            return search_results, total_count

    async def _is_activity_register(self, register_mnemonic: str) -> bool:
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            purpose = (
                await session.execute(
                    select(G2PRegisterDefinition.register_purpose).where(
                        G2PRegisterDefinition.register_mnemonic == register_mnemonic
                    )
                )
            ).scalar_one_or_none()
        return purpose == RegisterPurposeEnum.ACTIVITY.value

    def _get_activity_model_class(self, register_mnemonic: str):
        module = importlib.import_module("openg2p_registry_extensions.register_domain.models")
        model_class = getattr(module, f"G2PActivity{register_mnemonic}", None)
        if model_class is None:
            raise ValueError(f"Activity register implementation not found: G2PActivity{register_mnemonic}")
        return model_class

    async def _activity_search(self, model_class, query_result, current_page, page_size, sort_by):
        """Current activities only (ACTIVE, not rejected); idtype-value queries match the subject."""
        conditions = list(query_result.filter_conditions or [])
        conditions.append(model_class.status == ActivityStatusEnum.ACTIVE.value)
        conditions.append(model_class.verification_status != ActivityVerificationStatusEnum.REJECTED.value)
        if query_result.search_text:
            conditions.append(
                or_(
                    model_class.subject_id == query_result.search_text,
                    model_class.search_text.ilike(f"%{query_result.search_text}%"),
                )
            )
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            base = select(model_class).where(*conditions)
            total_count = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
            order = [model_class.occurred_at.desc()]
            if sort_by:
                column = getattr(model_class, sort_by.lstrip("-"), None)
                if column is not None:
                    order = [column.desc() if sort_by.startswith("-") else column.asc()]
            rows = (
                await session.execute(
                    base.order_by(*order).offset((current_page - 1) * page_size).limit(page_size)
                )
            ).scalars().all()
        results = []
        for row in rows:
            record = {key: _plain(value) for key, value in row.to_dict().items() if key != "search_text"}
            record["occurred_on_ec"] = format_ethiopian_date(row.occurred_at.date())
            results.append(_ActivityRecord(record))
        return results, total_count

    async def _state_context_type(self, register_id: str, reg_record_type: Optional[str]) -> Optional[str]:
        """The context type a record type names (…:CropSeason → CROP_SEASON), if the register has it."""
        context_type = _context_type_of(reg_record_type)
        if not context_type:
            return None
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            found = (
                await session.execute(
                    select(G2PActivityContext.context_id)
                    .where(
                        G2PActivityContext.register_id == register_id,
                        G2PActivityContext.context_type == context_type,
                    )
                    .limit(1)
                )
            ).scalar()
        return context_type if found else None

    async def _state_search(self, register_mnemonic: str, register_id: str, context_type: str, subject_id: str,
                            filters: Dict[str, Any], current_page: int, page_size: int,
                            allowed: Optional[AllowedFields] = None):
        """A subject's contexts of one type, current state from the projection, shaped by the register.

        ``filters`` may name any of the projection's plain columns (e.g. crop_year,
        season, crop, stage, context_status); JSON columns are not filterable.
        """
        registry = G2PActivityRegistryService.get_component() or G2PActivityRegistryService()
        _, projection = registry.resolve_classes(register_mnemonic)
        if projection is None:
            return [], 0
        conditions = DciQueryHelper.translate_filters(filters, _plain_columns(projection))
        domain = registry.domain_service(register_mnemonic)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            base = (
                select(projection)
                .join(G2PActivityContext, G2PActivityContext.context_id == projection.context_id)
                .where(
                    G2PActivityContext.register_id == register_id,
                    G2PActivityContext.context_type == context_type,
                    projection.subject_id == subject_id,
                    *conditions,
                )
            )
            total_count = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
            rows = (
                await session.execute(
                    base.order_by(projection.last_occurred_at.desc().nulls_last())
                    .offset((current_page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
        return [
            domain.dci_state_record(_filter_flat(_json_ready(row.to_dict()), allowed, f"{register_mnemonic}.context"))
            for row in rows
        ], total_count

    async def _aggregate_search(self, register_mnemonic: str, register_id: str, subject_id: str,
                                filters: Dict[str, Any], current_page: int, page_size: int,
                                allowed: Optional[AllowedFields] = None):
        """Current aggregates, shaped by the register's dci_aggregate_record.

        For one subject, or (subject_id None) across subjects: the controller
        only lets allow-listed partners do that, and it must name the
        aggregate type; pages are capped.

        The subject is matched on the aggregate's subject_id or
        subject_internal_record_id. ``filters`` may name aggregate_type,
        period_key, period_start, period_end, or any custom dimension the
        register sets (e.g. crop_year, season), compared as JSON values.
        Each aggregate row is filtered to the consented
        ``<Register>.aggregate.<field>`` references before the register shapes it.
        """
        columns = {
            "aggregate_type": G2PActivityAggregate.aggregate_type,
            "period_key": G2PActivityAggregate.period_key,
            "period_start": G2PActivityAggregate.period_start,
            "period_end": G2PActivityAggregate.period_end,
            "is_final": G2PActivityAggregate.is_final,
        }
        if subject_id is None:
            if "aggregate_type" not in filters:
                DciQueryHelper._raise_invalid_request(
                    "A search across subjects must name the aggregate_type."
                )
            page_size = min(page_size, int(_config.dci_bulk_aggregate_max_page_size))
        filters = dict(filters)
        for field_name in list(filters):
            if field_name not in columns:
                # A custom dimension: a JSONB value, so compare the filter's values as JSON.
                columns[field_name] = G2PActivityAggregate.custom_dimensions[field_name]
                filters[field_name] = _as_jsonb(filters[field_name])
        conditions = DciQueryHelper.translate_filters(filters, columns)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            subject_condition = (
                or_(
                    G2PActivityAggregate.subject_id == subject_id,
                    G2PActivityAggregate.subject_internal_record_id == subject_id,
                )
                if subject_id is not None
                else true()
            )
            base = select(G2PActivityAggregate).where(
                G2PActivityAggregate.register_id == register_id, subject_condition, *conditions,
            )
            total_count = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
            rows = (
                await session.execute(
                    base.order_by(
                        G2PActivityAggregate.period_start.desc().nulls_last(), G2PActivityAggregate.aggregate_type,
                        G2PActivityAggregate.subject_id,  # stable pages across subjects
                    )
                    .offset((current_page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
        registry = G2PActivityRegistryService.get_component() or G2PActivityRegistryService()
        domain = registry.domain_service(register_mnemonic)
        return [
            domain.dci_aggregate_record(_filter_flat(
                _json_ready({c.name: getattr(row, c.name) for c in row.__table__.columns}),
                allowed, f"{register_mnemonic}.aggregate",
            ))
            for row in rows
        ], total_count

    def _require_records_of_subject(self, search_result_data, consent_subject: str) -> None:
        """Entity register: every returned record must be the consented person's
        (its foundational ID or functional ID is the consent's subject)."""
        for datum in search_result_data:
            record = self._deep_search_result_data_to_dict(datum)
            identifiers = {str(record.get(key)) for key in ("foundational_id", "functional_record_id")
                           if record.get(key) not in (None, "")}
            if consent_subject not in identifiers:
                raise G2PRegistryException(
                    code=DciSearchStatusReasonCode.SEARCH_CRITERIA_INVALID.value,
                    message="The consent's subject is not the person searched",
                )

    async def _require_subject_link(self, register_mnemonic: str, searched: Optional[str], consent_subject: str):
        """Activity register: the searched subject is the consented person, or the
        register's own data links the two (its subject_id_fields, e.g. a register
        ID recorded with the person's Fayda FAN)."""
        if searched and searched == consent_subject:
            return
        denied = G2PRegistryException(
            code=DciSearchStatusReasonCode.SEARCH_CRITERIA_INVALID.value,
            message="The consent's subject is not the person searched",
        )
        if not searched:
            raise denied
        registry = G2PActivityRegistryService.get_component() or G2PActivityRegistryService()
        model, _ = registry.resolve_classes(register_mnemonic)
        fields = [
            getattr(model, name) for name in registry.domain_service(register_mnemonic).subject_id_fields
            if model is not None and hasattr(model, name)
        ]
        if not fields:
            raise denied
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            linked = (
                await session.execute(
                    select(model.activity_id)
                    .where(model.subject_id == searched, or_(*[field == consent_subject for field in fields]))
                    .limit(1)
                )
            ).scalar()
        if not linked:
            raise denied

    async def _allowed_fields(
        self, consent_scopes_by_ref: Optional[Dict[str, ConsentScopeGrant]], reference_id: str
    ) -> Optional[AllowedFields]:
        """The fields one item may return; None when consent enforcement is off (no filtering)."""
        if consent_scopes_by_ref is None:
            return None
        grant = consent_scopes_by_ref.get(reference_id)
        if grant is None:
            return AllowedFields({})  # fail closed
        if isinstance(grant, (list, tuple)):
            grant = ConsentScopeGrant(list(grant), None)
        return await self.data_scopes.resolve(grant.scope_ids, grant.issued_at)

    @staticmethod
    def _filter_record(
        record: Dict[str, Any], allowed: Optional[AllowedFields], register_mnemonic: str, is_activity: bool,
        nested_keys: Dict[str, str],
    ) -> Dict[str, Any]:
        """An internal record trimmed to the allowed fields (unchanged when nothing is enforced)."""
        if allowed is None:
            return record
        if is_activity:
            return allowed.filter_flat(record, f"{register_mnemonic}.activity")
        return allowed.filter_register_record(record, register_mnemonic, nested_keys)

    def _get_model_class(self, register_mnemonic: str):
        module = importlib.import_module("openg2p_registry_extensions.register_domain.models")
        class_name = f"G2PRegister{register_mnemonic}"
        model_class = getattr(module, class_name, None)
        if model_class is None:
            raise ValueError(f"Register implementation not found: {class_name}")
        return model_class

    def _render_reg_record_with_template(
        self,
        deep_search_result_data,
        template_store_id: str,
        bucket=None,
    ) -> Dict[str, Any]:
        from openg2p_registry_core.models.enum import DocumentBucket

        template_helper = TemplateHelper.get_component()

        search_result_dict: Dict[str, Any] = (
            deep_search_result_data if isinstance(deep_search_result_data, dict)
            else self._deep_search_result_data_to_dict(deep_search_result_data)
        )

        reg_record: Dict[str, Any] = template_helper.render_with_template(
            document_store_id=template_store_id,
            data=search_result_dict,
            expand_data=False,
            bucket=bucket or DocumentBucket.TEMPLATES,
        )

        return reg_record

    def _deep_search_result_data_to_dict(
        self,
        deep_search_result_data: DeepSearchResultData
    ) -> Dict[str, Any]:
        if hasattr(deep_search_result_data, "model_dump"):
            data_dict = deep_search_result_data.model_dump(exclude_unset=False, by_alias=False)
        else:
            data_dict = deep_search_result_data.dict(exclude_unset=False, by_alias=False)

        return data_dict

    def _get_registry_search_parameters(
        self,
        search_criteria: DciSearchCriteria,
        model_class=None,
        parse_query: bool = True,
    ) -> Tuple[Optional[DciQueryResult], int, int, Optional[str]]:
        query_result = DciQueryHelper.parse_query(search_criteria, model_class) if parse_query else None

        # Pagination
        current_page: int = 1
        page_size: int = 10
        if search_criteria.pagination:
            current_page = search_criteria.pagination.page_number
            page_size = search_criteria.pagination.page_size

        # Sorting
        sort_by = None
        if search_criteria.sort and len(search_criteria.sort) > 0:
            first_sort = search_criteria.sort[0]
            if first_sort.sort_order == "desc":
                sort_by = f"-{first_sort.attribute_name}"
            else:
                sort_by = first_sort.attribute_name

        return query_result, current_page, page_size, sort_by

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


def _is_aggregate_request(reg_record_type: Optional[str]) -> bool:
    """reg_record_type ending in "Aggregate" (e.g. spdci-extensions-agri:ActivityAggregate) asks for roll-ups."""
    return bool(reg_record_type) and str(reg_record_type).lower().endswith("aggregate")


def _context_type_of(reg_record_type: Optional[str]) -> Optional[str]:
    """…:CropSeason → CROP_SEASON (the local name, CamelCase to UPPER_SNAKE)."""
    import re

    if not reg_record_type:
        return None
    local = str(reg_record_type).split(":")[-1]
    return re.sub(r"(?<!^)(?=[A-Z])", "_", local).upper() or None


def _require_consent_subject_or_bulk(
    consent_enforced: bool, consent_subject: Optional[str], search_criteria: DciSearchCriteria,
    is_aggregate: bool,
) -> None:
    """Under consent enforcement an item without a consented subject may only be an
    activity register's aggregate search across subjects (no subject_id key), which the controller has
    already put through the bulk partner allow-list. Anything else is refused, so
    a missing consent subject can never widen a search."""
    if not consent_enforced or consent_subject:
        return
    if is_aggregate and DciQueryHelper.is_bulk_aggregate_request(search_criteria):
        return
    raise G2PRegistryException(
        code=DciSearchStatusReasonCode.SEARCH_CRITERIA_INVALID.value,
        message="The search names no consented subject",
    )


def _names_subject(search_criteria: DciSearchCriteria) -> bool:
    """An expression query that names its subject (subject_id)."""
    if search_criteria.query_type != "expression":
        return False
    query = ((search_criteria.query.value or {}).get("expression") or {}).get("query") or {}
    return "subject_id" in query


def _plain_columns(model, exclude: frozenset = frozenset()) -> Dict[str, Any]:
    """A model's filterable columns by name: every column except JSON ones."""
    return {
        column.name: getattr(model, column.name)
        for column in model.__table__.columns
        if not isinstance(column.type, JSON) and column.name not in exclude
    }


def _as_jsonb(value):
    """Filter values (a value, a list, or {operator: value}) as JSONB, to compare with a JSONB field."""
    if isinstance(value, dict):
        return {op: _as_jsonb(v) for op, v in value.items()}
    if isinstance(value, list):
        return [_as_jsonb(v) for v in value]
    return cast(literal(json.dumps(value)), JSONB)


def _filter_flat(record: Dict[str, Any], allowed: Optional[AllowedFields], target: str) -> Dict[str, Any]:
    return record if allowed is None else allowed.filter_flat(record, target)


def _json_ready(value):
    if isinstance(value, dict):
        return {key: _json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_ready(item) for item in value]
    return _plain(value)


def _plain(value):
    """JSON-ready value for template rendering (Numeric columns come back as Decimal)."""
    from decimal import Decimal

    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


class _ActivityRecord:
    """Adapter so an activity renders through the same DCI template path as register records."""

    def __init__(self, data: Dict[str, Any]):
        self._data = data

    def model_dump(self, **_kwargs) -> Dict[str, Any]:
        return dict(self._data)
