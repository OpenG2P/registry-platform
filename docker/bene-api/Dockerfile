# Registry Platform — Beneficiary Portal API reference registry image.
#
# Runnable reference registry (platform + a minimal individual+household extension).
# Bundles openg2p-registry-core + the bene-portal-api service; ships NO domain
# model. A variant registry builds FROM this image and selects its OWN model via REGISTRY_EXTENSION_MODULE (both coexist; no uninstall):
#
#     FROM openg2p/openg2p-registry-bene-api:<version>
#     COPY <your>-extension/ /app/extension/
#     RUN pip install --no-cache-dir /app/extension
#
# NSR and farmer-registry consume this component as a prebuilt platform image;
# publishing it here from the platform (rather than downstream) removes the
# duplicated build logic and gives it a real version.
#
# Build context = repo root (so core/ and apis/ are reachable).
FROM python:3.12.11-alpine3.22

ARG FASTAPI_COMMON_REF=develop
ARG IAM_CORE_REF=1.4

RUN apk add --no-cache --virtual .build-deps gcc libc-dev linux-headers make \
 && apk add --no-cache bash git gettext libpq-dev libmagic

WORKDIR /app

COPY core/openg2p-registry-core /app/core/openg2p-registry-core
COPY apis/openg2p-registry-bene-api /app/apis/openg2p-registry-bene-api
COPY reference-extension /app/reference-extension

RUN pip install --no-cache-dir \
      "git+https://github.com/openg2p/openg2p-fastapi-common@${FASTAPI_COMMON_REF}#subdirectory=openg2p-fastapi-common" \
      "git+https://github.com/openg2p/openg2p-fastapi-common@${FASTAPI_COMMON_REF}#subdirectory=openg2p-fastapi-auth" \
      "git+https://gitlab.com/openg2p/iam@${IAM_CORE_REF}#subdirectory=iam-core" \
      /app/core/openg2p-registry-core \
      /app/apis/openg2p-registry-bene-api \
      /app/reference-extension \
 && apk del --no-network .build-deps

ENV PYTHONUNBUFFERED=1
# Default this image to the reference registry; a variant image overrides it.
ENV REGISTRY_EXTENSION_MODULE=openg2p_registry_reference_extension
ENV BENE_PORTAL_WORKER_TYPE=gunicorn
ENV BENE_PORTAL_HOST=0.0.0.0
ENV BENE_PORTAL_PORT=8000
# Default worker count kept low (3) for predictable memory; the Helm chart
# overrides this per-deployment via BENE_PORTAL_NO_OF_WORKERS in envVars.
ENV BENE_PORTAL_NO_OF_WORKERS=3

CMD python3 -m openg2p_registry_bene_api.main migrate; \
    ${BENE_PORTAL_WORKER_TYPE} "openg2p_registry_bene_api.main:app" --workers ${BENE_PORTAL_NO_OF_WORKERS} --worker-class uvicorn.workers.UvicornWorker --bind ${BENE_PORTAL_HOST}:${BENE_PORTAL_PORT}
