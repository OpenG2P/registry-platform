"""Guard: a variant's fixtures overlay must satisfy the inherited harness.

WHY THIS EXISTS
    A variant registry builds its sanity image `FROM` this one and overwrites a
    few files — typically `sanity/fixtures.py`, `sanity/data_seed.py` and the two
    field tests. Everything else (`sanity/dci.py`, `sanity/awe_seed.py`,
    `sanity/keycloak_seed.py`, `conftest.py`, the Set 1 tests) is INHERITED and
    still imports `fixtures.<SYMBOL>`.

    So `fixtures.py` is not a private file — it is a CONTRACT. Renaming a symbol
    in an overlay (e.g. RECORD_FOUNDATIONAL_ID -> INDIVIDUAL_FOUNDATIONAL_ID)
    leaves the inherited modules referencing a name that no longer exists, and
    every e2e test dies with `AttributeError: module 'sanity.fixtures' has no
    attribute ...` at collection time.

    That is a packaging error, not a registry defect, and it should be caught by
    the suite itself rather than in a cluster. This test resolves every
    `fixtures.<SYMBOL>` reference in the assembled image against the fixtures
    module actually present.

    The contract names are RECORD_*: "the seeded sanity record", carrying
    whatever register the variant deploys. The pre-rename names
    (sanity/legacy_names.py FIXTURE_ALIASES) are still honoured as deprecated
    aliases — defining either name of a pair satisfies the contract, and
    sanity/__init__.py makes both resolve at import time.
"""

import ast
import pathlib

import pytest

from sanity import fixtures
from sanity.legacy_names import FIXTURE_ALIASES

APP = pathlib.Path(__file__).resolve().parent.parent


def _defined() -> set:
    src = (APP / "sanity" / "fixtures.py").read_text()
    names = set()
    for node in ast.parse(src).body:
        if isinstance(node, ast.Assign):
            names |= {t.id for t in node.targets if isinstance(t, ast.Name)}
        elif isinstance(node, ast.FunctionDef):
            names.add(node.name)
    # Either name of a (deprecated, current) pair satisfies the other.
    for old, new in FIXTURE_ALIASES.items():
        if old in names or new in names:
            names |= {old, new}
    return names


def _referenced() -> dict:
    """{symbol: [files that reference it]} across the whole assembled image.

    Parsed with ast, not regex: a comment or docstring mentioning "fixtures.py"
    is prose, not a reference, and must not be reported as a missing symbol.
    """
    refs = {}
    for path in APP.rglob("*.py"):
        if "__pycache__" in str(path) or path.name == "fixtures.py":
            continue
        try:
            tree = ast.parse(path.read_text())
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if (isinstance(node, ast.Attribute)
                    and isinstance(node.value, ast.Name)
                    and node.value.id == "fixtures"):
                refs.setdefault(node.attr, []).append(str(path.relative_to(APP)))
    return refs


@pytest.mark.smoke
def test_fixtures_overlay_satisfies_the_inherited_harness():
    """Every fixtures.<SYMBOL> used in this image must exist in sanity.fixtures."""
    defined, referenced = _defined(), _referenced()
    missing = {s: f for s, f in referenced.items() if s not in defined}
    assert not missing, (
        "sanity/fixtures.py does not satisfy the inherited harness. Missing "
        f"{sorted(missing)}.\n"
        + "\n".join(f"  {s} is referenced by {', '.join(f)}" for s, f in sorted(missing.items()))
        + "\n\nA variant overlay must KEEP the platform's fixture symbol names "
        "(RECORD_*, ...) — the inherited modules import them by name. Change the "
        "values, not the names."
    )
    # and the module really imports (catches syntax/typo breaks early)
    for sym in referenced:
        assert hasattr(fixtures, sym), f"sanity.fixtures has no attribute {sym!r}"


@pytest.mark.smoke
def test_deprecated_fixture_names_resolve_to_the_current_ones():
    """Deprecated fixture names and current names resolve to the same values."""
    for old, new in FIXTURE_ALIASES.items():
        assert getattr(fixtures, old) == getattr(fixtures, new), (
            f"sanity.fixtures.{old} (deprecated) and .{new} differ"
        )
