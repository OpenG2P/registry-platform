#!/usr/bin/env python3
"""Generate a registry's reporting views from its own schema.

Why this exists
---------------
Every registry hand-writes a `reporting_views.sql`. The Farmer Registry's is 468
lines, the National Social Registry's 272, and the block that unpacks geography —
the one part that is pure platform mechanics, identical in intent, deliberately
country-agnostic — appears in both and has already DRIFTED between them. That is
the signature of a missing shared layer, and it is the reason a new registry
starts its reporting from a blank file.

It also fails quietly in a worse way: a hand-written file covers the entities
somebody thought of. The Farmer Registry gave views to farmer, land and crop, and
rolled livestock up into a boolean. So "how many farmers keep livestock" had an
answer and "how many cattle versus goats" had none — not because anyone decided
it did not matter, but because a node of the entity tree was skipped and nothing
checks for that.

What is generated, and what is not
----------------------------------
ONLY the mechanical part. A registry's reporting layer splits cleanly in two:

  * MECHANICAL — one view per entity, at record grain, columns selected, parent
    joined for geography, workflow columns carried, personal data withheld.
    Boilerplate. This tool owns it.

  * SEMANTIC — "uses modern inputs" means fertilizer OR improved seed OR
    machinery; age bands break at 25/35/50/65; a free-text land size normalises
    to hectares. Nobody can infer those. They stay hand-written, in the
    registry's own SQL, and this tool leaves them alone: any view named in
    `custom:` is skipped entirely.

So the Farmer Registry keeps its three semantic views and stops maintaining the
other eight.

Why it can be shared at all
---------------------------
Everything it depends on belongs to the PLATFORM, not to any registry:
`g2p_register_*` table naming, `internal_record_id` / `link_internal_record_id`,
`record_status`, `created_by` / `last_approved_at`, `geo_code_hierarchy_json`,
and the names personal data goes by. What varies per registry is WHICH tables
exist — read from the schema — and what the columns MEAN, which is declared.

Nothing here reads the DATA
---------------------------
The output is a function of the schema, Master Data's country pack and
reporting.yaml. Never of what has been registered — because the install that
matters most is the one with nothing in it.

That was learned the hard way, twice:

  * DEPTH came from MAX(ordinality) over a registered farmer's own hierarchy.
    On a production install, seeded empty and loaded by the country afterwards,
    there is nothing to measure: every view was created with no geo columns at
    all, and looked fine because the views existed. Depth and level labels now
    come from Master Data's g2p_geo_levels, which knows the country before the
    first record does.

  * The TREE was discovered by counting which parent a child's links resolve
    into. Same failure, same install: no rows, no edges, every entity emitted
    parentless and geography-free. The tree is now DECLARED in reporting.yaml.

Discovery still earns its keep, in two smaller roles. `--discover` runs it
against a populated environment and prints a starter `tree:` block, which is how
a new registry's declaration gets written. And `verify_tree()` checks the
declaration against the data WHERE THERE IS DATA, warning — never failing, since
an empty register has nothing to say — when they disagree.

That check matters because a wrong parent is a join returning nothing, which is
indistinguishable from an empty table. `g2p_register_scores` is the live example:
it resolved 100% to farmers in one deployment's bulk data and 100% to households
in another's sample data. It is polymorphic — it carries `register_id`, and
Master Data's register definitions name the subject. Declared, it is simply
correct; inferred, it silently returns nothing.

Withholding personal data
-------------------------
Deny by default, and verify afterwards. The deny-list is platform-level so a new
registry inherits it, the classifier is type-aware (a boolean called
`has_personal_phone` is a statistic, not a phone number), and `verify()` re-reads
the created views and FAILS if a denied column reached one. An allow-list a
planner merely respects is a convention; a column that is not in the view is a
boundary.
"""

import json
import os
import re
import sys

import psycopg2
import psycopg2.extras

# --------------------------------------------------------------------------
# Platform contract — the names RP itself defines. None of this is per-registry.
# --------------------------------------------------------------------------
TABLE_PREFIX = "g2p_register_"
HISTORY_PREFIX = "g2p_register_history_"

PK = "internal_record_id"
FK = "link_internal_record_id"
GEO_JSON = "geo_code_hierarchy_json"

# Carried on every generated view. Without these no question about the
# registration PROCESS — approval latency, what is still pending, who is
# clearing the backlog — can be answered from the reporting layer at all, even
# though the columns have been sitting on every table the whole time.
WORKFLOW = ["created_at", "record_status", "created_by",
            "last_approved_at", "last_approved_by", "record_status_reason"]

# Structural columns: needed to build the views, never selected into them.
STRUCTURAL = {PK, FK, GEO_JSON, "link_foundational_id", "register_id"}

# --------------------------------------------------------------------------
# Personal data. Deny by default.
# --------------------------------------------------------------------------
# Exact column names RP uses for identifying detail. A registry extension that
# invents its own is caught by PII_PATTERNS below; this list is what we know.
PII_COLUMNS = {
    "first_name", "middle_name", "last_name", "given_name", "prefix", "suffix",
    "record_name", "household_head", "birth_date", "phone_numbers", "emails",
    "foundational_id", "national_id", "national_id_masked", "search_text",
    "address_line_1", "address_line_2", "postal_code", "plus_code",
    "record_image_document_id", "remarks",
}

PII_PATTERNS = [
    re.compile(p) for p in (
        r"(^|_)name$", r"(^|_)phone", r"(^|_)mobile", r"(^|_)email",
        r"(^|_)address", r"(^|_)nid($|_)", r"passport", r"(^|_)dob($|_)",
        r"birth", r"(^|_)uin($|_)", r"aadhaar", r"(^|_)ssn($|_)",
    )
]

# A boolean or a count is a STATISTIC, whatever it is called. `has_personal_phone`
# is not a phone number and `number_of_female_members` is not a person; withholding
# them protects nobody and quietly removes the columns reports are actually built
# from. Only text-ish columns are matched against the patterns above.
NON_PII_TYPES = ("boolean", "smallint", "integer", "bigint", "numeric",
                 "double precision", "real")

# Free-text columns a registry may treat as notes. Never emitted: they are where
# a caseworker writes the applicant's name when there is no other box for it.
FREETEXT_TYPES = ("text",)
FREETEXT_ALLOW = {"disability_type", "score_type", "water_source", "breed",
                  "livestock_type", "livestock_system", "commodity"}

