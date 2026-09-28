# ruff: noqa: E402
import asyncio
import logging

from openg2p_fastapi_common.app import Initializer as BaseInitializer
from openg2p_fastapi_common.utils.crypto import KeymanagerCryptoHelper

from .cache import init_cache
from .config import Settings
from .controller_services import (
    G2PDataModelControllerService,
    G2PDocumentControllerService,
    G2PIngestControllerService,
    G2PIngestionConfigurationControllerService,
    G2PIngestionDataControllerService,
    G2POutgestionDataControllerService,
    G2PIntakeFormDataControllerService,
    G2PIntakeFormMetadataControllerService,
    G2POutgestionConfigurationControllerService,
    G2PRegisterChangerequestControllerService,
    G2PChangeRequestCoreControllerService,
    G2PRegisterDataControllerService,
    G2PRegisterMetadataControllerService,
    G2PRegisterSectionMetadataControllerService,
    G2PRegisterTabMetadataControllerService,
    G2PRegistryConfigurationControllerService,
    G2PRegistryThemeControllerService,
    G2PRegistryLanguageControllerService,
    InputMechanismMetadataControllerService,
    ImportFileConfigurationControllerService,
    G2PVcConfigurationControllerService,
    G2PVerificationControllerService,
    G2PScoreControllerService,
    G2PScoreDefinitionControllerService,
    G2PScoreContributingAttributeControllerService,
    G2PCompletionScoreControllerService,
    G2PRegistrantAuthenticationControllerService,
    G2PAwePolicyConfigurationControllerService,
    G2PAweProxyControllerService,
    G2PActivityControllerService,
)
from .helpers import (
    AweHelper,
    ApplicationReferenceGenerator,
    PartnerManagementClient,
    PatternMatcher,
    TemplateHelper,
    get_document_handler,
)

from .models import (
    DataModel,
    DeduplicationChangerequestResult,
    DeduplicationRegisterResult,
    G2PInputMechanism,
    G2PIntakeFormDefinition,
    G2PIntakeFormSubmission,
    G2PIntakeFormSectionDocuments,
    G2PIntakeFormUITab,
    G2PIntakeFormUITabSection,
    G2PRegisterChangeRequest,
    G2PRegisterChangeRequestDocument,
    G2PRegisterChangeRequestPayload,
    G2PRegisterDefinition,
    G2PRegisterScoreDefinition,
    G2PRegisterScoreContributingAttribute,
    G2PRegisterDocumentHistory,
    G2PScoreComputeQueue,
    G2PRegisterScore,
    G2PRegisterScoreHistory,
    G2PRegisterSchema,
    G2PRegisterSection,
    G2PRegisterSectionDocument,
    G2PRegisterUITab,
    G2PRegisterUITabSection,
    G2PRegisterVerification,
    G2PRegistryConfiguration,
    G2PRegistryLanguage,
    G2PRegistryTheme,
    G2PRegistryThemeValue,
    G2PRegistryDocument,
    G2PRegistryImportFileConfiguration,
    G2PRegistryVcConfiguration,
    G2PRegistryAwePolicyConfiguration,
    G2PAweReqEvent,
    ImportFileProcessQueue,
    ImportFileProcessLog,
    IncomingClassifiedData,
    IncomingEnrichedTransformedData,
    IncomingModelKeyPath,
    IncomingModelRegisterSemanticPattern,
    IncomingModelSemanticPattern,
    IncomingRawData,
    IncomingRawDataPayload,
    IncomingTemplate,
    OutgoingRawData,
    OutgoingRawDataPayload,
    OutgoingTemplate,
    OutgoingTopic,
    OutgoingTransformedDataPayload,
    SubscriptionActivityLog,
    G2PFunctionalIdGenerationQueue,
    G2PRegisterSectionCompletionScore,
    G2PCompletionScoreComputationQueue,
    DeduplicationIntakeFormRegisterResult,
    DeduplicationIntakeFormIntakeFormResult,
    G2PRegistrantAuthenticationProvider,
    G2PRegistrantAuthentication,
    G2PVcIssuance,
    G2PRegistryDataPolicy,
    G2PActivity,
    G2PActivityType,
    G2PActivityContext,
    G2PActivityPeriodLock,
    G2PActivityIdempotencyKey,
    G2PActivityOutbox,
    G2PActivityTemporaryReference,
    G2PActivityIndicator,
    G2PActivityProjection,
    G2PActivityOdkForm,
    G2PActivityOdkFailure,
    G2PActivityTypeSchema,
    G2PActivityEnrichment,
    G2PActivityAggregate,
    G2PActivityAggregateHistory,
)
from .services import (
    G2PDataModelService,
    G2PDocumentService,
    G2PAttributeValueValidator,
    G2PChangeRequestWorkerService,
    G2PIngestionConfigurationService,
    G2PIngestionDataService,
    G2POutgestionDataService,
    G2PIngestService,
    G2PIntakeFormDataService,
    G2PIntakeFormLinkService,
    G2PIntakeFormMetadataService,
    G2POutgestionConfigurationService,
    G2PRegisterMetadataService,
    G2PRegisterDomainService,
    G2PRegisterHierarchicalService,
    G2PRegisterHistoryService,
    G2PRegisterService,
    G2PRegisterChangeRequestService,
    G2PRegisterVerificationService,
    G2PTemplateService,
    G2PVcConfigurationService,
    G2PChangeRequestCoreService,
    G2PScoreComputeService,
    G2PCompletionScoreService,
    G2PGeoHierarchyService,
    G2PRegistrantAuthenticationService,
    G2PAwePolicyConfigurationService,
    G2PAweIntegrationService,
    G2PAweWebhookService,
    InputMechanismMetadataService,
    InputMechanismDataService,
    ImportFileConfigurationService,
    G2PActivityRegistryService,
    G2PActivityReferenceService,
    G2PActivityRuleService,
    G2PActivityProjectionService,
    G2PActivityPartitionService,
    G2PActivityService,
    G2PActivityOutboxService,
    G2PActivityIndicatorService,
    G2PActivityOdkService,
)

