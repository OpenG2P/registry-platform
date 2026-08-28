# Registry Platform — reference-registry images

The registry-platform publishes a **runnable reference registry** for every
runtime component. Each image bundles the platform code **and** a minimal
reference extension (individual + household), and defaults
`REGISTRY_EXTENSION_MODULE` to it — so the images run as-is (that's what
`helm install openg2p-registry` deploys).

A concrete registry (NSR, farmer-registry, a customer registry) does **not** copy
these Dockerfiles or re-install the platform — it builds a thin image `FROM` the
matching image and adds only its own domain model.

## Images published here

| Dockerfile | Published image | Contents |
|---|---|---|
| `staff-api/Dockerfile` | `openg2p/openg2p-registry-staff-api` | core + staff-api + reference extension |
| `partner-api/Dockerfile` | `openg2p/openg2p-registry-partner-api` | core + partner-api + reference extension |
| `bene-api/Dockerfile` | `openg2p/openg2p-registry-bene-api` | core + bene-api + reference extension |
| `celery/Dockerfile` | `openg2p/openg2p-registry-celery` | core + both celery packages (worker/beat via `CELERY_APP`) + reference extension |
| `db-seed/Dockerfile` | `openg2p/openg2p-registry-db-seed` | postgres-client + seeding machinery + `openg2p-data` + the reference registry's seed |

The Next.js Staff Portal UI image (`openg2p/openg2p-registry-staff-ui`) is built
separately by `.github/workflows/docker-staff-portal-ui.yml`; the sanity/e2e
image (`openg2p/openg2p-registry-sanity-tests`) by the same build-publish flow.

## The extension contract (Option C — env-selected module)

The platform imports the domain model by the fixed name
`openg2p_registry_extensions` (a static import in each `main.py` plus ~two dozen
`importlib.import_module("openg2p_registry_extensions.…")` calls in core). Each
entrypoint aliases the **env-selected** module into `sys.modules` at startup:

```python
_ext = os.environ.get("REGISTRY_EXTENSION_MODULE", "openg2p_registry_extensions")
if _ext != "openg2p_registry_extensions":
    sys.modules["openg2p_registry_extensions"] = importlib.import_module(_ext)
```

So `REGISTRY_EXTENSION_MODULE` alone decides which registry runs. The reference
extension installs under its **own** name (`openg2p_registry_reference_extension`,
no alias), and a variant extension installs under its own name too — both can
coexist in one image with no `pip uninstall`.

## Extending an image

```dockerfile
ARG RP_VERSION=1.2.0
FROM openg2p/openg2p-registry-staff-api:${RP_VERSION}
COPY <your>-extension/ /app/extension/
RUN pip install --no-cache-dir /app/extension
# select your model — coexists with the reference extension already in the image:
ENV REGISTRY_EXTENSION_MODULE=openg2p_registry_<your>_extension
# ENV defaults + the migrate/gunicorn CMD are inherited from the base.
```

The db-seed image ships the reference registry's seed; a variant clears it and
adds its own:

```dockerfile
FROM openg2p/openg2p-registry-db-seed:${RP_VERSION}
RUN rm -rf /seed/meta_data/* /seed/awe_meta_data/* /seed/templates/* /seed/seed-data/*
COPY <ext>/src/<pkg>/meta_data/     /seed/meta_data/
COPY <ext>/src/<pkg>/awe_meta_data/ /seed/awe_meta_data/
COPY <ext>/src/<pkg>/templates/     /seed/templates/
```

See `farmer-registry/docker/` for a complete worked example.

## Deployment

The single Helm chart `helm/openg2p-registry` (published from this repo) deploys
any registry. With no overlay it runs the reference registry; a variant supplies
a small values overlay pointing at its own images. See that chart and
`farmer-registry/deployment/values.yaml`.

## Notes

- These images install the platform packages from **this repo's working tree**
  (COPY), not a git ref — this repo *is* the platform. Only the external
  `openg2p-fastapi-common` / `iam-core` (from https://github.com/openg2p/iam) libs are pulled by git ref.
- The images are runnable as-is (the reference extension is bundled). A variant
  image swaps the model purely by installing its package and setting
  `REGISTRY_EXTENSION_MODULE`.