# Withheld, but an age is derived from them in its place.
AGE_SOURCES = {"birth_date", "date_of_birth"}


# Columns the registry has explicitly declared safe, via pii.allow. Checked
# FIRST and it wins outright: it used to only feed the free-text branch, which
# the pattern check short-circuits, so declaring `primary_cooperative_name` safe
# logged that it had been allowed and then withheld it anyway.
PII_ALLOW = set()


def is_pii(column: str, data_type: str, freetext_rule: bool = True) -> bool:
    """Should this column be withheld?

    `freetext_rule` turns off only the last and crudest test — "unbounded text
    with no declared meaning". Set it False for a column INHERITED from another
    view: `age_band` is text, and it is a band, because the parent view says so.
    The explicit deny-list and the patterns still apply, so inheriting
    `first_name` from a hand-written parent is still caught.
    """
    if column in PII_ALLOW:
        return False
    if column in PII_COLUMNS:
        return True
    if any(data_type.startswith(t) for t in NON_PII_TYPES):
        return False
    if any(p.search(column) for p in PII_PATTERNS):
        return True
    if not freetext_rule:
        return False
    # Unbounded free text with no declared meaning. `character varying(n)` is a
    # categorical in this schema; bare `text` is a notes field.
    if data_type in FREETEXT_TYPES and column not in FREETEXT_ALLOW:
        return True
    return False


# --------------------------------------------------------------------------
# Naming: g2p_register_livestocks -> livestock
# --------------------------------------------------------------------------
IRREGULAR = {
    "membership_details": "membership",
    "farm_inputs": "farm_input",
    "household_members": "household_member",
    "scores": "score",
    "change_requests": "change_request",
}


def entity_name(table: str) -> str:
    """The view suffix for a register table.

    Singular, because the view holds one row per thing. Overridable from
    reporting.yaml — no de-pluralisation rule survives contact with every
    language a registry might be written in.
    """
    stem = table[len(TABLE_PREFIX):]
    if stem in IRREGULAR:
        return IRREGULAR[stem]
    if stem.endswith("ies"):
        return stem[:-3] + "y"
    if stem.endswith("s") and not stem.endswith("ss"):
        return stem[:-1]
    return stem


# --------------------------------------------------------------------------
# Introspection
# --------------------------------------------------------------------------
def register_tables(cur):
    """Every register table, with its columns. Materialized views excluded —
    those are the reporting layer, not the register."""
    cur.execute("""
        SELECT c.relname AS table_name,
               a.attname AS column_name,
               format_type(a.atttypid, NULL) AS data_type
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE c.relkind = 'r' AND n.nspname = 'public'
          AND c.relname LIKE %s AND c.relname NOT LIKE %s
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY c.relname, a.attnum
    """, (TABLE_PREFIX + "%", HISTORY_PREFIX + "%"))
    out = {}
    for r in cur.fetchall():
        out.setdefault(r["table_name"], []).append((r["column_name"], r["data_type"]))
    return out


def history_tables(cur):
    cur.execute("""
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relname LIKE %s
        ORDER BY 1
    """, (HISTORY_PREFIX + "%",))
    return [r[0] for r in cur.fetchall()]


def register_definitions(cur):
    """register_id -> mnemonic, RP's own map of what each register is.

    Populated in a real install (Farmer, Household, Land, Crop, Livestock,
    FarmInputs, MembershipDetails, HouseholdMember, Score) and empty in some
    partially-seeded ones, so every use of it degrades rather than depends.
    """
    try:
        cur.execute("SELECT register_id, register_mnemonic FROM g2p_register_definitions")
        return {r[0]: r[1] for r in cur.fetchall() if r[0] and r[1]}
    except psycopg2.Error:
        return {}


def row_count(cur, table):
    cur.execute(f'SELECT count(*) FROM "{table}"')
    return cur.fetchone()[0]


# --------------------------------------------------------------------------
# Discovery — which table does each child hang off?
# --------------------------------------------------------------------------
MATCH_THRESHOLD = 0.99   # a real edge resolves at 1.00; collisions at <0.01


def declared_parents(cfg, tables, log):
    """The entity tree as the registry DECLARES it.

    This is the authority, not discovery. Discovery reads the data, and a
    production registry is installed empty — so on the install that matters most
    it resolves nothing and every view loses its geography, silently. A
    declaration is a property of the registry, true before the first record
    exists and reviewable in a diff.

        tree:
          land:      {parent: farmer}
          crop:      {parent: land}
          score:     {parent: household}

    Run with --discover against a POPULATED environment to have this block
    written for you.
    """
    tree = cfg.get("tree") or {}
    by_entity = {entity_name(t): t for t in tables}
    parents, unknown = {}, []
    for entity, spec in tree.items():
        table = by_entity.get(entity)
        if not table:
            unknown.append(entity)
            continue
        names = spec.get("parent") if isinstance(spec, dict) else spec
        if names is None:
            parents[table] = []
            continue
        if isinstance(names, str):
            names = [names]
        resolved = []
        for n in names:
            if n in by_entity:
                resolved.append(by_entity[n])
            else:
                unknown.append(f"{entity}.parent={n}")
        parents[table] = resolved
    for u in unknown:
        log(f"[reporting] tree: '{u}' names no table in this registry — ignored")
    for t in tables:
        if t not in parents:
            log(f"  {entity_name(t):<24} not in tree: — emitted without a parent, "
                f"so it carries no geography")
            parents[t] = []
    return parents


def verify_tree(cur, tables, declared, log):
    """Check the declaration against the data, where there IS data.

    A declaration can be wrong, and a wrong parent is a join that quietly
    returns nothing. This does not fail the install — an empty register has
    nothing to say and must not block one — it reports.
    """
    mismatches = 0
    for table, parents in sorted(declared.items()):
        names = {c for c, _ in tables.get(table, [])}
        if FK not in names or not parents:
            continue
        cur.execute(f'SELECT count(*) FROM "{table}" WHERE {FK} IS NOT NULL')
        n = cur.fetchone()[0]
        if n == 0:
            continue
        for parent in parents:
            cur.execute(
                f'SELECT count(*) FROM "{table}" ch WHERE EXISTS '
                f'(SELECT 1 FROM "{parent}" p WHERE p.{PK} = ch.{FK})')
            share = cur.fetchone()[0] / n
            if share < MATCH_THRESHOLD:
                mismatches += 1
                log(f"[reporting] WARNING: tree says {entity_name(table)} -> "
                    f"{entity_name(parent)}, but only {share:.1%} of "
                    f"{n:,} links resolve there")
    if not mismatches:
        log("[reporting] declared tree agrees with the data")
    return mismatches


