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
from .interfaces import G2PIdGeneratorFactory, G2PRegisterDomainFactory

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
    G2PActivityParticipant,
    G2PRegisterExportDataQueue,
    G2PDataScope,
    G2PDataScopeVersion,
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
    G2PChangeRequestSectionPayloadService,
    G2PSectionDocumentReconcileService,
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
    G2PRegisterExportService,
    G2PDataScopeService,
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

        # Factories
        G2PRegisterDomainFactory()
        G2PIdGeneratorFactory()

        # Services
        G2PDocumentService()
        G2PDataModelService()
        G2PRegisterDomainService()
        G2PIngestService()
        G2PRegisterService()
        G2PRegisterExportService()
        G2PChangeRequestSectionPayloadService()
        G2PSectionDocumentReconcileService()
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
        # Data scopes (consent scopes as groups of this registry's fields)
        G2PDataScopeService()

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
            await G2PRegisterExportDataQueue.create_migrate()

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
            await G2PActivityParticipant.create_migrate()
            await migrate_activity_core_tables()
            await migrate_activity_tables()

            # Data scopes: the catalogue tables with their immutability guards,
            # then publish the catalogue (section scopes + the extension's
            # meta_data/data-scopes/*.json). Never stops start-up: a refused
            # catalogue is logged and the published one stays in force.
            await G2PDataScope.create_migrate()
            await G2PDataScopeVersion.create_migrate()
            await migrate_data_scopes()

            # G2P-5516: latitude/longitude/altitude became Float. create_all never
            # alters an existing column, so convert tables made while they were
            # varchar. Runs inside the advisory lock above.
            await migrate_geo_coordinate_columns()

        asyncio.run(migrate())


async def migrate_data_scopes() -> None:
    scopes = G2PDataScopeService.get_component() or G2PDataScopeService()
    try:
        await scopes.ensure_guards()
        await scopes.sync(strict=False)
    except Exception:
        _logger.exception("Data scopes could not be published at start-up; will retry when read")


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
        G2PActivityParticipant,
    ):
        await partitions.add_missing_columns(model)
    await partitions.ensure_activity_type_versioning()


async def migrate_activity_tables() -> None:
    partitions = G2PActivityPartitionService.get_component() or G2PActivityPartitionService()
    activities, projections = extension_activity_models()
    # Activity DDL (partitions in particular) must never stop the API from
    # starting: a failure is logged and the daily activity_partition_worker
    # retries it.
    for model in activities:
        try:
            await partitions.ensure_activity_table(model)
        except Exception:
            _logger.exception("Activity table %s could not be fully migrated", model.__tablename__)
    for model in projections:
        try:
            await partitions.ensure_projection_table(model)
        except Exception:
            _logger.exception("Activity projection %s could not be migrated", model.__tablename__)
    if activities:
        _logger.info("Activity tables ready: %s", [m.__tablename__ for m in activities])


# The columns of the G2PGeo / G2PGeoHistory mixins that changed from varchar to
# double precision (G2P-5516), and two other columns only those mixins add, used
# to recognise their tables (register, history and intake tables of any
# extension) without importing the extension's models.
_GEO_COORDINATE_COLUMNS = ("latitude", "longitude", "altitude")
_GEO_SIGNATURE_COLUMNS = ("plus_code", "geo_code_hierarchy_json")
_NUMERIC_TEXT_PATTERN = r"^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$"

# Views (and materialized views) that read the given columns of a table, and,
# recursively, the views built on those. Postgres cannot change a column's type
# while a view reads it, so these are dropped and recreated around the change.
_DEPENDENT_VIEWS_SQL = """
WITH RECURSIVE deps(oid, depth) AS (
    SELECT DISTINCT r.ev_class, 1
    FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE d.classid = 'pg_rewrite'::regclass
      AND d.refobjid = CAST(:table AS regclass)
      AND a.attname = ANY(:columns)
      AND r.ev_class <> d.refobjid
    UNION
    SELECT r.ev_class, deps.depth + 1
    FROM deps
    JOIN pg_depend d ON d.refobjid = deps.oid AND d.classid = 'pg_rewrite'::regclass
    JOIN pg_rewrite r ON r.oid = d.objid
    WHERE r.ev_class <> deps.oid AND deps.depth < 20
)
SELECT c.oid, quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS name, c.relkind::text AS relkind,
       pg_get_viewdef(c.oid) AS definition, pg_get_userbyid(c.relowner) AS owner,
       array_to_string(c.reloptions, ', ') AS options,
       obj_description(c.oid, 'pg_class') AS comment, max(deps.depth) AS depth
FROM deps
JOIN pg_class c ON c.oid = deps.oid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('v', 'm')
GROUP BY c.oid, n.nspname, c.relname, c.relkind, c.relowner, c.reloptions
ORDER BY max(deps.depth), c.oid
"""


async def _saved_dependent_views(connection, table_name: str, columns: list[str]) -> list[dict]:
    from sqlalchemy import text

    views = [
        dict(row._mapping)
        for row in (
            await connection.execute(text(_DEPENDENT_VIEWS_SQL), {"table": table_name, "columns": columns})
        ).all()
    ]
    for view in views:
        view["grants"] = (
            await connection.execute(
                text(
                    "SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC' "
                    "            ELSE quote_ident(pg_get_userbyid(a.grantee)) END, "
                    "       a.privilege_type, a.is_grantable "
                    "FROM pg_class c, aclexplode(c.relacl) a WHERE c.oid = :oid"
                ),
                {"oid": view["oid"]},
            )
        ).all()
        view["indexes"] = (
            await connection.execute(
                text("SELECT pg_get_indexdef(indexrelid) FROM pg_index WHERE indrelid = :oid"),
                {"oid": view["oid"]},
            )
        ).scalars().all()
    return views


