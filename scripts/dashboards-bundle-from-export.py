#!/usr/bin/env python3
"""Turn a Superset dashboard export from one install back into a registry bundle.

The platform chart's dashboards Job imports a registry's bundle for each release
under per-release names: every UUID becomes uuid5(bundle UUID, release), the
connection is named after the release, and each dashboard title gets the prefix
"<release> · " (a slug, if any, the suffix "-<release>"). An export taken from
Superset carries those per-release names. Committed as the bundle as it is, it
would give every other install new UUIDs on its next upgrade, and those installs
would then stop on a clash with their own existing connection.

This undoes the rewrite, using the bundle currently committed:
  * UUIDs of assets the committed bundle has are mapped back to the bundle's
    own; assets created in Superset since keep the UUIDs Superset gave them;
  * the connection takes the committed bundle's name again;
  * the "<release> · " prefix and the "-<release>" slug suffix are removed.

Usage:
  dashboards-bundle-from-export.py --release fr --bundle fr-dashboards.zip \\
      --export dashboard_export.zip --out fr-dashboards.zip

--out may be the same file as --bundle. Needs PyYAML.
"""
import argparse
import io
import re
import sys
import uuid
import zipfile

import yaml

KINDS = ("databases", "datasets", "charts", "dashboards")


def kind(name):
    parts = name.split("/")
    return parts[1] if len(parts) > 2 and parts[1] in KINDS else None


def read(path):
    with zipfile.ZipFile(path) as z:
        return {n: z.read(n) for n in z.namelist() if not n.endswith("/")}


def configs(files):
    for n, raw in files.items():
        if kind(n) and n.endswith((".yaml", ".yml")):
            yield n, yaml.safe_load(raw) or {}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--release", required=True, help="release the export was taken from")
    ap.add_argument("--bundle", required=True, help="the bundle currently committed")
    ap.add_argument("--export", required=True, help="ZIP exported from Superset")
    ap.add_argument("--out", required=True, help="where to write the new bundle")
    a = ap.parse_args()

    bundle, export = read(a.bundle), read(a.export)
    back = {}
    db_name = None
    for n, cfg in configs(bundle):
        if cfg.get("uuid"):
            back[str(uuid.uuid5(uuid.UUID(str(cfg["uuid"])), a.release))] = str(cfg["uuid"])
        if kind(n) == "databases":
            db_name = cfg.get("database_name")

    exported = [cfg for n, cfg in configs(export) if kind(n) == "databases"]
    if len(exported) != 1:
        sys.exit(f"the export must carry exactly one database connection; it has {len(exported)}")
    if exported[0].get("database_name") != a.release:
        sys.exit(f"the export's connection is {exported[0].get('database_name')!r}, not "
                 f"{a.release!r}: export from release {a.release!r}'s dashboards, or pass "
                 "--release for the install it came from")

    prefix = f"{a.release} · "
    pattern = re.compile("|".join(map(re.escape, back))) if back else None
    mapped = 0
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for n, raw in export.items():
            k = kind(n)
            if n.endswith((".yaml", ".yml")):
                text = raw.decode("utf-8")
                if pattern:
                    text, count = pattern.subn(lambda m: back[m.group(0)], text)
                    mapped += count
                if k in ("databases", "dashboards"):
                    cfg = yaml.safe_load(text)
                    if k == "databases" and db_name:
                        cfg["database_name"] = db_name
                    if k == "dashboards":
                        title = cfg.get("dashboard_title") or ""
                        if title.startswith(prefix):
                            cfg["dashboard_title"] = title[len(prefix):]
                        slug = cfg.get("slug") or ""
                        if slug.endswith(f"-{a.release}"):
                            cfg["slug"] = slug[: -len(a.release) - 1]
                    text = yaml.safe_dump(cfg, sort_keys=False, allow_unicode=True)
                raw = text.encode("utf-8")
            z.writestr(n, raw)
    with open(a.out, "wb") as f:
        f.write(out.getvalue())

    new = [cfg["uuid"] for n, cfg in configs(read(a.out))
           if cfg.get("uuid") and str(cfg["uuid"]) not in back.values()]
    print(f"{a.out}: {mapped} UUID reference(s) mapped back to the bundle's; "
          f"{len(new)} asset(s) new since the bundle; connection {db_name!r}")


if __name__ == "__main__":
    main()