def discover_parents(cur, tables, definitions, log):
    """Resolve each child's parent by counting how many of its links land.

    There are no foreign keys to read, so the only evidence is the data. A real
    parent takes essentially every row; an unrelated table whose ids happen to
    overlap takes a handful. Between those two the gap is three orders of
    magnitude, which is what makes this safe to automate.

    An EMPTY child yields no evidence at all. It is reported and skipped rather
    than guessed at — a view built on a guessed join is worse than no view,
    because it looks like it works.
    """
    parents = {}
    candidates = [t for t, cols in tables.items()
                  if any(c == PK for c, _ in cols)]

    for child, cols in sorted(tables.items()):
        names = {c for c, _ in cols}
        if FK not in names:
            continue
        cur.execute(f'SELECT count(*) FROM "{child}" WHERE {FK} IS NOT NULL')
        n = cur.fetchone()[0]
        if n == 0:
            log(f"  {entity_name(child):<20} no linked rows — cannot resolve a "
                f"parent from data; view will be emitted without one")
            parents[child] = []
            continue

        hits = []
        for parent in candidates:
            if parent == child:
                continue
            cur.execute(
                f'SELECT count(*) FROM "{child}" ch WHERE EXISTS '
                f'(SELECT 1 FROM "{parent}" p WHERE p.{PK} = ch.{FK})')
            matched = cur.fetchone()[0]
            if matched / n >= MATCH_THRESHOLD:
                hits.append((parent, matched / n))

        if not hits:
            log(f"  {entity_name(child):<20} links resolve nowhere — treating as a root")
            parents[child] = []
        elif len(hits) == 1:
            parents[child] = [hits[0][0]]
            log(f"  {entity_name(child):<20} -> {entity_name(hits[0][0])} "
                f"({n:,} rows, {hits[0][1]:.0%})")
        else:
            # More than one table takes every row. Either genuinely polymorphic
            # (scores hang off farmers in one deployment and households in
            # another) or one candidate is a superset of the other. Emit all of
            # them as LEFT JOINs with a discriminator; do NOT pick.
            parents[child] = [h[0] for h in hits]
            log(f"  {entity_name(child):<20} -> AMBIGUOUS: "
                f"{', '.join(entity_name(h[0]) for h in hits)} "
                f"— emitting a LEFT JOIN per candidate")
    return parents


def resolve_polymorphic(cur, child, cols, definitions, log):
    """Use the child's own register_id to name its subject, when it has one.

    This is the declarative answer to the ambiguity above, and it is why a score
    knows it belongs to a household even though the link column cannot say so.
    """
    if not definitions or not any(c == "register_id" for c, _ in cols):
        return None
    cur.execute(f'SELECT DISTINCT register_id FROM "{child}" WHERE register_id IS NOT NULL')
    ids = [r[0] for r in cur.fetchall()]
    mnemonics = sorted({definitions[i] for i in ids if i in definitions})
    if mnemonics:
        log(f"  {entity_name(child):<20} register_id says: {', '.join(mnemonics)}")
    return mnemonics or None


# --------------------------------------------------------------------------
# Which tables are entity nodes?
# --------------------------------------------------------------------------
# A node is either a CHILD of something (it carries a link) or a geo-carrying
# ROOT. Everything else under g2p_register_* is configuration — definitions,
# schemas, UI tabs, sections — or process, handled separately below.
#
# Deliberately NOT keyed on `record_status`: g2p_register_scores has none, and a
# status-based rule silently drops score distributions from every registry's
# reporting. Skipped tables are logged with the reason, never dropped in silence.
def is_entity(cols) -> bool:
    names = {c for c, _ in cols}
    return PK in names and (FK in names or GEO_JSON in names)


# The process tables. Named explicitly because they are PLATFORM concepts, not
# registry content — every registry built on RP has exactly these.
CHANGE_REQUESTS = TABLE_PREFIX + "change_requests"

# Generous on purpose: this set decides which BASE columns are skipped because
# geography is handled separately, so it must cover more levels than any pack is
# likely to declare. The emitted columns are bounded by the MDS depth, not by
# this.
MAX_LEVELS = 10
GEO_COLS = ([f"geo_{i}" for i in range(1, MAX_LEVELS + 1)] +
            [f"geo_{i}_id" for i in range(1, MAX_LEVELS + 1)] +
            ["geo_lowest_level_value_id"])


def mds_geo_levels(log):
    """This country's hierarchy, from MASTER DATA — the service that defines it.

    Depth used to be read from the registry's own rows, as MAX(ordinality) over
    geo_code_hierarchy_json. That works on a demo install and fails silently on
    the one that matters: a production registry is installed EMPTY, the country
    loads its register afterwards, and at install time there are no rows to
    measure. Every view came out with no geo columns at all — and looked fine,
    because the views existed.

    Master Data holds the country pack and is seeded before the registry (the
    db-seed job depends on it), so it always knows the answer, whether or not a
    single record has been registered.

    Ordered by walking parent -> child, never by level_id: the ids are opaque
    and their sort order is not the hierarchy.
    """
    host = os.environ.get("MDS_PGHOST") or os.environ.get("PGHOST", "localhost")
    try:
        conn = psycopg2.connect(
            host=host,
            port=int(os.environ.get("MDS_PGPORT", os.environ.get("PGPORT", 5432))),
            dbname=os.environ.get("MDS_DB", "master_data"),
            user=os.environ.get("MDS_PGUSER", os.environ.get("PGUSER", "")),
            password=os.environ.get("MDS_PGPASSWORD", os.environ.get("PGPASSWORD")),
        )
    except psycopg2.Error as exc:
        log(f"[reporting] cannot reach Master Data at {host}: {exc}")
        return []
    try:
        with conn.cursor() as c:
            c.execute("SELECT level_id, level_mnemonic, parent_level_id "
                      "FROM g2p_geo_levels")
            rows = c.fetchall()
    except psycopg2.Error as exc:
        log(f"[reporting] Master Data has no geo hierarchy: {exc}")
        return []
    finally:
        conn.close()

    by_parent = {}
    for level_id, mnemonic, parent in rows:
        by_parent.setdefault(parent, []).append((level_id, mnemonic))
    order, cursor = [], None
    while by_parent.get(cursor):
        level_id, mnemonic = by_parent[cursor][0]
        order.append(mnemonic)
        cursor = level_id
    return order


