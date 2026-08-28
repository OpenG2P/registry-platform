# Registry Platform — Celery image — runnable reference registry (workers + beat producers).
#
# Runnable reference registry (platform + a minimal individual+household extension).
# Bundles openg2p-registry-core + BOTH celery packages so a single image can run
# as worker or beat (selected at runtime via CELERY_APP). Bundles the reference extension, so the image runs as-is.
# A variant registry builds FROM this image and selects its OWN model via REGISTRY_EXTENSION_MODULE (both coexist; no uninstall):
#
#     FROM openg2p/openg2p-registry-celery:<version>
#     COPY <your>-extension/ /app/extension/
#     RUN pip install --no-cache-dir /app/extension
#
# Build context = repo root (so core/ and celery/ are reachable).
FROM python:3.12.11-alpine3.22

ARG FASTAPI_COMMON_REF=1.2
ARG IAM_CORE_REF=1.4

RUN apk add --no-cache --virtual .build-deps gcc libc-dev linux-headers make \
 && apk add --no-cache bash git gettext libpq-dev libffi-dev openssl-dev

WORKDIR /app

COPY core/openg2p-registry-core /app/core/openg2p-registry-core
COPY celery/openg2p-registry-celery-beat /app/celery/openg2p-registry-celery-beat
COPY celery/openg2p-registry-celery-worker /app/celery/openg2p-registry-celery-worker
COPY reference-extension /app/reference-extension

# Both celery components (workers + beat producers) are installed so the single
# image can run as worker or beat, selected at runtime via CELERY_APP.
RUN pip install --no-cache-dir \
      "git+https://github.com/openg2p/openg2p-fastapi-common@${FASTAPI_COMMON_REF}#subdirectory=openg2p-fastapi-common" \
      "git+https://github.com/openg2p/iam@${IAM_CORE_REF}#subdirectory=iam-core" \
      /app/core/openg2p-registry-core \
      /app/celery/openg2p-registry-celery-beat \
      /app/celery/openg2p-registry-celery-worker \
      /app/reference-extension \
 && apk del --no-network .build-deps

ENV PYTHONUNBUFFERED=1
# Default this image to the reference registry; a variant image overrides it.
ENV REGISTRY_EXTENSION_MODULE=openg2p_registry_reference_extension
ENV CELERY_APP=openg2p_registry_celery_worker.main.celery_app
ENV CELERY_OPTS="worker --loglevel=info"
ENV CELERY_IMPORTS=""

COPY docker/celery/run_celery.py /app/run_celery.py

# Always use the python wrapper to handle imports and startup.
CMD ["python3", "/app/run_celery.py"]
