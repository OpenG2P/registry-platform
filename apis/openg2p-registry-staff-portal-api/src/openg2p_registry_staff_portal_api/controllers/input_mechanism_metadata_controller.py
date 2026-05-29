import logging
from typing import List

from openg2p_fastapi_common.controller import BaseController
from openg2p_registry_core.controller_services import (
    InputMechanismMetadataControllerService,
    G2PVcConfigurationControllerService,
    ImportFileConfigurationControllerService,
)
from openg2p_registry_core.schemas import (
    G2PInputMechanismRequest,
    G2PInputMechanismResponse,
    G2PInputMechanismData,
    VcConfigurationRequest,
    VcConfigurationResponse,
    VcConfigurationData,
    ImportFileConfigurationRequest,
    ImportFileConfigurationResponse,
    ImportFileConfigurationData,
    ImportFileConfigurationResponseBody,
)
from iam_core.user_auth.helpers import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class InputMechanismMetadataController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/input-mechanism-metadata"]
        self.router.prefix = "/input-mechanism-metadata"

        # Core still exposes input mechanisms via this controller service
        self.input_mechanism_metadata_controller_service = (
            InputMechanismMetadataControllerService.get_component()
        )
        self.vc_configuration_controller_service = (
            G2PVcConfigurationControllerService.get_component()
        )
        self.import_file_configuration_controller_service = (
            ImportFileConfigurationControllerService.get_component()
        )
        self.helper = RequestResponseHelper.get_component()

        self.router.add_api_route(
            "/get_all_input_mechanisms",
            self.get_all_input_mechanisms,
            responses={200: {"model": G2PInputMechanismResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_vc_configuration",
            self.get_vc_configuration,
            responses={200: {"model": VcConfigurationResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_import_file_configuration",
            self.get_import_file_configuration,
            responses={200: {"model": ImportFileConfigurationResponse}},
            methods=["POST"],
        )

    @require_permissions({"intakeSubmission:edit"})
    async def get_all_input_mechanisms(
        self,
        request: G2PInputMechanismRequest,
    ) -> G2PInputMechanismResponse:
        _logger.debug("Get G2P Input Mechanisms Request: %s", request)
        try:
            input_mechanisms: List[G2PInputMechanismData] = (
                await self.input_mechanism_metadata_controller_service.get_all_input_mechanisms(
                    request
                )
            )
            _logger.debug("Input mechanisms: %s", input_mechanisms)

            return self.helper.construct_input_mechanisms_success_response(input_mechanisms, request)
        except Exception as e:
            _logger.error("Error getting input mechanisms: %s", str(e), exc_info=True)
            return self.helper.construct_error_response(e, request)

    @require_permissions({"intakeSubmission:edit"})
    async def get_vc_configuration(
        self,
        vc_configuration_request: VcConfigurationRequest,
    ) -> VcConfigurationResponse:
        try:
            vc_configuration_data: List[VcConfigurationData] = (
                await self.vc_configuration_controller_service.get_vc_configuration_for_register(
                    vc_configuration_request
                )
            )
            return self.helper.construct_vc_configuration_data_success_response(
                vc_configuration_data=vc_configuration_data,
                g2p_request=vc_configuration_request,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in get_vc_configuration: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(
                error_exception, vc_configuration_request
            )

    @require_permissions({"intakeSubmission:edit"})
    async def get_import_file_configuration(
        self,
        request: ImportFileConfigurationRequest,
    ) -> ImportFileConfigurationResponse:
        try:
            import_file_configuration_data: List[ImportFileConfigurationData] = (
                await self.import_file_configuration_controller_service.get_import_file_configuration(
                    request
                )
            )
            return ImportFileConfigurationResponse(
                response_header=self.helper.construct_success_response(
                    response_body=ImportFileConfigurationResponseBody(response_payload=import_file_configuration_data),
                    request=request,
                ).response_header,
                response_body=ImportFileConfigurationResponseBody(response_payload=import_file_configuration_data),
            )
        except Exception as error_exception:
            _logger.error(
                "Error in get_import_file_configuration: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(error_exception, request)