def view_columns(cur, view) -> set:
    cur.execute("""
        SELECT a.attname FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE c.relname = %s AND a.attnum > 0 AND NOT a.attisdropped
    """, (view,))
    return {r[0] for r in cur.fetchall()}


def geo_select(depth, alias, available):
    """Geo columns to carry, intersected with what the parent actually exposes."""
    wanted = ([f"geo_{i}" for i in range(1, depth + 1)] +
              [f"geo_{i}_id" for i in range(1, depth + 1)] +
              ["geo_lowest_level_value_id"])
    return [f"{alias}.{c}" for c in wanted if c in available]


def geo_cte(table, depth):
    """Unpack this table's own hierarchy, BY POSITION.

    Never by level name: "region" is Ethiopian. Position is the only thing that
    means the same in every country pack, and fr_rpt_geo_levels carries the
    deployment's own labels for whoever has to title a column.
    """
    lines = [f"        x.{PK} AS _id"]
    for i in range(1, depth + 1):
        lines.append(f"        MAX(CASE WHEN t.ordinality = {i} THEN t.elem ->> "
                     f"'level_value_mnemonic' END) AS geo_{i}")
    for i in range(1, depth + 1):
        lines.append(f"        MAX(CASE WHEN t.ordinality = {i} THEN t.elem ->> "
                     f"'level_value_id' END) AS geo_{i}_id")
    body = ",\n".join(lines)
    return (f"WITH _geo AS (\n    SELECT\n{body}\n"  # noqa: the "WITH " is
            # stripped by the caller so this can be one CTE among several.
            f"    FROM \"{table}\" x,\n"
            f"         LATERAL jsonb_array_elements(x.{GEO_JSON} -> 'hierarchy')\n"
            f"                 WITH ORDINALITY AS t(elem, ordinality)\n"
            f"    WHERE x.{GEO_JSON} IS NOT NULL\n"
            f"    GROUP BY x.{PK}\n)")


# --------------------------------------------------------------------------
# Emission
# --------------------------------------------------------------------------
ALIAS_RE = re.compile(r"\bAS\s+([A-Za-z_][A-Za-z0-9_]*)\s*$")


def select_names(select):
    """The column names a SELECT list will produce.

    Needed because a child has to know its parent's columns before the parent
    exists. Reading them back off the created view would be more truthful, but
    the views are created in one batch — so this has to agree with what Postgres
    will do, which is: the AS alias if there is one, otherwise the last
    dot-separated identifier.
    """
    out = set()
    for expr in select:
        line = expr.strip().rstrip(",")
        # Drop any comment lines carried inside the expression.
        line = "\n".join(l for l in line.splitlines()
                          if not l.strip().startswith("--")).strip()
        m = ALIAS_RE.search(line)
        if m:
            out.add(m.group(1))
        else:
            out.add(line.rsplit(".", 1)[-1])
    return out


def drop_stmt(view: str) -> str:
    """Drop the view whichever kind it currently is.

    `DROP VIEW IF EXISTS` and `DROP MATERIALIZED VIEW IF EXISTS` are not
    interchangeable: IF EXISTS suppresses "does not exist", not "is not a
    materialized view". Issuing both in turn therefore FAILS on exactly the
    transition this tool is built to allow — a deployment that starts with a
    plain view and later declares it materialized, or the reverse when a country
    decides the refresh is not worth it.
    """
    return (
        f"DO $$ BEGIN\n"
        f"  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n "
        f"ON n.oid = c.relnamespace WHERE c.relname = '{view}' "
        f"AND n.nspname = 'public' AND c.relkind = 'm') THEN\n"
        f"    EXECUTE 'DROP MATERIALIZED VIEW {view} CASCADE';\n"
        f"  ELSIF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n "
        f"ON n.oid = c.relnamespace WHERE c.relname = '{view}' "
        f"AND n.nspname = 'public' AND c.relkind = 'v') THEN\n"
        f"    EXECUTE 'DROP VIEW {view} CASCADE';\n"
        f"  END IF;\nEND $$;\n")


# Aggregates a roll-up may declare. `any`/`all` map to bool_or/bool_and because
# "does this farmer hold any titled parcel" is the shape these questions come in.
AGGREGATES = {"count": None, "sum": "sum", "max": "max", "min": "min",
              "avg": "avg", "any": "bool_or", "all": "bool_and"}


def rollup_cte(child_table, child_cols, spec, log, label):
    """Summarise a child onto its parent — "parcels per farmer", "head of
    livestock per holding".

    Reads the child's BASE TABLE, never the child's view. That is not an
    optimisation, it is what keeps the views acyclic: a child view already
    references its parent for geography, so a parent view reading the child view
    back would be two views defined in terms of each other, which Postgres will
    simply refuse to create.

    The cost is that a roll-up sees RAW columns — it can sum a stored area but
    not one normalised to hectares by the child's own view. Normalise inside the
    expression, or do it in the registry's own SQL.
    """
    parts = []
    for agg, decl in spec.items():
        if agg == "count":
            parts.append(f"count(*) AS {decl}")
            continue
        fn = AGGREGATES.get(agg)
        if not fn:
            log(f"    ! {label}: unknown aggregate '{agg}' — ignored")
            continue
        for source, alias in (decl or {}).items():
            typ = child_cols.get(source)
            if typ is None:
                log(f"    ! {label}: rollup {agg}({source}) — no such column on "
                    f"{child_table}; ignored")
                continue
            # Checked here so the failure names the declaration. Left to
            # Postgres it surfaces at CREATE time as "function bool_or(integer)
            # does not exist", which says nothing about which line of which
            # reporting.yaml to go and fix.
            if agg in ("any", "all") and typ != "boolean":
                log(f"    ! {label}: rollup {agg}({source}) needs a boolean, "
                    f"but {source} is {typ}; ignored")
                continue
            if agg in ("sum", "avg") and not any(
                    typ.startswith(x) for x in NON_PII_TYPES):
                log(f"    ! {label}: rollup {agg}({source}) needs a number, "
                    f"but {source} is {typ}; ignored")
                continue
            parts.append(f"{fn}({source}) AS {alias}")
    if not parts:
        return None, []
    body = ",\n           ".join(parts)
    # record_status is filtered here and only here: a withdrawn parcel should not
    # be counted in a farmer's holding, but the parcel's own row still belongs in
    # the parcel view so somebody can see that it was withdrawn.
    active = ""
    return (f"    SELECT {FK} AS _id,\n           {body}\n"
            f"    FROM \"{child_table}\"\n    WHERE {FK} IS NOT NULL{active}\n"
            f"    GROUP BY 1"), [a.rsplit(" AS ", 1)[1] for a in parts]