async def _recreate_views(connection, views: list[dict]) -> None:
    for view in views:
        materialized = view["relkind"] == "m"
        kind = "MATERIALIZED VIEW" if materialized else "VIEW"
        options = f" WITH ({view['options']})" if view["options"] else ""
        definition = view["definition"].strip().rstrip(";")
        await connection.exec_driver_sql(f"CREATE {kind} {view['name']}{options} AS {definition}")
        for index in view["indexes"]:
            await connection.exec_driver_sql(index)
        await connection.exec_driver_sql(f'ALTER {kind} {view["name"]} OWNER TO "{view["owner"]}"')
        for grantee, privilege, grantable in view["grants"]:
            await connection.exec_driver_sql(
                f"GRANT {privilege} ON {view['name']} TO {grantee}"
                + (" WITH GRANT OPTION" if grantable else "")
            )
        if view["comment"] is not None:
            comment = view["comment"].replace("'", "''")
            await connection.exec_driver_sql(f"COMMENT ON {kind} {view['name']} IS '{comment}'")


async def migrate_geo_coordinate_columns() -> None:
    """Convert G2PGeo coordinate columns still stored as text to double precision.

    Idempotent: only columns whose type is still character/text are touched, so
    a database created with the Float model (or already converted) is left
    alone. Blank strings become NULL; a value that is not a number is also set
    to NULL (and counted in the log) rather than failing the whole start-up.

    Views that read a converted column (e.g. generated reporting views) are
    dropped and recreated with their owner, grants, options, indexes and
    comment, in the same transaction. Each table is converted in its own
    transaction: one that cannot be is rolled back, logged, and the rest still
    convert.
    """
    from openg2p_fastapi_common.context import dbengine
    from sqlalchemy import text

    engine = dbengine.get()
    async with engine.connect() as connection:
        rows = (
            await connection.execute(
                text(
                    "SELECT c.table_name, c.column_name "
                    "FROM information_schema.columns c "
                    "JOIN information_schema.tables t "
                    "  ON t.table_schema = c.table_schema AND t.table_name = c.table_name "
                    "WHERE c.table_schema = current_schema() "
                    "  AND t.table_type = 'BASE TABLE' "
                    "  AND c.column_name = ANY(:coordinate_columns) "
                    "  AND c.data_type IN ('character varying', 'text', 'character') "
                    "  AND (SELECT count(*) FROM information_schema.columns s "
                    "       WHERE s.table_schema = c.table_schema AND s.table_name = c.table_name "
                    "         AND s.column_name = ANY(:signature_columns)) = :signature_count "
                    "ORDER BY c.table_name, c.column_name"
                ),
                {
                    "coordinate_columns": list(_GEO_COORDINATE_COLUMNS),
                    "signature_columns": list(_GEO_SIGNATURE_COLUMNS),
                    "signature_count": len(_GEO_SIGNATURE_COLUMNS),
                },
            )
        ).all()

    columns_by_table: dict[str, list[str]] = {}
    for table_name, column_name in rows:
        columns_by_table.setdefault(table_name, []).append(column_name)

    pattern = _NUMERIC_TEXT_PATTERN.replace("'", "''")
    for table_name, columns in columns_by_table.items():
        table = '"' + table_name.replace('"', '""') + '"'
        try:
            async with engine.begin() as connection:
                views = await _saved_dependent_views(connection, table, columns)
                for view in reversed(views):
                    kind = "MATERIALIZED VIEW" if view["relkind"] == "m" else "VIEW"
                    await connection.exec_driver_sql(f"DROP {kind} IF EXISTS {view['name']}")
                alterations = []
                for column_name in columns:
                    column = '"' + column_name.replace('"', '""') + '"'
                    invalid = (
                        await connection.execute(
                            text(
                                f"SELECT count(*) FROM {table} "
                                f"WHERE NULLIF(trim({column}), '') IS NOT NULL "
                                f"AND trim({column}) !~ :pattern"
                            ),
                            {"pattern": _NUMERIC_TEXT_PATTERN},
                        )
                    ).scalar() or 0
                    if invalid:
                        _logger.warning(
                            "%s.%s: %d non-numeric value(s) will be set to NULL", table_name, column_name, invalid
                        )
                    alterations.append(
                        f"ALTER COLUMN {column} TYPE double precision USING "
                        f"CASE WHEN trim({column}) ~ '{pattern}' "
                        f"THEN NULLIF(trim({column}), '')::double precision END"
                    )
                await connection.exec_driver_sql(f"ALTER TABLE {table} " + ", ".join(alterations))
                await _recreate_views(connection, views)
            _logger.info(
                "Converted %s.%s to double precision%s",
                table_name,
                "/".join(columns),
                f" (recreated {len(views)} dependent view(s))" if views else "",
            )
        except Exception as error:  # noqa: BLE001 — keep starting; the rest still convert
            _logger.error(
                "Could not convert %s.%s to double precision; left unchanged (%s)",
                table_name,
                "/".join(columns),
                error,
            )