_config = Settings.get_config(strict=False)
_logger = logging.getLogger(_config.logging_default_logger_name)


# Arbitrary, fixed key for the migration advisory lock (see migrate_database).
_MIGRATION_LOCK_KEY = 7428190001


class Initializer(BaseInitializer):
    def initialize(self, **kwargs):
        super().initialize()

        # Cache
        init_cache()

        # Helpers
        get_document_handler()
        TemplateHelper()
        PatternMatcher()
        PartnerManagementClient()
        ApplicationReferenceGenerator(_config.application_reference_format)
        KeymanagerCryptoHelper()
        AweHelper()

        # Services
        G2PDocumentService()
        G2PDataModelService()
        G2PRegisterDomainService()
        G2PIngestService()
        G2PRegisterService()
        G2PRegisterChangeRequestService()
        G2PRegisterHistoryService()
        G2PRegisterMetadataService()
        G2PRegisterHierarchicalService()
        G2PIngestionConfigurationService()
        G2PIngestionDataService()
        G2POutgestionDataService()
        G2POutgestionConfigurationService()
        G2PTemplateService()
        G2PAttributeValueValidator()
        G2PVcConfigurationService()
        InputMechanismMetadataService()
        InputMechanismDataService()
        ImportFileConfigurationService()
        G2PIntakeFormDataService()
        G2PIntakeFormLinkService()
        G2PIntakeFormMetadataService()
        G2PRegisterVerificationService()
        G2PChangeRequestCoreService()
        G2PChangeRequestWorkerService()
        G2PScoreComputeService()
        G2PCompletionScoreService()
        G2PGeoHierarchyService()
        G2PRegistrantAuthenticationService()
        G2PAwePolicyConfigurationService()
        G2PAweIntegrationService()
        G2PAweWebhookService()
        # Activity registers
        G2PActivityRegistryService()
        G2PActivityReferenceService()
        G2PActivityRuleService()
        G2PActivityProjectionService()
        G2PActivityPartitionService()
        G2PActivityService()
        G2PActivityOutboxService()
        G2PActivityIndicatorService()
        G2PActivityOdkService()

        # Controller Services
        G2PDataModelControllerService()
        G2PIngestControllerService()
        G2PRegisterDataControllerService()
        G2PRegisterChangerequestControllerService()
        G2PChangeRequestCoreControllerService()
        G2PRegisterMetadataControllerService()
        G2PRegisterTabMetadataControllerService()
        G2PRegisterSectionMetadataControllerService()
        G2PIngestionConfigurationControllerService()
        G2PIngestionDataControllerService()
        G2POutgestionDataControllerService()
        G2POutgestionConfigurationControllerService()
        G2PDocumentControllerService()
        G2PRegistryConfigurationControllerService()
        G2PRegistryThemeControllerService()
        G2PRegistryLanguageControllerService()
        G2PVcConfigurationControllerService()
        InputMechanismMetadataControllerService()
        ImportFileConfigurationControllerService()
        G2PIntakeFormDataControllerService()
        G2PIntakeFormMetadataControllerService()
        G2PVerificationControllerService()
        G2PScoreControllerService()
        G2PScoreDefinitionControllerService()
        G2PScoreContributingAttributeControllerService()
        G2PCompletionScoreControllerService()
        G2PRegistrantAuthenticationControllerService()
        G2PAwePolicyConfigurationControllerService()
        G2PAweProxyControllerService()
        G2PActivityControllerService()

    def migrate_database(self, args):
        super().migrate_database(args)

        async def migrate():
            # The staff, partner, bene and agent APIs all migrate on start and
            # usually start together; concurrent CREATE TABLEs collide on
            # pg_type ("duplicate key ... pg_type_typname_nsp_index") and the
            # loser stops half way. A session advisory lock runs them one at a
            # time; create_all is idempotent, so the later ones are no-ops.
            from openg2p_fastapi_common.context import dbengine
            from sqlalchemy import text

            async with dbengine.get().connect() as lock_connection:
                await lock_connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": _MIGRATION_LOCK_KEY})
                try:
                    await _migrate_tables()
                finally:
                    await lock_connection.execute(
                        text("SELECT pg_advisory_unlock(:key)"), {"key": _MIGRATION_LOCK_KEY}
                    )

        async def _migrate_tables():
            # Data Models
            await DataModel.create_migrate()

            # Register Models
            await G2PIntakeFormSubmission.create_migrate()
            await G2PIntakeFormDefinition.create_migrate()
            await G2PIntakeFormUITab.create_migrate()
            await G2PIntakeFormUITabSection.create_migrate()
            await G2PRegisterUITab.create_migrate()
            await G2PRegisterUITabSection.create_migrate()
            await G2PRegisterSchema.create_migrate()
            await G2PRegistryDataPolicy.create_migrate()
            await G2PRegisterSection.create_migrate()
            await G2PRegisterDefinition.create_migrate()
            await G2PRegisterVerification.create_migrate()
            await G2PRegisterChangeRequest.create_migrate()
            await G2PRegistryAwePolicyConfiguration.create_migrate()
            await G2PAweReqEvent.create_migrate()
            await G2PRegisterScoreDefinition.create_migrate()
            await G2PRegisterScoreContributingAttribute.create_migrate()
            await G2PScoreComputeQueue.create_migrate()
            await G2PRegisterScore.create_migrate()
            await G2PRegisterScoreHistory.create_migrate()
            await G2PRegistryConfiguration.create_migrate()
            await G2PRegistryLanguage.create_migrate()
            await G2PRegistryTheme.create_migrate()
            await G2PRegistryThemeValue.create_migrate()
            await G2PRegisterDocumentHistory.create_migrate()
            await G2PRegisterSectionDocument.create_migrate()
            await G2PIntakeFormSectionDocuments.create_migrate()
            await G2PRegisterChangeRequestPayload.create_migrate()
            await G2PRegisterChangeRequestDocument.create_migrate()
            await G2PRegistryDocument.create_migrate()

            # Deduplication Models
            await DeduplicationRegisterResult.create_migrate()
            await DeduplicationChangerequestResult.create_migrate()
            await DeduplicationIntakeFormRegisterResult.create_migrate()
            await DeduplicationIntakeFormIntakeFormResult.create_migrate()

            # Incoming Models (partners live in Partner Management, not here)
            await IncomingRawData.create_migrate()
            await IncomingTemplate.create_migrate()
            await IncomingModelKeyPath.create_migrate()
            await IncomingRawDataPayload.create_migrate()
            await IncomingClassifiedData.create_migrate()
            await SubscriptionActivityLog.create_migrate()
            await IncomingModelSemanticPattern.create_migrate()
            await IncomingModelRegisterSemanticPattern.create_migrate()
            await IncomingEnrichedTransformedData.create_migrate()

            # Outgoing Models
            await OutgoingTopic.create_migrate()
            await OutgoingRawData.create_migrate()
            await OutgoingTemplate.create_migrate()
            await OutgoingRawDataPayload.create_migrate()
            await OutgoingTransformedDataPayload.create_migrate()

            # VC Configuration Models
            await G2PInputMechanism.create_migrate()
            await G2PRegistryVcConfiguration.create_migrate()
            await G2PRegistryImportFileConfiguration.create_migrate()

            # Id Generation Queue Models
            await ImportFileProcessQueue.create_migrate()
            await ImportFileProcessLog.create_migrate()
            await G2PFunctionalIdGenerationQueue.create_migrate()

            # Completion Score Models
            await G2PCompletionScoreComputationQueue.create_migrate()
            await G2PRegisterSectionCompletionScore.create_migrate()
            # Registrant Authentication Models
            await G2PRegistrantAuthenticationProvider.create_migrate()
            await G2PRegistrantAuthentication.create_migrate()
            # VC issuance event log. Additive and unconditional: the table is
            # created whether or not VC issuance is switched on, and stays empty
            # and unreferenced when it is off. Conditional schema would be far
            # worse to maintain than an unused table.
            await G2PVcIssuance.create_migrate()

            # Activity registers: shared tables, then every activity/projection
            # table the extension declares (partitioned, with the append-only
            # guard). Registries need no migration code of their own.
            await G2PActivityType.create_migrate()
            await G2PActivityContext.create_migrate()
            await G2PActivityPeriodLock.create_migrate()
            await G2PActivityIdempotencyKey.create_migrate()
            await G2PActivityOutbox.create_migrate()
            await G2PActivityTemporaryReference.create_migrate()
            await G2PActivityIndicator.create_migrate()
            await G2PActivityOdkForm.create_migrate()
            await G2PActivityOdkFailure.create_migrate()
            await G2PActivityTypeSchema.create_migrate()
            await G2PActivityEnrichment.create_migrate()
            await G2PActivityAggregate.create_migrate()
            await G2PActivityAggregateHistory.create_migrate()
            await migrate_activity_core_tables()
            await migrate_activity_tables()

        asyncio.run(migrate())


