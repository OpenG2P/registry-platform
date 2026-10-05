"""Deprecated pre-rename names of the sanity fixture contract.

The suite was extracted from the farmer registry, and its fixture symbols, the
`farmer_seeded` pytest fixture, `cfg.farmer_register_id` and the
SANITY_FARMER_REGISTER_ID env were named after it. They are now registry-neutral
(RECORD_*, `record_seeded`, `cfg.register_id`, SANITY_REGISTER_ID). The old names
are kept ONLY so a variant overlay written against them keeps working; new code
must use the new names. Remove once no overlay uses them.
"""

# Deprecated fixture symbol -> current fixture symbol.
FIXTURE_ALIASES = {
    "FARMER": "RECORD",
    "FARMER_INTERNAL_ID": "RECORD_INTERNAL_ID",
    "FARMER_FUNCTIONAL_ID": "RECORD_FUNCTIONAL_ID",
    "FARMER_FOUNDATIONAL_ID": "RECORD_FOUNDATIONAL_ID",
}

# Deprecated env var for Config.register_id, read when SANITY_REGISTER_ID is unset.
REGISTER_ID_ENV = "SANITY_FARMER_REGISTER_ID"


def link_fixture_aliases(fixtures) -> None:
    """Make every current fixture symbol and its deprecated alias both resolve.

    A variant overlay replaces sanity/fixtures.py wholesale, so it may define
    either name. Whichever it defines is mirrored onto the other, so the
    inherited modules (current names) and older overlay modules (deprecated
    names) see the same values.
    """
    for old, new in FIXTURE_ALIASES.items():
        if hasattr(fixtures, new) and not hasattr(fixtures, old):
            setattr(fixtures, old, getattr(fixtures, new))
        elif hasattr(fixtures, old) and not hasattr(fixtures, new):
            setattr(fixtures, new, getattr(fixtures, old))
