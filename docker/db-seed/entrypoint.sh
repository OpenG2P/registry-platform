#!/bin/sh
set -e

# ──────────────────────────────────────────────────────────────
# OpenG2P Registry DB Seed Entrypoint
#
# Registry database:
#   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
#   LOAD_SAMPLE_DATA — "true" to load sample data from openg2p-data (default: "false")
#   LOAD_IMAGES      — "true" to upload profile images to MinIO (default: "false")
#   LOAD_TEMPLATES   — "true" to upload templates to MinIO (default: "false")
#   OPENG2P_DATA_DIR — cloned shared seed data (default: /openg2p-data)
#   MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY — MinIO connection
#   MINIO_SECURE     — "true" for HTTPS (default: "false")
#   TEMPLATE_BUCKET_NAME, TEMPLATES_DIR — default bucket "templates" (DocumentBucket.TEMPLATES)
#   IMAGE_BUCKET_NAME, IMAGES_DIR — default bucket "documents" (DocumentBucket.DOCUMENTS)
#
# Master-data database (geo reference data; the master-data service is a generic
# commons service and ships no seed data, so geo — which is registry sample /
# reference data — is loaded here into the master_data DB over the network):
#   MD_PGHOST, MD_PGPORT, MD_PGDATABASE, MD_PGUSER, MD_PGPASSWORD
#   LOAD_GEO_DATA — "true" to load the geo hierarchy into master_data (default:
#                   "false"). Enable alongside LOAD_SAMPLE_DATA so the geo ids the
#                   registry rows derive already resolve in master_data.
#
#   SYNC_GEO_WIDGETS  — "true" to match the register's geo dropdowns to the
#                       hierarchy Master Data actually holds (default: "false").
#                       An extension's metadata hard-codes level names and depth;
#                       a country whose pack disagrees gets empty dropdowns.
#
# AWE database (implementation extension data; optional):
#   AWE_DB_SEED_ENABLED — "true" to seed the AWE Postgres database
#   AWE_PGHOST, AWE_PGPORT, AWE_PGDATABASE, AWE_PGUSER, AWE_PGPASSWORD
#   AWE_CALLBACK_HMAC_SECRET    — callback_secret row + registry staff API
#   AWE_CALLBACK_SECRET_ID        — callback_secret row id (per-release; default "registry")
#   AWE_CALLBACK_CALLER_SERVICE   — full webhook URL for callback_secret.caller_service
# ──────────────────────────────────────────────────────────────

PGPORT="${PGPORT:-5432}"
LOAD_GEO_DATA="${LOAD_GEO_DATA:-false}"
SYNC_GEO_WIDGETS="${SYNC_GEO_WIDGETS:-false}"
LOAD_SAMPLE_DATA="${LOAD_SAMPLE_DATA:-false}"
LOAD_IMAGES="${LOAD_IMAGES:-false}"
LOAD_TEMPLATES="${LOAD_TEMPLATES:-false}"
AWE_DB_SEED_ENABLED="${AWE_DB_SEED_ENABLED:-false}"

SEED_DIR="/seed"
META_DATA_DIR="${SEED_DIR}/meta_data"
AWE_META_DATA_DIR="${SEED_DIR}/awe_meta_data"

run_sql_files() {
  dir="$1"
  label="$2"
  db_host="${3:-$PGHOST}"
  db_port="${4:-$PGPORT}"
  db_name="${5:-$PGDATABASE}"
  db_user="${6:-$PGUSER}"
  db_password="${7:-$PGPASSWORD}"

  if [ ! -d "$dir" ]; then
    echo "[db-seed] No ${label} directory found at ${dir}, skipping."
    return
  fi

  sql_files=$(find "$dir" -name '*.sql' -type f | sort)
  if [ -z "$sql_files" ]; then
    echo "[db-seed] No SQL files found in ${dir}, skipping."
    return
  fi

  echo "[db-seed] Running ${label} on ${db_name}@${db_host}:${db_port} ..."
  PGHOST="$db_host" PGPORT="$db_port" PGDATABASE="$db_name" PGUSER="$db_user" PGPASSWORD="$db_password"
  export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD
  for f in $sql_files; do
    echo "[db-seed]   -> $(basename "$f")"
    psql -v ON_ERROR_STOP=0 -f "$f"
  done
  echo "[db-seed] ${label} completed."
}

run_callback_secret() {
  tpl="${AWE_META_DATA_DIR}/40_callback_secret.sql.tpl"
  if [ ! -f "$tpl" ]; then
    return
  fi
  if [ -z "$AWE_CALLBACK_HMAC_SECRET" ]; then
    echo "[db-seed] AWE_CALLBACK_HMAC_SECRET unset — skipping callback_secret."
    return
  fi
  if [ -z "$AWE_CALLBACK_CALLER_SERVICE" ]; then
    echo "[db-seed] AWE_CALLBACK_CALLER_SERVICE unset — skipping callback_secret."
    return
  fi
  # Callback-secret row id — per registry instance. Passed by the db-seed Job
  # from the chart's global.aweCallbackSecretId; defaults to "registry" so the
  # image stays backward-compatible if the env is unset.
  AWE_CALLBACK_SECRET_ID="${AWE_CALLBACK_SECRET_ID:-registry}"
  echo "[db-seed]   -> callback_secret (AWE DB, from template) id=${AWE_CALLBACK_SECRET_ID} caller_service=${AWE_CALLBACK_CALLER_SERVICE}"
  export AWE_CALLBACK_HMAC_SECRET AWE_CALLBACK_SECRET_ID AWE_CALLBACK_CALLER_SERVICE
  PGHOST="${AWE_PGHOST}" PGPORT="${AWE_PGPORT:-5432}" PGDATABASE="${AWE_PGDATABASE}" \
    PGUSER="${AWE_PGUSER}" PGPASSWORD="${AWE_PGPASSWORD}" \
    envsubst '${AWE_CALLBACK_HMAC_SECRET} ${AWE_CALLBACK_SECRET_ID} ${AWE_CALLBACK_CALLER_SERVICE}' < "$tpl" | psql -v ON_ERROR_STOP=0 -f -
}

