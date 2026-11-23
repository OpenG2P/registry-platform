"""Select the domain extension as the images' entrypoints do: REGISTRY_EXTENSION_MODULE,
defaulting here to the platform's reference extension."""

import importlib
import os
import sys

_ext = os.environ.get("REGISTRY_EXTENSION_MODULE", "openg2p_registry_reference_extension")
if "openg2p_registry_extensions" not in sys.modules and _ext != "openg2p_registry_extensions":
    sys.modules["openg2p_registry_extensions"] = importlib.import_module(_ext)
