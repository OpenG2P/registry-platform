# Registry Platform — Staff Portal API reference registry image.
#
# This image is a RUNNABLE reference registry (individual + household): it bundles
# the platform code (openg2p-registry-core + the staff-portal-api service), the
# fastapi-common / iam-core runtime, AND the reference extension, and defaults
# ENV REGISTRY_EXTENSION_MODULE to it — so `helm install` runs it as-is.
#
# A variant registry (NSR, farmer, a customer) builds FROM this image, adds its
# own extension, and points the env var at it (both coexist, no uninstall):
#
#     FROM openg2p/openg2p-registry-staff-api:<version>
#     COPY <your>-extension/ /app/extension/
#     RUN pip install --no-cache-dir /app/extension
#     ENV REGISTRY_EXTENSION_MODULE=openg2p_registry_<your>_extension
#
# The platform imports the domain model by name; each entrypoint aliases the
# env-selected module into sys.modules at startup, so REGISTRY_EXTENSION_MODULE
# alone decides which registry runs. ENV defaults + the migrate/gunicorn CMD are
# inherited by the derived image.
#
# Build context = repo root (so core/ and apis/ are reachable).
FROM python:3.12.11-alpine3.22

# fastapi-common / iam-core are external OpenG2P libs, pulled by git ref. The
# platform packages themselves come from THIS repo's working tree (COPY below),
# so there is no REGISTRY_PLATFORM_REF here — this image IS the platform. In CI
# the central pipeline (openg2p-packaging @v1) resolves these refs to commit
# SHAs before the build and records them as `org.openg2p.pin.<arg>` OCI labels.
ARG FASTAPI_COMMON_REF=1.2
ARG IAM_CORE_REF=1.4

RUN apk add --no-cache --virtual .build-deps gcc libc-dev linux-headers make \
 && apk add --no-cache bash git gettext libpq-dev libmagic

WORKDIR /app

# Platform source from this repo.
COPY core/openg2p-registry-core /app/core/openg2p-registry-core
COPY apis/openg2p-registry-staff-api /app/apis/openg2p-registry-staff-api
COPY reference-extension /app/reference-extension

RUN pip install --no-cache-dir \
      "git+https://gitlab.com/openg2p/shared-libraries/fastapi-common.git@${FASTAPI_COMMON_REF}#subdirectory=openg2p-fastapi-common" \
      "git+https://gitlab.com/openg2p/iam@${IAM_CORE_REF}#subdirectory=iam-core" \
      /app/core/openg2p-registry-core \
      /app/apis/openg2p-registry-staff-api \
      /app/reference-extension \
 && apk del --no-network .build-deps

ENV PYTHONUNBUFFERED=1
# Default this image to the reference registry; a variant image overrides it.
ENV REGISTRY_EXTENSION_MODULE=openg2p_registry_reference_extension
ENV STAFF_PORTAL_WORKER_TYPE=gunicorn
ENV STAFF_PORTAL_HOST=0.0.0.0
ENV STAFF_PORTAL_PORT=8000
# Default worker count kept low (3) for predictable memory; the Helm chart
# overrides this per-deployment via STAFF_PORTAL_NO_OF_WORKERS in envVars.
ENV STAFF_PORTAL_NO_OF_WORKERS=3

# Use module path for migrate and Gunicorn WSGI app. Runs only once a downstream
# image has added the extension that supplies openg2p_registry_extensions.
CMD python3 -m openg2p_registry_staff_api.main migrate; \
    ${STAFF_PORTAL_WORKER_TYPE} "openg2p_registry_staff_api.main:app" --workers ${STAFF_PORTAL_NO_OF_WORKERS} --worker-class uvicorn.workers.UvicornWorker --bind ${STAFF_PORTAL_HOST}:${STAFF_PORTAL_PORT}
