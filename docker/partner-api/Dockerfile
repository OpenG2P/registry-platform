# Registry Platform — Partner API reference registry image.
#
# Runnable reference registry (platform + a minimal individual+household extension).
# Bundles openg2p-registry-core + the partner-api service + the reference extension (individual + household), so the image runs as-is.
# A variant registry builds FROM this image and selects its OWN model via REGISTRY_EXTENSION_MODULE (both coexist; no uninstall):
#
#     FROM openg2p/openg2p-registry-partner-api:<version>
#     COPY <your>-extension/ /app/extension/
#     RUN pip install --no-cache-dir /app/extension
#
# Build context = repo root (so core/ and apis/ are reachable).
FROM python:3.12.11-alpine3.22

ARG FASTAPI_COMMON_REF=1.2
ARG IAM_CORE_REF=1.4

RUN apk add --no-cache --virtual .build-deps gcc libc-dev linux-headers make \
 && apk add --no-cache bash git gettext libpq-dev libmagic

WORKDIR /app

COPY core/openg2p-registry-core /app/core/openg2p-registry-core
COPY apis/openg2p-registry-partner-api /app/apis/openg2p-registry-partner-api
COPY reference-extension /app/reference-extension

RUN pip install --no-cache-dir \
      "git+https://github.com/openg2p/openg2p-fastapi-common@${FASTAPI_COMMON_REF}#subdirectory=openg2p-fastapi-common" \
      "git+https://github.com/openg2p/iam@${IAM_CORE_REF}#subdirectory=iam-core" \
      /app/core/openg2p-registry-core \
      /app/apis/openg2p-registry-partner-api \
      /app/reference-extension \
 && apk del --no-network .build-deps

ENV PYTHONUNBUFFERED=1
# Default this image to the reference registry; a variant image overrides it.
ENV REGISTRY_EXTENSION_MODULE=openg2p_registry_reference_extension
ENV PARTNER_WORKER_TYPE=gunicorn
ENV PARTNER_HOST=0.0.0.0
ENV PARTNER_PORT=8000
# Default worker count kept low (3) for predictable memory; the Helm chart
# overrides this per-deployment via PARTNER_NO_OF_WORKERS in envVars.
ENV PARTNER_NO_OF_WORKERS=3

CMD python3 -m openg2p_registry_partner_api.main migrate; \
    ${PARTNER_WORKER_TYPE} "openg2p_registry_partner_api.main:app" --workers ${PARTNER_NO_OF_WORKERS} --worker-class uvicorn.workers.UvicornWorker --bind ${PARTNER_HOST}:${PARTNER_PORT}