def materialization(view, id_col, spec, log):
    """Plain view, or materialized with the indexes to make it refreshable.

    Plain by default: a view has no snapshot, so it is always current and costs
    nothing to maintain. Materialize only where measurement says to — a registry
    with 30 million livestock records may well need it, one with 130,000 does
    not, and that is a deployment fact rather than a platform one.

    A unique index on the id is not optional for a materialized view: without it
    REFRESH ... CONCURRENTLY is rejected, and a plain REFRESH takes a lock that
    stops every dashboard reading it for the duration.
    """
    if not spec:
        return "VIEW", ""
    idx = [f'CREATE UNIQUE INDEX {view}_pk ON {view} ({id_col});']
    for columns in (spec.get("indexes") if isinstance(spec, dict) else []) or []:
        cols = ", ".join(columns)
        idx.append(f'CREATE INDEX {view}_{"_".join(columns)} ON {view} ({cols});')
    log(f"    {view}: MATERIALIZED, {len(idx)} index(es)")
    return "MATERIALIZED VIEW", "\n".join(idx) + "\n"


def emit_entity(cur, table, cols, parents, prefix, custom, definitions, log,
                withheld, pending, depth, cfg_derived, cfg_matview,
                cfg_rollups, by_entity, all_cols, cfg_inherit, cfg_filter,
                inherited):
    """One view, one row per record of this entity."""
    name = entity_name(table)
    view = prefix + name
    id_col = f"{name}_id"

    names = {c for c, _ in cols}
    select = [f"    e.{PK} AS {id_col}"]

    # --- geography -------------------------------------------------------
    cte, joins = "", []
    join_aliases = set()
    parent_tables = parents.get(table) or []
    if GEO_JSON in names:
        # A root: it carries its own hierarchy.
        if depth:
            cte = geo_cte(table, depth) + "\n"
            joins.append(f"LEFT JOIN _geo g ON g._id = e.{PK}")
            select += [f"    g.{c}" for c in
                       [f"geo_{i}" for i in range(1, depth + 1)] +
                       [f"geo_{i}_id" for i in range(1, depth + 1)]]
        if "geo_lowest_level_value_id" in names:
            select.append(f"    e.geo_lowest_level_value_id")

    for n, ptable in enumerate(parent_tables):
        pname = entity_name(ptable)
        pview = prefix + pname
        # Generated views are all created in one batch at the end, so a parent
        # generated in THIS run is not in the database yet. Consulting only the
        # catalog silently skipped every child of a generated parent — the
        # household branch vanished entirely, reported as "parent does not
        # exist" for a view about to be created three statements later.
        pcols = pending.get(pview) or view_columns(cur, pview)
        if not pcols:
            log(f"    ! {view}: parent view {pview} does not exist — "
                f"skipping, it must be created first")
            return None
        alias = f"p{n}" if len(parent_tables) > 1 else "p"
        needs_geo = (n == 0 and GEO_JSON not in names)
        # With more than one candidate the join is the only way to tell which
        # parent a row actually belongs to: the link column holds one value, so
        # every candidate id would come out identical and the discriminator
        # below would name whichever arm was written first.
        if needs_geo or len(parent_tables) > 1:
            # LEFT, always. An inner join against a polymorphic parent returns
            # nothing at all and looks exactly like an empty table.
            joins.append(f"LEFT JOIN {pview} {alias} ON {alias}.{pname}_id = e.{FK}")
            join_aliases.add("__joined__")
            select.append(f"    {alias}.{pname}_id")
        else:
            # No join at all: the parent's id IS the link column. Joining for it
            # costs a hash join per row and, worse, makes every child depend on
            # its parent's VIEW — which forbids the parent from ever rolling
            # figures up from the child, because the two views would reference
            # each other.
            select.append(f"    e.{FK} AS {pname}_id")
        # Geography is INHERITED from the parent, never re-derived: a livestock
        # record has no hierarchy of its own, it is wherever its parcel is.
        # Deriving it twice is a second chance to disagree with the parent.
        if needs_geo:
            select += [f"    {c}" for c in geo_select(depth, alias, pcols)]

        # Attributes carried down from the parent. A crop is grown on a parcel,
        # so "crop mix by tenure" is a question about the crop row — and without
        # this the answer needs a join every chart has to remember to write.
        #
        # Requires the parent's VIEW, so it forces the join back even where the
        # id alone would have done.
        for spec in (cfg_inherit.get(name) or {}).get(pname, []) or []:
            # `land_ownership_type` to keep the name, or `{land_size_ha:
            # parcel_land_size_ha}` to rename it — the rename matters because the
            # same column means something different once it is on a child row.
            if isinstance(spec, dict):
                source, target = next(iter(spec.items()))
            else:
                source = target = spec
            if source not in pcols:
                log(f"    ! {view}: inherit {pname}.{source} — no such column "
                    f"on {pview}; ignored")
                continue
            if "__joined__" not in join_aliases:
                joins.append(f"LEFT JOIN {pview} {alias} "
                             f"ON {alias}.{pname}_id = e.{FK}")
                join_aliases.add("__joined__")
            inherited.add(target)
            select.append(f"    {alias}.{source}"
                          + (f" AS {target}" if target != source else ""))

    if len(parent_tables) > 1:
        # Which parent actually matched, so a chart can group by it and a reader
        # can see that the answer differs per row.
        arms = " ".join(
            f"WHEN p{n}.{entity_name(t)}_id IS NOT NULL THEN '{entity_name(t)}'"
            for n, t in enumerate(parent_tables))
        select.append(f"    (CASE {arms} END) AS subject_entity")

    # --- workflow and payload -------------------------------------------
    for c in WORKFLOW:
        if c in names:
            select.append(f"    e.{c}")

    for col, typ in cols:
        if col in STRUCTURAL or col in WORKFLOW or col in GEO_COLS:
            continue
        if col == "functional_record_id":
            select.append(f"    e.{col}")
            continue
        if is_pii(col, typ):
            withheld.setdefault(view, []).append(col)
            # Withholding a birth date without replacing it throws away the
            # analytic value along with the identifier: nobody can report on a
            # population's age. Age in whole years is a derivation, not a
            # judgement — where the BANDS fall is the country's call and stays
            # in the registry's own SQL.
            if col in AGE_SOURCES:
                select.append(f"    date_part('year', age(e.{col}))::int AS age")
            continue
        select.append(f"    e.{col}")

    # Roll-ups: figures summarised UP from this entity's children.
    ctes = [cte[len("WITH "):].rstrip()] if cte else []
    for child_entity, spec in (cfg_rollups.get(name) or {}).items():
        child_table = by_entity.get(child_entity)
        if not child_table:
            log(f"    ! {view}: rollup from '{child_entity}' names no table "
                f"— ignored")
            continue
        body, aliases = rollup_cte(
            child_table, dict(all_cols.get(child_table, [])), spec, log, view)
        if not body:
            continue
        cname = f"_roll_{child_entity}"
        ctes.append(f"{cname} AS (\n{body}\n)")
        joins.append(f"LEFT JOIN {cname} ON {cname}._id = e.{PK}")
        for alias in aliases:
            # COALESCE on counts: a farmer with no parcels has none, not an
            # unknown number, and NULL would drop them out of every sum and
            # average downstream.
            zero = alias in (spec.get("count"), ) or "count" in alias
            select.append(f"    COALESCE({cname}.{alias}, 0) AS {alias}"
                          if zero else f"    {cname}.{alias}")

    # A row filter, declared. RP marks superseded records rather than deleting
    # them, so a reporting view that does not filter counts a parcel and the
    # correction that replaced it as two parcels. Which statuses count is the
    # registry's call — some want the withdrawn rows visible.
    where = cfg_filter.get(name)
    where_sql = f"\nWHERE {where}" if where else ""

    prelude = ("WITH " + ",\n".join(ctes) + "\n") if ctes else ""

    names_out = select_names(select)
    base = (f'{prelude}SELECT\n' + ",\n".join(select) +
            f'\nFROM "{table}" e\n' + "\n".join(joins) + where_sql)

    # Derived columns, declared by the registry, wrapped AROUND the base select.
    #
    # Wrapped rather than appended because SQL will not let a select-list
    # expression reference another expression's alias: `age_band` is written in
    # terms of `age`, and `age` is itself derived from a birth date the view does
    # not expose. Inside a subquery it is just a column.
    derived = (cfg_derived.get(name) or {})
    if derived:
        for alias in derived:
            if alias in names_out:
                log(f"    ! {view}: derived '{alias}' collides with a real "
                    f"column — the declaration is ignored")
        cols = ",\n".join(f"    {expr} AS {alias}"
                           for alias, expr in derived.items()
                           if alias not in names_out)
        if cols:
            base = f"SELECT _b.*,\n{cols}\nFROM (\n{base}\n) _b"
            names_out |= {a for a in derived if a not in names_out}

    kind, index_sql = materialization(view, id_col, cfg_matview.get(name), log)
    sql = (drop_stmt(view) +
           f'CREATE {kind} {view} AS\n{base};\n{index_sql}')
    pending[view] = names_out
    return view, sql


