# Registry Platform — Celery BASE image (workers + beat producers).
#
# Build base only (see docker/staff-portal-api/Dockerfile for the full rationale).
# Bundles openg2p-registry-core + BOTH celery packages so a single image can run
# as worker or beat (selected at runtime via CELERY_APP). Ships NO domain model.
# A downstream registry adds its extension on top:
#
#     FROM openg2p/openg2p-registry-celery-base:<version>
#     COPY <your>-extension/ /app/extension/
#     RUN pip install --no-cache-dir /app/extension
#
# Build context = repo root (so core/ and celery/ are reachable).
FROM python:3.12.11-alpine3.22

ARG FASTAPI_COMMON_REF=develop
ARG IAM_CORE_REF=develop

RUN apk add --no-cache --virtual .build-deps gcc libc-dev linux-headers make \
 && apk add --no-cache bash git gettext libpq-dev libffi-dev openssl-dev

WORKDIR /app

COPY core/openg2p-registry-core /app/core/openg2p-registry-core
COPY celery/openg2p-registry-celery-beat-producers /app/celery/openg2p-registry-celery-beat-producers
COPY celery/openg2p-registry-celery-workers /app/celery/openg2p-registry-celery-workers

# Both celery components (workers + beat producers) are installed so the single
# image can run as worker or beat, selected at runtime via CELERY_APP.
RUN pip install --no-cache-dir \
      "git+https://github.com/openg2p/openg2p-fastapi-common@${FASTAPI_COMMON_REF}#subdirectory=openg2p-fastapi-common" \
      "git+https://github.com/openg2p/openg2p-fastapi-common@${FASTAPI_COMMON_REF}#subdirectory=openg2p-fastapi-auth" \
      "git+https://github.com/openg2p/iam-service@${IAM_CORE_REF}#subdirectory=iam-core" \
      /app/core/openg2p-registry-core \
      /app/celery/openg2p-registry-celery-beat-producers \
      /app/celery/openg2p-registry-celery-workers \
 && apk del --no-network .build-deps

ENV PYTHONUNBUFFERED=1
ENV CELERY_APP=openg2p_registry_celery_workers.main.celery_app
ENV CELERY_OPTS="worker --loglevel=info"
ENV CELERY_IMPORTS=""

COPY docker/celery/run_celery.py /app/run_celery.py

# Always use the python wrapper to handle imports and startup.
CMD ["python3", "/app/run_celery.py"]
