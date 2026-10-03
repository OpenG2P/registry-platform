import importlib
import logging
from typing import TYPE_CHECKING, Optional

from openg2p_fastapi_common.service import BaseService

if TYPE_CHECKING:
    from ..services.g2p_register_domain_service import G2PRegisterDomainService

_logger = logging.getLogger("g2p-register-domain-factory")


# Extensions built before G2P-4786 ship their own copy of these factories in
# ``openg2p_registry_extensions.register_domain.factory`` (and register an
# instance of it in their Initializer). When such a module is installed its
# factory is used, so an extension that customised it keeps working; without
# it the core implementation below does the lookup itself.
_EXTENSION_FACTORY_MODULE = "openg2p_registry_extensions.register_domain.factory"


def _extension_factory(class_name: str, core_class: type):
    try:
        module = importlib.import_module(_EXTENSION_FACTORY_MODULE)
    except ModuleNotFoundError:
        return None
    extension_class = getattr(module, class_name, None)
    if extension_class is None or extension_class is core_class:
        return None
    return extension_class.get_component(strict=True) or extension_class()


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
        if type(self) is G2PRegisterDomainFactory:
            extension_factory = _extension_factory("G2PRegisterDomainFactory", G2PRegisterDomainFactory)
            if extension_factory is not None:
                return extension_factory.get_domain_service(register_mnemonic)
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