def emit_change_requests(cur, cols, prefix, log):
    """The registration PROCESS, not the register.

    Approval throughput, backlog and latency. The rows were always there and no
    registry's reporting layer had ever touched them, so how long approval takes
    was unanswerable from a dashboard while being plainly visible in the table.
    """
    names = {c for c, _ in cols}
    view = prefix + "change_request"
    select = ["    e.change_request_id"]
    for col, typ in cols:
        if col in ("change_request_id",) or is_pii(col, typ):
            continue
        select.append(f"    e.{col}")
    if {"approved_at", "created_at"} <= names:
        select.append(
            "    -- NULL while pending, which is the honest answer: a pending\n"
            "    -- request has no approval time, and calling it zero flatters\n"
            "    -- every average built on it.\n"
            "    CASE WHEN e.approved_at IS NOT NULL\n"
            "         THEN round(EXTRACT(EPOCH FROM (e.approved_at - e.created_at))\n"
            "                    / 3600.0, 2)\n"
            "    END AS approval_hours")
        select.append("    (e.approved_at IS NULL) AS is_pending")
    return view, (drop_stmt(view) +
                  f'CREATE VIEW {view} AS\nSELECT\n' + ",\n".join(select) +
                  f'\nFROM "{CHANGE_REQUESTS}" e;\n')


def emit_history(cur, tables, prefix, log):
    """One view across every entity's history, not one per entity.

    The history tables share their shape exactly, and somebody asking "what
    changed last month" wants one answer rather than a UNION they have to write.
    `entity` keeps the per-type breakdown one GROUP BY away.
    """
    if not tables:
        return None
    common = None
    for t in tables:
        c = view_columns(cur, t)
        common = c if common is None else (common & c)
    wanted = [c for c in ("history_record_id", PK, "change_request_id",
                          "submission_id", "change_request_source", "created_at",
                          "created_by", "approved_at", "approved_by",
                          "record_status") if c in common]
    if PK not in wanted:
        log("    ! history tables share no record id — skipping the history view")
        return None
    # Alias the record id in EVERY arm, not just the first: a UNION takes its
    # column names from the leading SELECT, so aliasing once works and then
    # silently stops working the day someone reorders the arms.
    sel = ", ".join(f"{c} AS record_id" if c == PK else c for c in wanted)
    arms = []
    for t in tables:
        ent = entity_name(t.replace(HISTORY_PREFIX, TABLE_PREFIX))
        cast = "::text" if not arms else ""
        arms.append(f"    SELECT '{ent}'{cast} AS entity, {sel}\n      FROM \"{t}\"")
    view = prefix + "record_history"
    return view, (drop_stmt(view) +
                  f'CREATE VIEW {view} AS\n' +
                  "\n    UNION ALL\n".join(arms) + ";\n")


