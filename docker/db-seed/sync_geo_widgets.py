#!/usr/bin/env python3
"""Match a register's geo dropdowns to the country actually loaded.

Why this exists
---------------
An extension's UI metadata hard-codes its geo hierarchy — NSR ships widgets for
region, sub_city and woreda, three levels with Ethiopian names typed into a SQL
file. Master Data holds the real hierarchy, and it is neither necessarily three
levels nor necessarily called that: Kamuntu has five, ending at village, and
Ethiopia's middle level is `zone`, not `sub_city`.

When the two disagree the failure is silent. `get_g2p_geo_level_values` returns
an empty list for a level it does not recognise, and an empty dropdown looks
exactly like a country that has no regions.

So the widgets are matched to the loaded hierarchy at install: the country
declares its levels once, in its pack, and the form follows. Widget ids, labels,
data paths and validation are left alone — this only touches the parts that
describe the hierarchy.

Below the lowest administrative level
-------------------------------------
A register usually asks for more than the pack defines. NSR's kebele and
locality/EA sit BELOW woreda, which is why the pack does not contain them —
they are address parts, declared in the pack's address.json. Those widgets are
already plain text inputs here and are left untouched. What this does handle is
a widget that claims to be an administrative level when the pack has run out of
them: its data source is removed so it degrades to free text rather than
offering an empty dropdown.

Off unless SYNC_GEO_WIDGETS=true.
"""

import json
import os
import sys

import psycopg2
import psycopg2.extras

GEO_CONFIG_KEY = "widget-geo-config"


def log(msg):
    print(f"[geo-widgets] {msg}", flush=True)


def mds_levels() -> list:
    """The loaded hierarchy, root first, as (level_id, mnemonic)."""
    host, dbname = os.environ.get("MD_PGHOST"), os.environ.get("MD_PGDATABASE")
    if not host or not dbname:
        log("MD_PG* not set — cannot read the hierarchy, leaving widgets as they are.")
        return []
    conn = psycopg2.connect(
        host=host, port=os.environ.get("MD_PGPORT", "5432"), dbname=dbname,
        user=os.environ.get("MD_PGUSER", ""), password=os.environ.get("MD_PGPASSWORD", ""),
    )
    try:
        with conn.cursor() as cur:
            cur.execute("select level_id, level_mnemonic, parent_level_id from g2p_geo_levels")
            rows = cur.fetchall()
    finally:
        conn.close()
    if not rows:
        return []
    by_parent = {}
    for lid, mnem, parent in rows:
        by_parent.setdefault(parent, []).append((lid, mnem))
    chain, cur_parent = [], None
    while by_parent.get(cur_parent):
        lid, mnem = by_parent[cur_parent][0]
        chain.append((lid, mnem))
        cur_parent = lid
    return chain


def walk_widgets(node):
    """Every widget dict in a section's UI schema, at any nesting depth."""
    if isinstance(node, dict):
        if "widget-id" in node:
            yield node
        for v in node.values():
            yield from walk_widgets(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk_widgets(v)


def sync_section(schema: dict, levels: list) -> tuple:
    """Rewrite one section's geo widgets. Returns (changed, notes)."""
    geo_widgets = [w for w in walk_widgets(schema) if GEO_CONFIG_KEY in w]
    if not geo_widgets:
        return False, []

    # The root level is not offered as a choice: there is exactly one country,
    # so a dropdown with a single option asks the user to state what the
    # deployment already knows.
    selectable = levels[1:] if len(levels) > 1 else levels
    notes, changed = [], False

    for index, widget in enumerate(geo_widgets):
        wid = widget.get("widget-id")
        if index >= len(selectable):
            # More widgets than the pack has levels. It is an address part, not
            # an administrative unit — drop the source so it becomes free text.
            if widget.pop("widget-data-source", None) is not None:
                changed = True
                notes.append(f"{wid}: no level {index + 1} in this country — now free text")
            widget.pop(GEO_CONFIG_KEY, None)
            continue

        _, mnemonic = selectable[index]
        parent_wid = geo_widgets[index - 1].get("widget-id") if index else ""
        before = json.dumps([widget.get(GEO_CONFIG_KEY), widget.get("widget-data-source")],
                            sort_keys=True)

        widget[GEO_CONFIG_KEY] = {
            "level": mnemonic,
            "isLastLevel": index == len(selectable) - 1,
            "parentWidgetId": parent_wid,
        }
        # Rebuilt rather than patched: a stale `url` from someone's environment
        # is exactly the kind of thing that survives a patch and then points a
        # production form at a demo server.
        widget["widget-data-source"] = {
            "type": "api",
            "method": "POST",
            "service": "master-data",
            "endpoint": "geo-level-values",
            "level_id": mnemonic,
            "dependsOn": parent_wid,
        }
        after = json.dumps([widget[GEO_CONFIG_KEY], widget["widget-data-source"]], sort_keys=True)
        if before != after:
            changed = True
            notes.append(f"{wid}: level={mnemonic} dependsOn={parent_wid or '(none)'}")

        # The label is left alone: it is human-facing text with a translation
        # behind it, and rewriting it here would silently change a translation
        # key. But a label naming a different level than the widget now fetches
        # is a lie the operator should hear about — "Woreda" over a list of
        # Kamuntu wards is worse than either name on its own.
        label = str(widget.get("widget-label") or "")
        if mnemonic.replace("_", " ").lower() not in label.replace("_", " ").lower():
            notes.append(f"{wid}: label {label!r} does not name '{mnemonic}' — "
                         f"translate this label for the loaded country")

    if len(geo_widgets) < len(selectable):
        # Not fixable here: a missing widget needs a label, a data path and a
        # place in the layout, none of which can be guessed.
        missing = [m for _, m in selectable[len(geo_widgets):]]
        notes.append(f"WARNING: the country has {len(selectable)} selectable levels but this "
                     f"section offers {len(geo_widgets)} — no widget for {', '.join(missing)}")

    return changed, notes


def main():
    levels = mds_levels()
    if not levels:
        log("no hierarchy in master-data — nothing to sync.")
        return
    log("country hierarchy: " + " > ".join(m for _, m in levels))

    conn = psycopg2.connect(
        host=os.environ["PGHOST"], port=os.environ.get("PGPORT", "5432"),
        dbname=os.environ["PGDATABASE"], user=os.environ["PGUSER"],
        password=os.environ.get("PGPASSWORD", ""),
    )
    updated = 0
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('select register_id, section_id, section_ui_schema'
                        '  from "public"."g2p_register_sections"')
            sections = cur.fetchall()

        for row in sections:
            schema = row["section_ui_schema"]
            if isinstance(schema, str):
                try:
                    schema = json.loads(schema)
                except Exception:  # noqa: BLE001
                    continue
            if not isinstance(schema, dict):
                continue
            changed, notes = sync_section(schema, levels)
            for note in notes:
                log(f"  {row['section_id']}: {note}")
            if not changed:
                continue
            with conn.cursor() as cur:
                cur.execute(
                    'update "public"."g2p_register_sections" set section_ui_schema = %s'
                    ' where register_id = %s and section_id = %s',
                    (json.dumps(schema), row["register_id"], row["section_id"]),
                )
            updated += 1
        conn.commit()
    finally:
        conn.close()
    log(f"updated {updated} section(s).")


if __name__ == "__main__":
    if os.environ.get("SYNC_GEO_WIDGETS", "false") != "true":
        print("[geo-widgets] SYNC_GEO_WIDGETS is not true — skipping.", file=sys.stderr)
        sys.exit(0)
    main()
