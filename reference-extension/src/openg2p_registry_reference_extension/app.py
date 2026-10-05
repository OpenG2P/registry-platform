# ruff: noqa: E402
import asyncio
import logging

from .config import Settings

_config = Settings.get_config()

from openg2p_fastapi_common.app import Initializer as BaseInitializer
from openg2p_registry_core.app import Initializer as CoreInitializer

from .register_domain.models import (
    G2PRegisterIndividual,
    G2PRegisterHistoryIndividual,
    G2PIntakeFormIndividual,
    G2PRegisterIndividualDisability,
    G2PRegisterHistoryIndividualDisability,
    G2PIntakeFormIndividualDisability,
    G2PRegisterHousehold,
    G2PRegisterHistoryHousehold,
    G2PIntakeFormHousehold,
    G2PRegisterIndividualProgram,
    G2PRegisterHistoryIndividualProgram,
    G2PIntakeFormIndividualProgram,
    G2PRegisterHouseholdProgram,
    G2PRegisterHistoryHouseholdProgram,
    G2PIntakeFormHouseholdProgram,
    G2PRegisterHouseholdAsset,
    G2PRegisterHistoryHouseholdAsset,
    G2PIntakeFormHouseholdAsset,
    G2PRegisterIndividualShock,
    G2PRegisterHistoryIndividualShock,
    G2PIntakeFormIndividualShock,
    G2PRegisterHouseholdHousingAndServices,
    G2PRegisterHistoryHouseholdHousingAndServices,
    G2PIntakeFormHouseholdHousingAndServices,
    G2PRegisterIndividualLand,
    G2PRegisterHistoryIndividualLand,
    G2PIntakeFormIndividualLand,
    G2PRegisterIndividualLivelihood,
    G2PRegisterHistoryIndividualLivelihood,
    G2PIntakeFormIndividualLivelihood,
    G2PRegisterIndividualLivestock,
    G2PRegisterHistoryIndividualLivestock,
    G2PIntakeFormIndividualLivestock,
    G2PRegisterIndividualVulnerability,
    G2PRegisterHistoryIndividualVulnerability,
    G2PIntakeFormIndividualVulnerability,
)
from .register_domain.services import (
    G2PRegisterDomainServiceIndividual,
    G2PRegisterDomainServiceHousehold,
)

_logger = logging.getLogger(_config.logging_default_logger_name)


class Initializer(BaseInitializer):
    def initialize(self, **kwargs):
        super().initialize()
        CoreInitializer().initialize()

        G2PRegisterDomainServiceIndividual()
        G2PRegisterDomainServiceHousehold()

    def migrate_database(self, args):

        async def migrate():
            _logger.info("Migrating extensions database")

            await G2PRegisterHousehold.create_migrate()
            await G2PRegisterHistoryHousehold.create_migrate()
            await G2PIntakeFormHousehold.create_migrate()

            await G2PRegisterIndividual.create_migrate()
            await G2PRegisterHistoryIndividual.create_migrate()
            await G2PIntakeFormIndividual.create_migrate()

            await G2PRegisterIndividualDisability.create_migrate()
            await G2PRegisterHistoryIndividualDisability.create_migrate()
            await G2PIntakeFormIndividualDisability.create_migrate()

            await G2PRegisterIndividualProgram.create_migrate()
            await G2PRegisterHistoryIndividualProgram.create_migrate()
            await G2PIntakeFormIndividualProgram.create_migrate()

            await G2PRegisterHouseholdProgram.create_migrate()
            await G2PRegisterHistoryHouseholdProgram.create_migrate()
            await G2PIntakeFormHouseholdProgram.create_migrate()

            await G2PRegisterHouseholdAsset.create_migrate()
            await G2PRegisterHistoryHouseholdAsset.create_migrate()
            await G2PIntakeFormHouseholdAsset.create_migrate()

            await G2PRegisterIndividualShock.create_migrate()
            await G2PRegisterHistoryIndividualShock.create_migrate()
            await G2PIntakeFormIndividualShock.create_migrate()

            await G2PRegisterHouseholdHousingAndServices.create_migrate()
            await G2PRegisterHistoryHouseholdHousingAndServices.create_migrate()
            await G2PIntakeFormHouseholdHousingAndServices.create_migrate()

            await G2PRegisterIndividualLand.create_migrate()
            await G2PRegisterHistoryIndividualLand.create_migrate()
            await G2PIntakeFormIndividualLand.create_migrate()

            await G2PRegisterIndividualLivelihood.create_migrate()
            await G2PRegisterHistoryIndividualLivelihood.create_migrate()
            await G2PIntakeFormIndividualLivelihood.create_migrate()

            await G2PRegisterIndividualLivestock.create_migrate()
            await G2PRegisterHistoryIndividualLivestock.create_migrate()
            await G2PIntakeFormIndividualLivestock.create_migrate()

            await G2PRegisterIndividualVulnerability.create_migrate()
            await G2PRegisterHistoryIndividualVulnerability.create_migrate()
            await G2PIntakeFormIndividualVulnerability.create_migrate()

        asyncio.run(migrate())