def emit_geo_levels(levels, prefix):
    """This deployment's level names, so a dashboard can title geo_1..geo_N.

    From MDS, not from the register. The hand-written version derived these by
    unpacking a farmer's own hierarchy, so an empty registry produced an empty
    lookup and nothing could name its own columns.

    A view over VALUES rather than a table: it is four rows of metadata, it must
    exist before any data does, and nothing should have to refresh it.
    """
    if not levels:
        return None
    rows = ",\n".join(f"        ({i + 1}, {sql_literal(m)})"
                       for i, m in enumerate(levels))
    view = prefix + "geo_levels"
    return view, (
        drop_stmt(view) +
        f'CREATE VIEW {view} AS\n'
        f'    SELECT * FROM (VALUES\n{rows}\n'
        f'    ) AS t(depth, level_name);\n')


def sql_literal(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


# --------------------------------------------------------------------------
# Layer 2 — what the registry declares
# --------------------------------------------------------------------------
def load_config(path, log):
    """The registry's own declarations. Everything here is optional.

    Kept deliberately small: the point of this tool is that a registry declares
    what cannot be inferred and nothing else.

      prefix:  fr_rpt_               view name prefix
      custom:  [farmer, land, crop]  hand-written; do not generate these
      views:   {farm_inputs: input}  override a derived entity name
      pii:
        deny:  [caregiver_notes]     withhold as well
        allow: [cooperative_name]    a false positive from the classifier

      materialized:                  plain views by default; materialize where
        livestock:                   measurement says to, and declare the
          indexes: [[livestock_type]]  indexes charts group by
      derived:                       computed columns, in the registry's own
        household_member:            terms — the generator cannot know where a
          age_band: "CASE WHEN ..."  country's age bands fall
      inherit:                       parent attributes carried DOWN
        crop:                        onto the child row
          land: [farming_type, {land_size_ha: parcel_land_size_ha}]
      filter:                        which rows belong in the view at all
        crop: "e.record_status = 'ACTIVE'"
      rollups:                       figures summarised UP from a child
        farmer:
          land:
            count: parcel_count
            sum:   {land_size: total_land}
            any:   {has_title_certificate: has_any_title}
    """
    if not path or not os.path.isfile(path):
        return {}
    try:
        import yaml
        with open(path) as fh:
            cfg = yaml.safe_load(fh) or {}
        log(f"[reporting] declarations from {path}")
        return cfg
    except ImportError:
        # JSON is a subset of YAML, so a JSON file still works without PyYAML.
        with open(path) as fh:
            return json.load(fh)


def apply_config(cfg, log):
    for table_stem, name in (cfg.get("views") or {}).items():
        IRREGULAR[table_stem] = name
    for c in (cfg.get("pii") or {}).get("deny") or []:
        PII_COLUMNS.add(c)
    for c in (cfg.get("pii") or {}).get("allow") or []:
        PII_ALLOW.add(c)
        PII_COLUMNS.discard(c)
        FREETEXT_ALLOW.add(c)
        if any(p.search(c) for p in PII_PATTERNS):
            log(f"[reporting] pii.allow: {c} matches a PII pattern and is being "
                f"exposed on the registry's explicit instruction")


# --------------------------------------------------------------------------
# Verification — fail-secure
# --------------------------------------------------------------------------
# Columns this tool CREATES. They have no source column and therefore nothing to
# leak: geo_3 is a level mnemonic unpacked from the hierarchy, `entity` is a
# string literal. They are typed `text` though, and the free-text rule below
# reads an untyped text column as a notes field — which is right for a base
# table and wrong for these.
SYNTHETIC = set(GEO_COLS) | {"entity", "subject_entity", "approval_hours",
                             "is_pending", "record_id", "age",
                             # The geo_levels lookup: a hierarchy level's name,
                             # which ends in _name and is nobody's name.
                             "depth", "level_name"}


def verify(cur, views, inherited, log) -> int:
    """Re-read what was actually created and refuse to pass if PII got through.

    Deliberately independent of the emitter: it inspects the CREATED objects, so
    a bug in column selection is caught by the same check as a bad declaration.
    A withheld column is only a boundary if something proves it is absent.
    """
    leaks = []
    for view in views:
        cur.execute("""
            SELECT a.attname, format_type(a.atttypid, NULL)
            FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
            WHERE c.relname = %s AND a.attnum > 0 AND NOT a.attisdropped
        """, (view,))
        for col, typ in cur.fetchall():
            if col in SYNTHETIC or col in PII_ALLOW or col.endswith("_id"):
                continue
            if is_pii(col, typ, freetext_rule=col not in inherited):
                leaks.append(f"{view}.{col} ({typ})")
    if leaks:
        log("")
        log("[reporting] FAILED — personal data reached a generated view:")
        for leak in leaks:
            log(f"[reporting]   {leak}")
        log("[reporting] Add it to pii.allow in reporting.yaml if this is "
            "deliberate; otherwise this is a bug in the generator.")
        return 1
    log(f"[reporting] verified: no withheld column reached any of the "
        f"{len(views)} generated view(s)")
    return 0


# --------------------------------------------------------------------------
def main() -> int:
    prefix = os.environ.get("REPORTING_PREFIX", "")
    if not prefix:
        print("[reporting] REPORTING_PREFIX is not set (e.g. fr_rpt_) — nothing "
              "to generate", file=sys.stderr)
        return 1
    cfg_path = os.environ.get("REPORTING_CONFIG", "/seed/reporting.yaml")
    out_path = os.environ.get("REPORTING_OUT", "")
    apply_sql = os.environ.get("REPORTING_APPLY", "true").lower() == "true"

    def log(msg):
        print(msg, file=sys.stderr)

    cfg = load_config(cfg_path, log)
    apply_config(cfg, log)
    prefix = cfg.get("prefix") or prefix
    custom = {c if c.startswith(prefix) else prefix + c
              for c in (cfg.get("custom") or [])}
    if custom:
        log(f"[reporting] hand-written, will not be generated: "
            f"{', '.join(sorted(custom))}")

    cfg_derived = cfg.get("derived") or {}
    cfg_rollups = cfg.get("rollups") or {}
    cfg_inherit = cfg.get("inherit") or {}
    cfg_filter = cfg.get("filter") or {}
    cfg_matview = cfg.get("materialized") or {}
    if isinstance(cfg_matview, list):
        # `materialized: [livestock, crop]` — the common case, no indexes beyond
        # the unique one every materialized view needs.
        cfg_matview = {name: {} for name in cfg_matview}

    conn = psycopg2.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=int(os.environ.get("PGPORT", 5432)),
        dbname=os.environ["PGDATABASE"],
        user=os.environ["PGUSER"],
        password=os.environ.get("PGPASSWORD"),
    )
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    levels = mds_geo_levels(log)
    depth = len(levels)
    if depth:
        log(f"[reporting] hierarchy from Master Data: {depth} level(s) — "
            f"{' > '.join(levels)}")
    else:
        log("[reporting] WARNING: no hierarchy from Master Data — views will "
            "carry no geography. Check MDS_PGHOST / MDS_DB.")

    tables = register_tables(cur)
    definitions = register_definitions(cur)
    log(f"[reporting] {len(tables)} register table(s); "
        f"{len(definitions)} register definition(s)")

    entities = {t: c for t, c in tables.items() if is_entity(c)}
    for t in sorted(set(tables) - set(entities)):
        if t != CHANGE_REQUESTS:
            log(f"  {t:<44} skipped: not an entity node "
                f"(no {PK}, or neither {FK} nor {GEO_JSON})")

    # --discover: propose the tree, write nothing. For authoring a new
    # registry's reporting.yaml against a POPULATED environment.
    if "--discover" in sys.argv:
        log("[reporting] discovering the entity tree from data:")
        found = discover_parents(cur, entities, definitions, log)
        for t in sorted(entities):
            resolve_polymorphic(cur, t, entities[t], definitions, log)
        print("tree:")
        for table in sorted(found):
            ps = [entity_name(x) for x in found[table]]
            value = ("null" if not ps else
                     f"{{parent: {ps[0]}}}" if len(ps) == 1 else
                     f"{{parent: [{', '.join(ps)}]}}")
            print(f"  {entity_name(table)}: {value}")
        return 0

    known = {entity_name(x) for x in entities}
    by_entity = {entity_name(x): x for x in entities}
    for block, label in ((cfg_derived, "derived"), (cfg_matview, "materialized"),
                         (cfg_rollups, "rollups"), (cfg_inherit, "inherit"),
                         (cfg_filter, "filter")):
        for name in block:
            if name not in known:
                log(f"[reporting] {label}: '{name}' names no entity in this "
                    f"registry — the declaration does nothing")

    log("[reporting] entity tree (declared):")
    parents = declared_parents(cfg, entities, log)
    for table, ps in sorted(parents.items()):
        if ps:
            log(f"  {entity_name(table):<24} -> "
                f"{', '.join(entity_name(x) for x in ps)}")
    verify_tree(cur, entities, parents, log)

    # Parents before children, so a child can read its parent view's columns.
    ordered, seen = [], set()

    def place(t, chain=()):
        if t in seen or t in chain:
            return
        for p in parents.get(t) or []:
            if p in entities:
                place(p, chain + (t,))
        seen.add(t)
        ordered.append(t)

    for t in sorted(entities):
        place(t)

    # A declared derived column is the registry's own expression, so the
    # name-based classifier has nothing to say about it — `age_band` is `text`
    # and would otherwise be withheld as a free-text notes field.
    #
    # Safe to exempt because of how the wrapper is built: derived expressions
    # are evaluated OVER the base select, which has already dropped every
    # withheld column. A declaration of `contact: phone_numbers` does not leak a
    # phone number, it fails the job with `column "phone_numbers" does not
    # exist`. The boundary is structural, not a matter of trusting the YAML.
    SYNTHETIC.update(alias for spec in cfg_derived.values() for alias in spec)

    statements, created, withheld, pending = [], [], {}, {}
    # Targets of `inherit:` — their meaning is settled by the parent view,
    # so the free-text heuristic must not re-judge them.
    inherited_names = set()
    for t in ordered:
        view = prefix + entity_name(t)
        if view in custom:
            log(f"  {view:<28} hand-written, left alone")
            continue
        emitted = emit_entity(cur, t, entities[t], parents, prefix, custom,
                              definitions, log, withheld, pending, depth,
                              cfg_derived, cfg_matview, cfg_rollups,
                              by_entity, tables, cfg_inherit, cfg_filter,
                              inherited_names)
        if not emitted:
            continue
        view, sql = emitted
        statements.append(sql)
        created.append(view)

    gl = emit_geo_levels(levels, prefix)
    if gl and gl[0] not in custom:
        statements.append(gl[1])
        created.append(gl[0])

    if CHANGE_REQUESTS in tables and prefix + "change_request" not in custom:
        view, sql = emit_change_requests(cur, tables[CHANGE_REQUESTS], prefix, log)
        statements.append(sql)
        created.append(view)

    hist = emit_history(cur, history_tables(cur), prefix, log)
    if hist and hist[0] not in custom:
        statements.append(hist[1])
        created.append(hist[0])

    header = (
        "-- GENERATED by generate_reporting_views.py — do not edit.\n"
        "-- Hand-written views belong in the registry's own reporting_views.sql\n"
        f"-- and are named under `custom:` so this tool leaves them alone.\n"
        f"-- prefix={prefix}\n\n")
    body = header + "\n".join(statements)

    if out_path:
        with open(out_path, "w") as fh:
            fh.write(body)
        log(f"[reporting] wrote {out_path} ({len(statements)} view(s))")

    for view, cols in sorted(withheld.items()):
        log(f"  {view}: withheld {len(cols)} column(s) as personal data: "
            f"{', '.join(cols)}")

    if not apply_sql:
        log("[reporting] REPORTING_APPLY=false — not executing")
        return 0

    try:
        cur.execute(body)
    except psycopg2.Error as exc:
        log(f"[reporting] FAILED to create views: {exc}")
        return 1

    log(f"[reporting] created {len(created)} view(s): {', '.join(created)}")
    return verify(cur, created, inherited_names, log)


if __name__ == "__main__":
    raise SystemExit(main())
