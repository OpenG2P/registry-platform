"""Unit tests for mapping intake form sections onto register tab/section history."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

_CORE_SRC = Path(__file__).resolve().parents[1] / "src" / "openg2p_registry_core"
_SERVICE_PATH = _CORE_SRC / "services" / "g2p_intake_register_section_map_service.py"


def _ensure_pkg(name: str) -> ModuleType:
    if name not in sys.modules:
        mod = ModuleType(name)
        mod.__path__ = []  # type: ignore[attr-defined]
        sys.modules[name] = mod
    return sys.modules[name]


def _load_map_service_module():
    core = _ensure_pkg("openg2p_registry_core")
    core.__path__ = [str(_CORE_SRC)]  # type: ignore[attr-defined]

    models = _ensure_pkg("openg2p_registry_core.models")
    models.G2PIntakeFormUITab = object
    models.G2PIntakeFormUITabSection = object
    models.G2PRegisterSection = object
    models.G2PRegisterUITabSection = object

    services_pkg = _ensure_pkg("openg2p_registry_core.services")
    services_pkg.__path__ = [str(_CORE_SRC / "services")]  # type: ignore[attr-defined]

    fastapi_service = _ensure_pkg("openg2p_fastapi_common.service")

    class BaseService:
        def __init__(self, name=""):
            self.name = name

    fastapi_service.BaseService = BaseService

    if "sqlalchemy" not in sys.modules:
        sqlalchemy = _ensure_pkg("sqlalchemy")
        sqlalchemy.select = lambda *args, **kwargs: None

    spec = importlib.util.spec_from_file_location(
        "openg2p_registry_core.services.g2p_intake_register_section_map_service",
        _SERVICE_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


_mod = _load_map_service_module()
G2PIntakeRegisterSectionMapService = _mod.G2PIntakeRegisterSectionMapService
IntakeRegisterSectionMapping = _mod.IntakeRegisterSectionMapping


def _section(**kwargs):
    defaults = {
        "section_id": "farmer_crop_crop_details_section_01",
        "section_mnemonic": "crop_details",
        "section_register_id": "5fa096f8-crop-register",
        "is_list": True,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _mapping(**kwargs):
    intake = kwargs.pop("intake_section", _section(section_id="a7d69d0c-intake-crop"))
    register = kwargs.pop("register_section", _section())
    fields = {
        "intake_section_id": intake.section_id,
        "intake_section": intake,
        "register_tab_id": "farmer_crop_tab",
        "register_section_id": register.section_id,
        "register_section": register,
        "section_register_id": register.section_register_id,
        "needs_transform": True,
    }
    fields.update(kwargs)
    return IntakeRegisterSectionMapping(**fields)


def test_transform_records_copies_when_same_section():
    mapping = _mapping(needs_transform=False)
    records = [{"crop_name": "teff", "section_id": "keep-me"}]
    assert G2PIntakeRegisterSectionMapService().transform_records(mapping, records) == records


def test_transform_records_drops_form_only_keys():
    mapping = _mapping(needs_transform=True)
    transformed = G2PIntakeRegisterSectionMapService().transform_records(
        mapping,
        [{"crop_name": "teff", "section_id": "intake", "submission_id": "sub-1"}],
    )
    assert transformed == [{"crop_name": "teff"}]


def test_pick_payload_prefers_register_section_id():
    mapping = _mapping()
    payloads = [
        {"section_id": mapping.intake_section_id, "records": [1]},
        {"section_id": mapping.register_section_id, "records": [2]},
        {"section_register_id": mapping.section_register_id, "records": [3]},
    ]
    picked = G2PIntakeRegisterSectionMapService().pick_submission_section_payload(
        mapping, payloads
    )
    assert picked["records"] == [2]


def test_pick_payload_falls_back_to_intake_section_then_child_register():
    mapping = _mapping()
    service = G2PIntakeRegisterSectionMapService()
    by_intake = service.pick_submission_section_payload(
        mapping,
        [{"section_id": mapping.intake_section_id, "records": ["intake"]}],
    )
    assert by_intake["records"] == ["intake"]

    by_child = service.pick_submission_section_payload(
        mapping,
        [{"section_register_id": mapping.section_register_id, "records": ["child"]}],
    )
    assert by_child["records"] == ["child"]


def test_pick_register_section_unique_and_mnemonic():
    service = G2PIntakeRegisterSectionMapService()
    intake = _section(section_id="intake", section_mnemonic="crop_details")
    only = (_section(), "tab-a")
    assert service._pick_register_section(intake, [only]) == only

    crop = (_section(section_mnemonic="crop_details"), "crop-tab")
    other = (_section(section_id="other", section_mnemonic="other"), "other-tab")
    assert service._pick_register_section(intake, [other, crop]) == crop


def test_pick_register_section_ambiguous_returns_none():
    service = G2PIntakeRegisterSectionMapService()
    intake = _section(section_mnemonic="same", is_list=True)
    left = (_section(section_id="a", section_mnemonic="same", is_list=True), "t1")
    right = (_section(section_id="b", section_mnemonic="same", is_list=True), "t2")
    assert service._pick_register_section(intake, [left, right]) is None