def extension_activity_models() -> tuple[list, list]:
    """Concrete G2PActivity / G2PActivityProjection classes declared by the loaded extension."""
    import importlib

    try:
        module = importlib.import_module("openg2p_registry_extensions.register_domain.models")
    except ModuleNotFoundError:
        return [], []
    activities, projections = [], []
    for value in vars(module).values():
        if not isinstance(value, type) or "__tablename__" not in value.__dict__:
            continue
        if issubclass(value, G2PActivity):
            activities.append(value)
        elif issubclass(value, G2PActivityProjection):
            projections.append(value)
    return activities, projections


async def migrate_activity_core_tables() -> None:
    """Bring the shared activity tables up to the current models, and version activity-type schemas."""
    partitions = G2PActivityPartitionService.get_component() or G2PActivityPartitionService()
    for model in (
        G2PActivityType, G2PActivityContext, G2PActivityPeriodLock, G2PActivityIdempotencyKey, G2PActivityOutbox,
        G2PActivityTemporaryReference, G2PActivityIndicator, G2PActivityOdkForm, G2PActivityOdkFailure,
        G2PActivityTypeSchema, G2PActivityEnrichment, G2PActivityAggregate, G2PActivityAggregateHistory,
    ):
        await partitions.add_missing_columns(model)
    await partitions.ensure_activity_type_versioning()


async def migrate_activity_tables() -> None:
    partitions = G2PActivityPartitionService.get_component() or G2PActivityPartitionService()
    activities, projections = extension_activity_models()
    for model in activities:
        await partitions.ensure_activity_table(model)
    for model in projections:
        await partitions.ensure_projection_table(model)
    if activities:
        _logger.info("Activity tables ready: %s", [m.__tablename__ for m in activities])
