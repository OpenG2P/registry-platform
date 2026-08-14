import importlib
import logging
from typing import TYPE_CHECKING, Optional

from openg2p_fastapi_common.service import BaseService

if TYPE_CHECKING:
    from ..services.g2p_register_domain_service import G2PRegisterDomainService

_logger = logging.getLogger("g2p-register-domain-factory")


class G2PRegisterDomainFactory(BaseService):
    """
    Dynamically loads the domain service for the given register mnemonic.

    Naming convention:
        mnemonic "Individual"  →  G2PRegisterDomainServiceIndividual
        mnemonic "Household"   →  G2PRegisterDomainServiceHousehold

    The implementation class must exist in:
        openg2p_registry_extensions.register_domain.services
    """

    g2p_register_domain_service = None

    def get_domain_service(self, register_mnemonic: str) -> Optional["G2PRegisterDomainService"]:
        try:
            module = importlib.import_module(
                "openg2p_registry_extensions.register_domain.services"
            )
            register_class_prefix: str = "G2PRegisterDomainService"
            implementation_class_name: str = f"{register_class_prefix}{register_mnemonic}"
            implementation_class = getattr(module, implementation_class_name)
            _logger.info(
                f"Found specific implementation for register mnemonic '{register_mnemonic}': "
                f"{implementation_class_name}"
            )
            g2p_register_domain_service = implementation_class.get_component()
            if not g2p_register_domain_service:
                g2p_register_domain_service = implementation_class()
            return g2p_register_domain_service
        except (AttributeError, ModuleNotFoundError) as error:
            _logger.warning(
                f"Could not find specific implementation for register mnemonic '{register_mnemonic}': {error}. "
                f"Falling back to default implementations."
            )
            return None
