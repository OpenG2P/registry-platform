from . import fixtures as _fixtures
from .legacy_names import link_fixture_aliases as _link_fixture_aliases

# A variant overlay may still define the deprecated fixture names; make both the
# current and the deprecated names resolve whichever it uses.
_link_fixture_aliases(_fixtures)
