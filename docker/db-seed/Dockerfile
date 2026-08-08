# Registry Platform — DB-seed image (runnable reference registry).
#
# A postgres-client image that ships the generic seeding MACHINERY only:
#   - entrypoint.sh          (applies meta_data / awe_meta_data SQL, runtime env-driven)
#   - load_geo_data.py       (geo hierarchy into master_data)
#   - load_attributes_from_mds.py (country code lists from Master Data)
#   - sync_geo_widgets.py    (geo dropdowns -> the loaded hierarchy)
#   - upload_templates.py    (Jinja templates → MinIO)
#   - openg2p-data           (shared demography CSV + images, cloned at build time)
#
# NOT here: load_sample_data.py / upload_images.py. Sample data is written against
# a specific register's tables and seed JSON, so each variant ships its own pair
# (see farmer-registry and national-social-registry). The entrypoint keeps the
# LOAD_SAMPLE_DATA / LOAD_IMAGES hooks and errors clearly if they are enabled on
# an image that carries no loader.
#
# It ships NO registry-specific data. A concrete registry adds its seed content:
#
#     FROM openg2p/openg2p-registry-db-seed:<version>
#     COPY <ext>/src/<pkg>/meta_data/     /seed/meta_data/
#     COPY <ext>/src/<pkg>/awe_meta_data/ /seed/awe_meta_data/
#     COPY <ext>/src/<pkg>/templates/     /seed/templates/
#     COPY docker/db-seed/seed-data/      /seed/seed-data/
#
# The entrypoint reads /seed/* at container-run time; behaviour (LOAD_SAMPLE_DATA,
# LOAD_GEO_DATA, LOAD_IMAGES, LOAD_TEMPLATES, AWE_DB_SEED_ENABLED, ...) is toggled
# entirely via env from the Helm Job.
#
# Build context = repo root (docker/db-seed/ is reachable).
FROM postgres:16-alpine

ARG GIT_COMMIT=dev
ARG BUILD_TIME=dev
ARG OPENG2P_DATA_REPO=https://github.com/openg2p/openg2p-data.git
# Default for local builds ONLY. CI overrides this with --build-arg from the
# pinned-refs list in .github/workflows/build-publish.yml, which resolves the
# ref to a SHA and stamps it as an org.openg2p.pin label — so changing this
# line alone has no effect on published images. Change the workflow pin too.
ARG OPENG2P_DATA_BRANCH=develop

ENV GIT_COMMIT=${GIT_COMMIT} \
    BUILD_TIME=${BUILD_TIME} \
    OPENG2P_DATA_DIR=/openg2p-data

RUN apk add --no-cache python3 py3-pip py3-psycopg2 git gettext

COPY docker/db-seed/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt && \
    rm /tmp/requirements.txt

# Fetch openg2p-data (shared demography CSV, images) by ref. Uses fetch+checkout
# rather than `git clone -b` because OPENG2P_DATA_BRANCH may be a commit SHA: the
# central pipeline resolves the pin (e.g. `2.0`) to a SHA before the build, and
# `git clone -b` accepts only a branch/tag name — fetch+checkout takes either.
RUN mkdir -p /openg2p-data && cd /openg2p-data \
    && git init -q \
    && git remote add origin ${OPENG2P_DATA_REPO} \
    && git fetch -q --depth 1 origin ${OPENG2P_DATA_BRANCH} \
    && git checkout -q FETCH_HEAD \
    && rm -rf /openg2p-data/.git

# Seed directories. This RP image ships the REFERENCE registry's seed content so
# it is runnable/testable out of the box; a variant db-seed image FROM this one
# clears /seed/{meta_data,awe_meta_data,templates,seed-data} and copies its own.
RUN mkdir -p /seed/meta_data /seed/awe_meta_data /seed/templates /seed/seed-data
COPY reference-extension/src/openg2p_registry_reference_extension/meta_data/     /seed/meta_data/
COPY reference-extension/src/openg2p_registry_reference_extension/awe_meta_data/ /seed/awe_meta_data/
COPY reference-extension/src/openg2p_registry_reference_extension/templates/     /seed/templates/

# Generic machinery only. load_sample_data.py and upload_images.py are NOT here:
# they are written against a specific register's schema (which tables to INSERT,
# which seed JSON to read), so they belong to the variant that declares those
# tables — farmer-registry and NSR each ship their own. This image installs with
# loadSampleData=false and no seed-data, and the entrypoint reports a clear error
# if the flag is turned on without a variant loader present.
COPY docker/db-seed/entrypoint.sh /seed/entrypoint.sh
COPY docker/db-seed/upload_templates.py /seed/upload_templates.py
COPY docker/db-seed/load_geo_data.py /seed/load_geo_data.py
COPY docker/db-seed/load_attributes_from_mds.py /seed/load_attributes_from_mds.py
COPY docker/db-seed/sync_geo_widgets.py /seed/sync_geo_widgets.py
COPY docker/db-seed/generate_reporting_views.py /seed/generate_reporting_views.py
RUN chmod +x /seed/entrypoint.sh \
             /seed/upload_templates.py \
             /seed/load_geo_data.py \
             /seed/load_attributes_from_mds.py \
             /seed/sync_geo_widgets.py

ENTRYPOINT ["/seed/entrypoint.sh"]
