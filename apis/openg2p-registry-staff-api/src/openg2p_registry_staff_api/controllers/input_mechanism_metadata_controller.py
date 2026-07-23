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
)
from iam_core.user_auth.decorators import require_permissions

from ..helpers import RequestResponseHelper
from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class InputMechanismMetadataController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/input-mechanism-metadata"]
        self.router.prefix = "/input-mechanism-metadata"

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
            "/get_all_vc_configurations",
            self.get_all_vc_configurations,
            responses={200: {"model": VcConfigurationResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_vc_configuration_for_register",
            self.get_vc_configuration_for_register,
            responses={200: {"model": VcConfigurationResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/create_vc_configuration",
            self.create_vc_configuration,
            responses={200: {"model": VcConfigurationResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/update_vc_configuration",
            self.update_vc_configuration,
            responses={200: {"model": VcConfigurationResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/delete_vc_configuration",
            self.delete_vc_configuration,
            responses={200: {"model": VcConfigurationResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/get_all_import_file_configurations",
            self.get_all_import_file_configurations,
            responses={200: {"model": ImportFileConfigurationResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_import_file_configuration_for_register",
            self.get_import_file_configuration_for_register,
            responses={200: {"model": ImportFileConfigurationResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/create_import_file_configuration",
            self.create_import_file_configuration,
            responses={200: {"model": ImportFileConfigurationResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/update_import_file_configuration",
            self.update_import_file_configuration,
            responses={200: {"model": ImportFileConfigurationResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/delete_import_file_configuration",
            self.delete_import_file_configuration,
            responses={200: {"model": ImportFileConfigurationResponse}},
            methods=["POST"],
        )

    @require_permissions({"intakeSubmission:edit"})
    async def get_all_input_mechanisms(
        self,
        input_mechanism_request: G2PInputMechanismRequest,
    ) -> G2PInputMechanismResponse:
        _logger.debug("Get G2P Input Mechanisms Request: %s", input_mechanism_request)
        try:
            input_mechanisms: List[G2PInputMechanismData] = (
                await self.input_mechanism_metadata_controller_service.get_all_input_mechanisms(
                    input_mechanism_request
                )
            )
            _logger.debug("Input mechanisms: %s", input_mechanisms)

            return self.helper.construct_input_mechanisms_success_response(
                input_mechanisms, input_mechanism_request
            )
        except Exception as e:
            _logger.error("Error getting input mechanisms: %s", str(e), exc_info=True)
            return self.helper.construct_error_response(e, input_mechanism_request)

    @require_permissions({"intakeSubmission:edit"})
    async def get_all_vc_configurations(
        self,
        vc_configuration_request: VcConfigurationRequest,
    ) -> VcConfigurationResponse:
        try:
            vc_configuration_data, pagination_response = (
                await self.vc_configuration_controller_service.get_all_vc_configurations(
                    vc_configuration_request
                )
            )
            return self.helper.construct_vc_configuration_data_success_response(
                vc_configuration_data=vc_configuration_data,
                g2p_request=vc_configuration_request,
                pagination_response=pagination_response,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in get_all_vc_configurations: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(
                error_exception, vc_configuration_request
            )

    @require_permissions({"intakeSubmission:edit"})
    async def get_vc_configuration_for_register(
        self,
        vc_configuration_request: VcConfigurationRequest,
    ) -> VcConfigurationResponse:
        try:
            vc_configuration_data, pagination_response = (
                await self.vc_configuration_controller_service.get_vc_configuration_for_register(
                    vc_configuration_request
                )
            )
            return self.helper.construct_vc_configuration_data_success_response(
                vc_configuration_data=vc_configuration_data,
                g2p_request=vc_configuration_request,
                pagination_response=pagination_response,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in get_vc_configuration_for_register: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(
                error_exception, vc_configuration_request
            )

    @require_permissions({"intakeSubmission:edit"})
    async def create_vc_configuration(
        self,
        vc_configuration_request: VcConfigurationRequest,
    ) -> VcConfigurationResponse:
        try:
            vc_configuration_data: List[VcConfigurationData] = (
                await self.vc_configuration_controller_service.create_vc_configuration(
                    vc_configuration_request
                )
            )
            return self.helper.construct_vc_configuration_data_success_response(
                vc_configuration_data=vc_configuration_data,
                g2p_request=vc_configuration_request,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in create_vc_configuration: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(
                error_exception, vc_configuration_request
            )

    @require_permissions({"intakeSubmission:edit"})
    async def update_vc_configuration(
        self,
        vc_configuration_request: VcConfigurationRequest,
    ) -> VcConfigurationResponse:
        try:
            vc_configuration_data: List[VcConfigurationData] = (
                await self.vc_configuration_controller_service.edit_descriptor_schema(
                    vc_configuration_request
                )
            )
            return self.helper.construct_vc_configuration_data_success_response(
                vc_configuration_data=vc_configuration_data,
                g2p_request=vc_configuration_request,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in update_vc_configuration: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(
                error_exception, vc_configuration_request
            )

    @require_permissions({"intakeSubmission:edit"})
    async def delete_vc_configuration(
        self,
        vc_configuration_request: VcConfigurationRequest,
    ) -> VcConfigurationResponse:
        try:
            vc_configuration_data: List[VcConfigurationData] = (
                await self.vc_configuration_controller_service.delete_vc_configuration(
                    vc_configuration_request
                )
            )
            return self.helper.construct_vc_configuration_data_success_response(
                vc_configuration_data=vc_configuration_data,
                g2p_request=vc_configuration_request,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in delete_vc_configuration: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(
                error_exception, vc_configuration_request
            )

    @require_permissions({"intakeSubmission:edit"})
    async def get_all_import_file_configurations(
        self,
        import_file_configuration_request: ImportFileConfigurationRequest,
    ) -> ImportFileConfigurationResponse:
        try:
            import_file_configuration_data, pagination_response = (
                await self.import_file_configuration_controller_service.get_all_import_file_configurations(
                    import_file_configuration_request
                )
            )
            return self.helper.construct_import_file_configuration_data_success_response(
                import_file_configuration_data=import_file_configuration_data,
                g2p_request=import_file_configuration_request,
                pagination_response=pagination_response,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in get_all_import_file_configurations: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(error_exception, import_file_configuration_request)

    @require_permissions({"intakeSubmission:edit"})
    async def get_import_file_configuration_for_register(
        self,
        import_file_configuration_request: ImportFileConfigurationRequest,
    ) -> ImportFileConfigurationResponse:
        try:
            import_file_configuration_data, pagination_response = (
                await self.import_file_configuration_controller_service.get_import_file_configuration_for_register(
                    import_file_configuration_request
                )
            )
            return self.helper.construct_import_file_configuration_data_success_response(
                import_file_configuration_data=import_file_configuration_data,
                g2p_request=import_file_configuration_request,
                pagination_response=pagination_response,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in get_import_file_configuration_for_register: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(error_exception, import_file_configuration_request)

    @require_permissions({"intakeSubmission:edit"})
    async def create_import_file_configuration(
        self,
        import_file_configuration_request: ImportFileConfigurationRequest,
    ) -> ImportFileConfigurationResponse:
        try:
            import_file_configuration_data: List[ImportFileConfigurationData] = (
                await self.import_file_configuration_controller_service.create_import_file_configuration(
                    import_file_configuration_request
                )
            )
            return self.helper.construct_import_file_configuration_data_success_response(
                import_file_configuration_data=import_file_configuration_data,
                g2p_request=import_file_configuration_request,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in create_import_file_configuration: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(error_exception, import_file_configuration_request)

    @require_permissions({"intakeSubmission:edit"})
    async def update_import_file_configuration(
        self,
        import_file_configuration_request: ImportFileConfigurationRequest,
    ) -> ImportFileConfigurationResponse:
        try:
            import_file_configuration_data: List[ImportFileConfigurationData] = (
                await self.import_file_configuration_controller_service.update_import_file_configuration(
                    import_file_configuration_request
                )
            )
            return self.helper.construct_import_file_configuration_data_success_response(
                import_file_configuration_data=import_file_configuration_data,
                g2p_request=import_file_configuration_request,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in update_import_file_configuration: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(error_exception, import_file_configuration_request)

    @require_permissions({"intakeSubmission:edit"})
    async def delete_import_file_configuration(
        self,
        import_file_configuration_request: ImportFileConfigurationRequest,
    ) -> ImportFileConfigurationResponse:
        try:
            import_file_configuration_data: List[ImportFileConfigurationData] = (
                await self.import_file_configuration_controller_service.delete_import_file_configuration(
                    import_file_configuration_request
                )
            )
            return self.helper.construct_import_file_configuration_data_success_response(
                import_file_configuration_data=import_file_configuration_data,
                g2p_request=import_file_configuration_request,
            )
        except Exception as error_exception:
            _logger.error(
                "Error in delete_import_file_configuration: %s",
                str(error_exception),
                exc_info=True,
            )
            return self.helper.construct_error_response(error_exception, import_file_configuration_request)
