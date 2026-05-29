import importlib
import logging
from datetime import datetime, date
from typing import Optional, List, Dict, Any, Tuple

from openg2p_registry_core.schemas import DeepSearchResultData
from openg2p_fastapi_common.service import BaseService
from openg2p_fastapi_common.context import dbengine

from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy import select, func

from openg2p_registry_core.services import G2PRegisterService
from openg2p_registry_core.helpers import TemplateHelper, MinioClient
from openg2p_registry_core.models import G2PRegisterDefinition, DataModel, OutgoingTemplate

from ..schemas import (
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
_engine = dbengine.get()

class G2PDciService(BaseService):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.register_service = G2PRegisterService.get_component()

    async def search(self, signature: str, header: DciRequestHeader, message: DciSearchRequest) -> List[DciSearchResponseItem]:

        dci_search_response_items: List[DciSearchResponseItem] = []
        for search_request_item in message.search_request:
            search_criteria: DciSearchCriteria = search_request_item.search_criteria

            register_id: str = await self._get_register_id(search_criteria.reg_type)
            data_model_id: str = await self._get_data_model_id()
            template_file_id: str = await self._get_template_file_id(register_id, data_model_id)

            model_class = self._get_model_class(search_criteria.reg_type)

            query_result, current_page, page_size, sort_by = self._get_registry_search_parameters(
                search_criteria, model_class
            )

            if query_result.filter_conditions:
                search_result_data, total_count = await self._expression_search(
                    model_class, query_result.filter_conditions, current_page, page_size, sort_by
                )
            else:
                search_result_data, total_count = await self.register_service.deep_search_in_a_register(
                    register_id=register_id,
                    search_text=query_result.search_text,
                    current_page=current_page,
                    page_size=page_size,
                    sort_by=sort_by,
                )

            dci_deep_search_result_data = DciSearchResultData(
                reg_type = search_criteria.reg_type,
                reg_record_type = search_criteria.reg_record_type,
                reg_records = [
                    self._render_reg_record_with_template(datum, template_file_id)
                    for datum in search_result_data
                ]
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
        self, model_class, filter_conditions: list, current_page: int, page_size: int, sort_by: Optional[str]
    ) -> Tuple[List[DeepSearchResultData], int]:
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
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

            search_results = []
            for record in results:
                record_dict = record.to_dict()
                for key, val in record_dict.items():
                    if isinstance(val, datetime):
                        record_dict[key] = val.isoformat()
                    elif isinstance(val, date):
                        record_dict[key] = val.isoformat()
                search_results.append(DeepSearchResultData(**record_dict))

            return search_results, total_count

    def _get_model_class(self, register_mnemonic: str):
        module = importlib.import_module("openg2p_registry_extensions.register_domain.models")
        class_name = f"G2PRegister{register_mnemonic}"
        model_class = getattr(module, class_name, None)
        if model_class is None:
            raise ValueError(f"Register implementation not found: {class_name}")
        return model_class

    def _render_reg_record_with_template(
        self,
        deep_search_result_data: DeepSearchResultData,
        template_file_id: str
    ) -> Dict[str, Any]:
        template_helper = TemplateHelper.get_component()
        minio_client = MinioClient.get_component()

        search_result_dict: Dict[str, Any] = self._deep_search_result_data_to_dict(deep_search_result_data)

        reg_record: Dict[str, Any] = template_helper.render_with_template(
            minio_client=minio_client,
            template_file_id=template_file_id,
            data=search_result_dict,
            expand_data=False
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
    ) -> Tuple[DciQueryResult, int, int, Optional[str]]:
        query_result = DciQueryHelper.parse_query(search_criteria, model_class)

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
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            register_id: str = (
                await session.execute(
                    select(G2PRegisterDefinition.register_id)
                    .where(G2PRegisterDefinition.register_mnemonic == register_mnemonic)
                )
            ).scalar_one_or_none()
            return register_id

    async def _get_data_model_id(self) -> str:
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            data_model_id: str = (
                await session.execute(
                    select(DataModel.data_model_id)
                    .where(DataModel.data_model_mnemonic == "DCI")
                )
            ).scalar_one_or_none()
            return data_model_id

    async def _get_template_file_id(self, register_id: str, data_model_id: str) -> str:
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            template_file_id: str = (
                await session.execute(
                    select(OutgoingTemplate.template_file_id)
                    .where(OutgoingTemplate.register_id == register_id)
                    .where(OutgoingTemplate.data_model_id == data_model_id)
                )
            ).scalar_one_or_none()
            return template_file_id
