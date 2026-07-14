# ruff: noqa: E402
import asyncio
import logging

from .config import Settings

_config = Settings.get_config()

from openg2p_fastapi_common.app import Initializer as BaseInitializer
from openg2p_registry_core.app import Initializer as CoreInitializer
from openg2p_registry_extensions.app import Initializer as ExtensionsInitializer

from .ingestion import G2PIngestController, RequestResponseHelper
# Search imports (standard specific impl)
from .search import (
    G2PDciController,
    G2PDciService,
    DciRequestResponseHelper,
    DciKeymanagerHelper,
    DciConsentHelper
)

_logger = logging.getLogger(_config.logging_default_logger_name)


class Initializer(BaseInitializer):
    def initialize(self, **kwargs):

        # Ingestion
        RequestResponseHelper()
        G2PIngestController().post_init()

        # DCI
        G2PDciController().post_init()
        G2PDciService()
        DciKeymanagerHelper()
        DciConsentHelper()
        DciRequestResponseHelper()

    def migrate_database(self, args):
        _logger.info("Starting database migration")

        CoreInitializer().get_component().migrate_database(args)
        ExtensionsInitializer().get_component().migrate_database(args)

        _logger.info("Database migration completed")
