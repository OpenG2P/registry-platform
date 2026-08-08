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


def is_pii(column: str, data_type: str) -> bool:
    """Should this column be withheld?"""
    if column in PII_ALLOW:
        return False
    if column in PII_COLUMNS:
        return True
    if any(data_type.startswith(t) for t in NON_PII_TYPES):
        return False
    if any(p.search(column) for p in PII_PATTERNS):
        return True
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
    return (f"WITH _geo AS (\n    SELECT\n{body}\n"
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


def emit_entity(cur, table, cols, parents, prefix, custom, definitions, log,
                withheld, pending, depth):
    """One view, one row per record of this entity."""
    name = entity_name(table)
    view = prefix + name
    id_col = f"{name}_id"

    names = {c for c, _ in cols}
    select = [f"    e.{PK} AS {id_col}"]

    # --- geography -------------------------------------------------------
    cte, joins = "", []
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
        # LEFT, always. An inner join against a polymorphic parent returns
        # nothing at all and looks exactly like an empty table.
        joins.append(f"LEFT JOIN {pview} {alias} ON {alias}.{pname}_id = e.{FK}")
        select.append(f"    {alias}.{pname}_id")
        # Geography is INHERITED from the parent, never re-derived: a livestock
        # record has no hierarchy of its own, it is wherever its parcel is.
        # Deriving it twice is a second chance to disagree with the parent.
        if n == 0 and GEO_JSON not in names:
            select += [f"    {c}" for c in geo_select(depth, alias, pcols)]

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

    sql = (f'DROP VIEW IF EXISTS {view} CASCADE;\n'
           f'CREATE VIEW {view} AS\n{cte}SELECT\n' +
           ",\n".join(select) +
           f'\nFROM "{table}" e\n' + "\n".join(joins) + ";\n")
    pending[view] = select_names(select)
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
    return view, (f'DROP VIEW IF EXISTS {view} CASCADE;\n'
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
    return view, (f'DROP VIEW IF EXISTS {view} CASCADE;\n'
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
        f'DROP VIEW IF EXISTS {view} CASCADE;\n'
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


def verify(cur, views, log) -> int:
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
            if is_pii(col, typ):
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

    statements, created, withheld, pending = [], [], {}, {}
    for t in ordered:
        view = prefix + entity_name(t)
        if view in custom:
            log(f"  {view:<28} hand-written, left alone")
            continue
        emitted = emit_entity(cur, t, entities[t], parents, prefix, custom,
                              definitions, log, withheld, pending, depth)
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
    return verify(cur, created, log)


if __name__ == "__main__":
    raise SystemExit(main())
