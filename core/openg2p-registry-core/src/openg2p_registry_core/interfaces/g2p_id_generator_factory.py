import importlib
import logging

from openg2p_fastapi_common.service import BaseService

from .g2p_id_generator_interface import G2PIdGeneratorInterface

_logger = logging.getLogger("g2p-id-generator-factory")


# Extensions built before G2P-4786 ship their own copy of the factories in
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


class G2PIdGeneratorFactory(BaseService):
    """
    Dynamically loads the ID generator implementation.

    The implementation class must exist in:
        openg2p_registry_extensions.register_domain.id_generator
        as G2PIdGeneratorService
    """

    g2p_id_generator: G2PIdGeneratorInterface = None

    def get_id_generator(self) -> G2PIdGeneratorInterface:
        if type(self) is G2PIdGeneratorFactory:
            extension_factory = _extension_factory("G2PIdGeneratorFactory", G2PIdGeneratorFactory)
            if extension_factory is not None:
                return extension_factory.get_id_generator()
        try:
            module = importlib.import_module(
                "openg2p_registry_extensions.register_domain.id_generator"
            )
            implementation_class = getattr(module, "G2PIdGeneratorService")
            g2p_id_generator: G2PIdGeneratorInterface = implementation_class.get_component()
            if not g2p_id_generator:
                g2p_id_generator = implementation_class()
            return g2p_id_generator
        except (AttributeError, ModuleNotFoundError) as error:
            _logger.warning(
                f"Could not find specific implementation: {error}. "
                f"Falling back to default implementations."
            )
            return None
