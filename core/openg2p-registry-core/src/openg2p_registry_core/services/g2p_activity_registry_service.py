"""Looks up activity registers, their types, and the extension classes that implement them."""

import importlib
import logging
from dataclasses import dataclass
from typing import Optional

from openg2p_fastapi_common.service import BaseService
from sqlalchemy import select

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import G2PActivityType, G2PRegisterDefinition, RegisterPurposeEnum
from .g2p_activity_domain_service import G2PActivityDomainService

_logger = logging.getLogger("g2p-activity-registry-service")

_MODELS_MODULE = "openg2p_registry_extensions.register_domain.models"
_SERVICES_MODULE = "openg2p_registry_extensions.register_domain.services"


@dataclass
class ActivityRegister:
    definition: G2PRegisterDefinition
    activity_model: type
    projection_model: Optional[type]
    domain_service: G2PActivityDomainService

    @property
    def register_id(self) -> str:
        return self.definition.register_id

    @property
    def mnemonic(self) -> str:
        return self.definition.register_mnemonic


def activity_model_name(mnemonic: str) -> str:
    return f"G2PActivity{mnemonic}"


def projection_model_name(mnemonic: str) -> str:
    return f"G2PActivityProjection{mnemonic}"


def domain_service_name(mnemonic: str) -> str:
    return f"G2PActivityDomainService{mnemonic}"


class G2PActivityRegistryService(BaseService):
    def __init__(self, name=""):
        super().__init__(name)
        self._domain_services: dict[str, G2PActivityDomainService] = {}

    @staticmethod
    def resolve_classes(mnemonic: str) -> tuple[Optional[type], Optional[type]]:
        try:
            models = importlib.import_module(_MODELS_MODULE)
        except ModuleNotFoundError:
            return None, None
        return getattr(models, activity_model_name(mnemonic), None), getattr(
            models, projection_model_name(mnemonic), None
        )

    def domain_service(self, mnemonic: str) -> G2PActivityDomainService:
        if mnemonic not in self._domain_services:
            service_class = G2PActivityDomainService
            try:
                services = importlib.import_module(_SERVICES_MODULE)
                service_class = getattr(services, domain_service_name(mnemonic), G2PActivityDomainService)
            except ModuleNotFoundError:
                pass
            # Instantiate outside the component registry lookup: the base class
            # is shared by every register, so get_component() would be ambiguous.
            self._domain_services[mnemonic] = service_class(name=f"activity-domain-{mnemonic}")
        return self._domain_services[mnemonic]

    async def get_register(self, session, mnemonic: str) -> ActivityRegister:
        definition = (
            await session.execute(
                select(G2PRegisterDefinition).where(G2PRegisterDefinition.register_mnemonic == mnemonic)
            )
        ).scalar()
        if definition is None or definition.register_purpose != RegisterPurposeEnum.ACTIVITY.value:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.ACTIVITY_REGISTER_NOT_FOUND.value[1],
                message=f"No activity register with mnemonic '{mnemonic}'",
            )
        activity_model, projection_model = self.resolve_classes(mnemonic)
        if activity_model is None:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.ACTIVITY_REGISTER_NOT_FOUND.value[1],
                message=f"Extension does not define {activity_model_name(mnemonic)}",
            )
        return ActivityRegister(definition, activity_model, projection_model, self.domain_service(mnemonic))

    async def list_registers(self, session) -> list[G2PRegisterDefinition]:
        return list(
            (
                await session.execute(
                    select(G2PRegisterDefinition)
                    .where(G2PRegisterDefinition.register_purpose == RegisterPurposeEnum.ACTIVITY.value)
                    .order_by(G2PRegisterDefinition.register_rank, G2PRegisterDefinition.register_mnemonic)
                )
            ).scalars()
        )

    async def get_activity_type(self, session, register_id: str, activity_type: str) -> G2PActivityType:
        row = (
            await session.execute(
                select(G2PActivityType).where(
                    G2PActivityType.register_id == register_id,
                    G2PActivityType.activity_type == activity_type,
                    G2PActivityType.is_active.is_(True),
                )
            )
        ).scalar()
        if row is None:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.ACTIVITY_TYPE_NOT_FOUND.value[1],
                message=f"Unknown activity type '{activity_type}'",
            )
        return row

    async def list_activity_types(self, session, register_id: str, include_inactive: bool = False):
        stmt = select(G2PActivityType).where(G2PActivityType.register_id == register_id)
        if not include_inactive:
            stmt = stmt.where(G2PActivityType.is_active.is_(True))
        stmt = stmt.order_by(G2PActivityType.display_order, G2PActivityType.activity_type)
        return list((await session.execute(stmt)).scalars())
