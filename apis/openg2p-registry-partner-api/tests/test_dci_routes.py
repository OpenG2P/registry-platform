"""The DCI search endpoints' full paths, as partners and the Composite call them."""

from openg2p_registry_partner_api.search.dci.controller import g2p_dci_controller as controller_module


class _Stub:
    def __init__(self, *args, **kwargs):
        pass


def test_dci_search_paths(monkeypatch):
    for name in ("G2PDciService", "DciRequestResponseHelper", "DciKeymanagerHelper", "DciConsentHelper"):
        monkeypatch.setattr(controller_module, name, _Stub)
    controller = controller_module.G2PDciController()
    paths = {route.path for route in controller.router.routes}
    # The prefix and the route must not both carry "registry" (/dci/registry/registry/...).
    assert {"/dci/registry/sync/search", "/dci/registry/async/search"} <= paths
    assert not any("/registry/registry/" in p for p in paths)
