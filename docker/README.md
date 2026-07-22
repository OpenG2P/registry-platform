# Registry Platform — base Docker images

The registry-platform publishes **base images** for every runtime component. A
concrete registry (NSR, farmer-registry, a customer registry) does **not** copy
these Dockerfiles or re-install the platform — it builds a thin image `FROM` the
matching base and adds only its domain model.

## Images published here

| Dockerfile | Published image | Contents |
|---|---|---|
| `staff-portal-api/Dockerfile` | `openg2p/openg2p-registry-staff-api` | core + staff-portal-api service |
| `partner-api/Dockerfile` | `openg2p/openg2p-registry-partner-api` | core + partner-api service |
| `bene-portal-api/Dockerfile` | `openg2p/openg2p-registry-bene-api` | core + bene-portal-api service |
| `celery/Dockerfile` | `openg2p/openg2p-registry-celery` | core + both celery packages (worker/beat via `CELERY_APP`) |
| `db-seed/Dockerfile` | `openg2p/openg2p-registry-db-seed` | postgres-client + generic seeding machinery + `openg2p-data` |

The Next.js Staff Portal UI image (`openg2p/openg2p-registry-staff-ui`) is
built separately by `.github/workflows/docker-staff-portal-ui.yml`.

## The extension contract

The API/celery base images bundle the platform code but ship **no domain model**.
The platform imports the domain model by the fixed name `openg2p_registry_extensions`
(a static `from openg2p_registry_extensions.app import Initializer` in each
`main.py`, plus ~two dozen `importlib.import_module("openg2p_registry_extensions.…")`
calls in core). That name is resolved from `site-packages` at runtime, so the
base is blind to which registry extends it.

A downstream registry supplies exactly one package installed under that name. Its
`pyproject.toml` aliases its own source package onto the import name:

```toml
[tool.hatch.build.targets.wheel.sources]
"src/openg2p_registry_<variant>_extension" = "openg2p_registry_extensions"
```

Because the base ships no extension, there is no name collision — the downstream
`pip install` is the sole provider.

## Extending a base image

```dockerfile
ARG RP_VERSION=1.2.0
FROM openg2p/openg2p-registry-staff-api:${RP_VERSION}
COPY <your>-extension/ /app/extension/
RUN pip install --no-cache-dir /app/extension   # installs as openg2p_registry_extensions
# ENV defaults + migrate/gunicorn CMD are inherited from the base.
```

The db-seed base carries all the loaders; a derived image adds only its data:

```dockerfile
FROM openg2p/openg2p-registry-db-seed:${RP_VERSION}
COPY <ext>/src/<pkg>/meta_data/     /seed/meta_data/
COPY <ext>/src/<pkg>/awe_meta_data/ /seed/awe_meta_data/
COPY <ext>/src/<pkg>/templates/     /seed/templates/
```

See `farmer-registry/docker/` for a complete worked example.

## Deployment

The single Helm chart `helm/openg2p-registry` (published from this repo) deploys
any registry; a downstream registry supplies a small values overlay pointing at
its own images. See that chart and `farmer-registry/deployment/values.yaml`.

## Notes

- These base images install the platform packages from **this repo's working
  tree** (COPY), not from a git ref — this repo *is* the platform. Only the
  external `openg2p-fastapi-common` / `iam-service` libs are pulled by git ref.
- A base image is **not runnable on its own** — its `CMD` needs the extension
  that a derived image adds. A runnable reference/example registry image (base +
  a minimal reference extension) is a planned follow-up so `helm install
  openg2p-registry` works out-of-the-box without an overlay.
