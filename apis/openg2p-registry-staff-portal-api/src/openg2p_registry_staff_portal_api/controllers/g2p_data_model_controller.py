import logging

from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PDataModelControllerService
from openg2p_registry_core.schemas import (
    DataModelIdRequest,
    DataModelRequest,
    DataModelResponse,
    DataModelsResponse,
    DataModelUpdateRequest,
    GetAllDataModelsRequest,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PDataModelController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/data-model"]
        self.router.prefix = "/data-model"
        self.data_model_controller_service = G2PDataModelControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()

        self.router.add_api_route(
            "/create_data_model",
            self.create_data_model,
            responses={200: {"model": DataModelResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_data_model",
            self.get_data_model,
            responses={200: {"model": DataModelResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_all_data_models",
            self.get_all_data_models,
            responses={200: {"model": DataModelsResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/update_data_model",
            self.update_data_model,
            responses={200: {"model": DataModelResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/delete_data_model",
            self.delete_data_model,
            responses={200: {"model": DataModelResponse}},
            methods=["POST"],
        )

    @require_permissions({"dataModel:create"})
    async def create_data_model(
        self, data_model_request: DataModelRequest
    ) -> DataModelResponse:
        try:
            data_model_data = await self.data_model_controller_service.create_data_model(
                data_model_request.request_body.request_payload
            )
            return self.helper.construct_ingestion_config_success_response(
                data_model_data, DataModelResponse, data_model_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, data_model_request)

    @require_permissions({"dataModel:view"})
    async def get_data_model(self, data_model_request: DataModelIdRequest) -> DataModelResponse:
        try:
            data_model_data = await self.data_model_controller_service.get_data_model(
                data_model_request.request_body.request_payload.data_model_id
            )
            return self.helper.construct_ingestion_config_success_response(
                data_model_data, DataModelResponse, data_model_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, data_model_request)

    @require_permissions({"dataModel:view"})
    async def get_all_data_models(
        self, data_model_request: GetAllDataModelsRequest
    ) -> DataModelsResponse:
        try:
            pagination_request = getattr(data_model_request.request_body, "pagination_request", None)
            current_page = getattr(pagination_request, "current_page", None)
            page_size = getattr(pagination_request, "page_size", None)
            data_models_data, total_items, number_of_pages = (
                await self.data_model_controller_service.get_all_data_models(
                    current_page,
                    page_size,
                )
            )
            return self.helper.construct_ingestion_config_success_response(
                data_models_data,
                DataModelsResponse,
                data_model_request,
                total_items,
                number_of_pages,
            )
        except Exception as error:
            return self.helper.construct_error_response(error, data_model_request)

    @require_permissions({"dataModel:edit"})
    async def update_data_model(
        self, data_model_request: DataModelUpdateRequest
    ) -> DataModelResponse:
        try:
            data_model_data = await self.data_model_controller_service.update_data_model(
                data_model_request.request_body.request_payload.data_model_id,
                data_model_request.request_body.request_payload,
            )
            return self.helper.construct_ingestion_config_success_response(
                data_model_data, DataModelResponse, data_model_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, data_model_request)

    @require_permissions({"dataModel:delete"})
    async def delete_data_model(
        self, data_model_request: DataModelIdRequest
    ) -> DataModelResponse:
        try:
            data_model_data = await self.data_model_controller_service.delete_data_model(
                data_model_request.request_body.request_payload.data_model_id
            )
            return self.helper.construct_ingestion_config_success_response(
                data_model_data, DataModelResponse, data_model_request
            )
        except Exception as error:
            return self.helper.construct_error_response(error, data_model_request)