echo "============================================="
echo " OpenG2P Registry DB Seed"
echo " Extension : ${EXTENSION_FOLDER:-unknown}"
echo " Registry DB : ${PGDATABASE}@${PGHOST}:${PGPORT}"
echo " Master DB   : ${MD_PGDATABASE:-unset}@${MD_PGHOST:-unset}:${MD_PGPORT:-5432}"
echo " AWE DB seed : ${AWE_DB_SEED_ENABLED}"
echo " Geo data    : ${LOAD_GEO_DATA}"
echo " Sample data : ${LOAD_SAMPLE_DATA}"
echo " Images      : ${LOAD_IMAGES}"
echo " Templates   : ${LOAD_TEMPLATES}"
echo "============================================="

# 1. Registry meta_data (includes awe-integration mappings under meta_data/)
run_sql_files "$META_DATA_DIR" "meta-data"

# 2. Optionally load geo reference data into the master_data DB. Must run before
#    sample data so the geo ids derived by load_sample_data.py already resolve.
if [ "$LOAD_GEO_DATA" = "true" ]; then
  echo "[db-seed] Loading geo data into master_data ..."
  python3 /seed/load_geo_data.py
else
  echo "[db-seed] Skipping geo data (LOAD_GEO_DATA=${LOAD_GEO_DATA})."
fi

# 2b. Optionally match the register's geo dropdowns to the loaded country. After
#     meta_data, since it rewrites what meta_data just inserted.
if [ "$SYNC_GEO_WIDGETS" = "true" ]; then
  echo "[db-seed] Syncing geo widgets to the loaded country hierarchy ..."
  python3 /seed/sync_geo_widgets.py
else
  echo "[db-seed] Skipping geo-widget sync (SYNC_GEO_WIDGETS=${SYNC_GEO_WIDGETS})."
fi

# 3. Optionally load sample data.
#
# The loader is NOT part of this image. Sample data is written against a specific
# register's schema — the tables and the seed JSON both belong to a variant — so
# each variant ships its own /seed/load_sample_data.py. The platform owns the
# HOOK and the ordering, not the loader. A base install has no sample data at all
# (loadSampleData=false, no seed-data), which is deliberate.
if [ "$LOAD_SAMPLE_DATA" = "true" ]; then
  if [ -f /seed/load_sample_data.py ]; then
    echo "[db-seed] Loading sample data ..."
    python3 /seed/load_sample_data.py
  else
    echo "[db-seed] ERROR: LOAD_SAMPLE_DATA=true but this image ships no" \
         "/seed/load_sample_data.py. Sample data is variant-specific — use a" \
         "registry variant's db-seed image, or set loadSampleData=false." >&2
    exit 1
  fi
else
  echo "[db-seed] Skipping sample data (LOAD_SAMPLE_DATA=${LOAD_SAMPLE_DATA})."
fi

# 4. Optionally upload profile images to MinIO. Variant-supplied, same as above:
#    the images are linked to the sample records that loader created.
if [ "$LOAD_IMAGES" = "true" ]; then
  if [ -f /seed/upload_images.py ]; then
    echo "[db-seed] Uploading profile images to MinIO ..."
    python3 /seed/upload_images.py
  else
    echo "[db-seed] ERROR: LOAD_IMAGES=true but this image ships no" \
         "/seed/upload_images.py. Profile images accompany a variant's sample" \
         "data — use a variant's db-seed image, or set loadImages=false." >&2
    exit 1
  fi
else
  echo "[db-seed] Skipping image upload (LOAD_IMAGES=${LOAD_IMAGES})."
fi

# 5. Optionally upload Jinja templates to MinIO (object key = filename)
if [ "$LOAD_TEMPLATES" = "true" ]; then
  echo "[db-seed] Uploading templates to MinIO ..."
  python3 /seed/upload_templates.py
else
  echo "[db-seed] Skipping template upload (LOAD_TEMPLATES=${LOAD_TEMPLATES})."
fi

# 6. Optionally seed AWE database (policies, stages, callback_secret)
if [ "$AWE_DB_SEED_ENABLED" = "true" ]; then
  if [ -z "$AWE_PGDATABASE" ] || [ -z "$AWE_PGHOST" ]; then
    echo "[db-seed] AWE_DB_SEED_ENABLED but AWE DB env incomplete — skipping AWE seed."
  else
    echo "---------------------------------------------"
    echo " AWE DB : ${AWE_PGDATABASE}@${AWE_PGHOST}:${AWE_PGPORT:-5432}"
    echo "---------------------------------------------"
    run_sql_files "$AWE_META_DATA_DIR" "AWE meta_data" \
      "$AWE_PGHOST" "${AWE_PGPORT:-5432}" "$AWE_PGDATABASE" "$AWE_PGUSER" "$AWE_PGPASSWORD"
    run_callback_secret
  fi
fi

echo "[db-seed] Done."
