# ruff: noqa: E402
import asyncio
import logging

from .config import Settings

_config = Settings.get_config()

from openg2p_fastapi_common.app import Initializer as BaseInitializer
from openg2p_registry_core.app import Initializer as CoreInitializer
from openg2p_registry_extensions.app import Initializer as ExtensionsInitializer

from .helpers import RequestResponseHelper
from .controllers import (
    G2PRegisterDataController, G2PRegisterChangerequestController,
    G2PRegisterMetadataController, G2PRegisterTabMetadataController, G2PRegisterSectionMetadataController,
    G2PIngestionConfigurationController, G2POutgestionConfigurationController,
    G2PDataModelController,
    G2PDocumentController, G2PAttributeController, G2PIngestionDataController,
    G2POutgestionDataController,
    G2PRegistryConfigurationController,
    G2PRegistryThemeController,
    G2PRegistryLanguageController,
    InputMechanismMetadataController,
    InputMechanismDataController,
    G2PVerificationController,
    G2PIntakeFormDataController,
    G2PIntakeFormMetadataController,
    G2PChangeRequestCoreController,
    G2PCompletionScoreController,
    G2PScoreController,
    G2PScoreDefinitionController,
    G2PScoreContributingAttributeController,
    G2PRegistrantAuthenticationController,
    G2PAwePolicyConfigurationController,
    G2PAWEWebhookController,
    G2PAweProxyController,
)

_logger = logging.getLogger(_config.logging_default_logger_name)


class Initializer(BaseInitializer):
    def initialize(self, **kwargs):

        RequestResponseHelper()

        G2PRegistryConfigurationController().post_init()
        G2PRegistryThemeController().post_init()
        G2PRegistryLanguageController().post_init()
        G2PRegisterMetadataController().post_init()
        G2PRegisterTabMetadataController().post_init()
        G2PRegisterSectionMetadataController().post_init()
        G2PRegisterDataController().post_init()
        G2PRegisterChangerequestController().post_init()
        G2PIngestionConfigurationController().post_init()
        G2PDataModelController().post_init()
        G2PIngestionDataController().post_init()
        G2POutgestionDataController().post_init()
        G2POutgestionConfigurationController().post_init()
        G2PDocumentController().post_init()
        G2PAttributeController().post_init()
        InputMechanismMetadataController().post_init()
        InputMechanismDataController().post_init()
        G2PVerificationController().post_init()
        G2PIntakeFormDataController().post_init()
        G2PIntakeFormMetadataController().post_init()
        G2PChangeRequestCoreController().post_init()
        G2PScoreController().post_init()
        G2PScoreDefinitionController().post_init()
        G2PScoreContributingAttributeController().post_init()
        G2PCompletionScoreController().post_init()
        G2PRegistrantAuthenticationController().post_init()
        G2PAwePolicyConfigurationController().post_init()
        G2PAWEWebhookController().post_init()
        G2PAweProxyController().post_init()

    def migrate_database(self, args):
        _logger.info("Starting database migration")

        CoreInitializer().get_component().migrate_database(args)
        ExtensionsInitializer().get_component().migrate_database(args)

        _logger.info("Database migration completed")
