import logging

from openg2p_fastapi_common.controller import BaseController

from openg2p_registry_core.controller_services import G2PRegisterMetadataControllerService
from openg2p_registry_core.schemas import (
    RegisterData,
    RegisterDataResponse,
    RegisterSectionData,
    RegisterSectionsDataResponse,
    GetAllRegistersRequest,
    AllRegistersResponse,
    GetRegisterSectionsRequest,
    GetMasterRegisterRequest,
)

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class RegisterController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["Registry Beneficiary Portal"]
        self.register_metadata_controller_service = G2PRegisterMetadataControllerService.get_component()
        self.request_response_helper = RequestResponseHelper().get_component()
        self.router.prefix = "/beneficiary_portal"

        self.router.add_api_route(
            "/get_register",
            self.get_register,
            responses={200: {"model": RegisterDataResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_all_registers",
            self.get_all_registers,
            responses={200: {"model": AllRegistersResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_register_sections",
            self.get_register_sections,
            responses={200: {"model": RegisterSectionsDataResponse}},
            methods=["POST"],
        )

    async def get_register(
        self,
        register_request: GetMasterRegisterRequest,
    ) -> RegisterDataResponse:
        _logger.debug("Get My Registers Request: %s", register_request)
        try:
            register_data: RegisterData | None = await self.register_metadata_controller_service.get_master_register(
                register_request
            )
            if register_data is None:
                raise Exception("Register not found")
            _logger.debug("Register: %s", register_data)
            register_response: RegisterDataResponse = await self.request_response_helper.construct_success_response(
                register_request, register_data
            )
            return register_response
        except Exception as e:
            error_response: RegisterDataResponse = await self.request_response_helper.construct_failure_response(
                register_request, e.code, e.message
            )
            return error_response

    async def get_all_registers(
        self,
        get_all_registers_request: GetAllRegistersRequest,
    ) -> AllRegistersResponse:
        _logger.debug("Get All Registers Request: %s", get_all_registers_request)
        try:
            registers_data: list[RegisterData] = await self.register_metadata_controller_service.get_all_registers(
                get_all_registers_request
            )
            _logger.debug("List of all registers: %s", registers_data)
            register_response: AllRegistersResponse = await self.request_response_helper.construct_all_registers_success_response(
                get_all_registers_request, registers_data
            )
            return register_response
        except Exception as e:
            error_response: AllRegistersResponse = await self.request_response_helper.construct_error_response(
                get_all_registers_request, e.code, e.message
            )
            return error_response

    async def get_register_sections(
        self,
        get_register_sections_request: GetRegisterSectionsRequest,
    ) -> RegisterSectionsDataResponse:
        _logger.debug("Get Register Sections Request: %s", get_register_sections_request)
        try:
            register_sections_data: list[RegisterSectionData] = await self.register_metadata_controller_service.get_register_sections(
                get_register_sections_request
            )
            _logger.debug("List of register sections: %s", register_sections_data)
            register_response: RegisterSectionsDataResponse = await self.request_response_helper.construct_register_sections_success_response(
                get_register_sections_request, register_sections_data
            )
            return register_response
        except Exception as e:
            error_response: RegisterSectionsDataResponse = await self.request_response_helper.construct_error_response(
                get_register_sections_request, e.code, e.message
            )
            return error_response
