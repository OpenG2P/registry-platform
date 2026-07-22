#!/usr/bin/env python3

# ruff: noqa: I001

# --- Option C: select the domain-model extension module ---
# The platform code imports the domain model by the fixed name
# `openg2p_registry_extensions`. Here we alias the env-selected module into
# sys.modules BEFORE any such import runs, so the reference extension (default in
# RP images) or a variant extension is chosen purely by REGISTRY_EXTENSION_MODULE
# — no wheel.sources alias, no collision, both can coexist in one image.
import os as _os, sys as _sys, importlib as _il  # noqa: E402
_ext = _os.environ.get("REGISTRY_EXTENSION_MODULE", "openg2p_registry_extensions")
if _ext != "openg2p_registry_extensions":
    _sys.modules["openg2p_registry_extensions"] = _il.import_module(_ext)


from openg2p_registry_bene_api.app import Initializer
from openg2p_fastapi_common.ping import PingInitializer
from openg2p_registry_core.app import Initializer as CoreInitializer
from openg2p_registry_extensions.app import Initializer as ExtensionsInitializer

CoreInitializer()
ExtensionsInitializer()
initializer = Initializer()
PingInitializer()

app = initializer.return_app()

if __name__ == "__main__":
    initializer.main()
