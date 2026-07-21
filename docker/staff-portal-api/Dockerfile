# Registry Platform — Staff Portal API BASE image.
#
# This is a *build base*, not a runnable registry on its own. It bundles the
# platform code (openg2p-registry-core + the staff-portal-api service) plus the
# fastapi-common / iam-core runtime, but deliberately ships NO domain model
# (`openg2p_registry_extensions`). A concrete registry is produced downstream by:
#
#     FROM openg2p/openg2p-registry-staff-portal-api-base:<version>
#     COPY <your>-extension/ /app/extension/
#     RUN pip install --no-cache-dir /app/extension   # installs as openg2p_registry_extensions
#
# The ENV defaults and CMD below are inherited by that derived image, so a
# downstream Dockerfile only supplies the extension. Because the extension is
# imported by the fixed name `openg2p_registry_extensions` (resolved from
# site-packages at runtime), this base is blind to which registry extends it.
#
# Build context = repo root (so core/ and apis/ are reachable).
FROM python:3.12.11-alpine3.22

# fastapi-common / iam-core are external OpenG2P libs, pulled by git ref. The
# platform packages themselves come from THIS repo's working tree (COPY below),
# so there is no REGISTRY_PLATFORM_REF here — this image IS the platform. In CI
# the central pipeline (openg2p-packaging @v1) resolves these refs to commit
# SHAs before the build and records them as `org.openg2p.pin.<arg>` OCI labels.
ARG FASTAPI_COMMON_REF=develop
ARG IAM_CORE_REF=develop

RUN apk add --no-cache --virtual .build-deps gcc libc-dev linux-headers make \
 && apk add --no-cache bash git gettext libpq-dev libmagic

WORKDIR /app

# Platform source from this repo.
COPY core/openg2p-registry-core /app/core/openg2p-registry-core
COPY apis/openg2p-registry-staff-portal-api /app/apis/openg2p-registry-staff-portal-api

RUN pip install --no-cache-dir \
      "git+https://github.com/openg2p/openg2p-fastapi-common@${FASTAPI_COMMON_REF}#subdirectory=openg2p-fastapi-common" \
      "git+https://github.com/openg2p/openg2p-fastapi-common@${FASTAPI_COMMON_REF}#subdirectory=openg2p-fastapi-auth" \
      "git+https://github.com/openg2p/iam-service@${IAM_CORE_REF}#subdirectory=iam-core" \
      /app/core/openg2p-registry-core \
      /app/apis/openg2p-registry-staff-portal-api \
 && apk del --no-network .build-deps

ENV PYTHONUNBUFFERED=1
ENV STAFF_PORTAL_WORKER_TYPE=gunicorn
ENV STAFF_PORTAL_HOST=0.0.0.0
ENV STAFF_PORTAL_PORT=8000
# Default worker count kept low (3) for predictable memory; the Helm chart
# overrides this per-deployment via STAFF_PORTAL_NO_OF_WORKERS in envVars.
ENV STAFF_PORTAL_NO_OF_WORKERS=3

# Use module path for migrate and Gunicorn WSGI app. Runs only once a downstream
# image has added the extension that supplies openg2p_registry_extensions.
CMD python3 -m openg2p_registry_staff_portal_api.main migrate; \
    ${STAFF_PORTAL_WORKER_TYPE} "openg2p_registry_staff_portal_api.main:app" --workers ${STAFF_PORTAL_NO_OF_WORKERS} --worker-class uvicorn.workers.UvicornWorker --bind ${STAFF_PORTAL_HOST}:${STAFF_PORTAL_PORT}
