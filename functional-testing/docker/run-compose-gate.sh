#!/usr/bin/env bash
# Functional gate for registry-platform — API (pytest) + UI (Playwright) tests
# against the reference extension. Platform images (staff-api, partner-api,
# celery, staff-ui, db-seed) are built from this repo; commons services pull
# from Docker Hub.
#
# Usage:
#   ./functional-testing/docker/run-compose-gate.sh
#
# API only:
#   FUNC_SKIP_UI=1 ./functional-testing/docker/run-compose-gate.sh
#
# UI only:
#   FUNC_SKIP_API=1 ./functional-testing/docker/run-compose-gate.sh
#
# Keep stack after run (for debugging):
#   FUNC_SKIP_TEARDOWN=1 ./functional-testing/docker/run-compose-gate.sh
#
# Environment:
#   FUNC_SKIP_API=1         skip pytest API suite
#   FUNC_SKIP_UI=1          skip Playwright UI suite
#   FUNC_SKIP_STACK=1       skip docker compose up (use running stack)
#   FUNC_SKIP_TEARDOWN=1    keep containers after run
#   FUNC_SKIP_SEED=1        skip keycloak_seed.py (user pre-baked in realm)
#   FUNC_SKIP_FUNC_SEED=1   skip functional SQL seed + verify
#   FUNC_RUN_STAFF_TIER1=1  also run api/staff -m tier1 after workflows
#   FUNC_RUN_STAFF_TIER2=1  also run api/staff -m tier2 after workflows
#   FUNC_RUN_PARTNER_TIER3=1 also run api/partner -m tier3 after workflows
#   FUNC_SKIP_PARTNER_CONSENT_SEED=1  skip PM/CM partner+consent seed
#
# Staff Tier-2 env-gated extras (off by default; set when running Tier-2):
#   FUNC_AWE_ENABLED=1              AWE proxy list/stats
#   FUNC_AWE_WEBHOOK_SECRET=...     HMAC webhook probe
#                                   (compose gate value: func-gate-hmac-secret-value)
#   FUNC_REGISTRANT_AUTH=1          authenticate_registrant
#   FUNC_STAFF_INGEST=1             staff ingest-data probe
#
# Example (Tier-2 extras on compose gate):
#   FUNC_RUN_STAFF_TIER2=1 FUNC_SKIP_UI=1 \
#   FUNC_AWE_ENABLED=1 \
#   FUNC_AWE_WEBHOOK_SECRET=func-gate-hmac-secret-value \
#   FUNC_REGISTRANT_AUTH=1 FUNC_STAFF_INGEST=1 \
#   ./functional-testing/docker/run-compose-gate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT}/functional-testing/docker/docker-compose.gate.yaml"
PROJECT_NAME="${FUNC_COMPOSE_PROJECT:-func-gate-rp}"

cleanup() {
  if [ "${FUNC_SKIP_TEARDOWN:-0}" != "1" ] && [ "${FUNC_SKIP_STACK:-0}" != "1" ]; then
    echo "[compose-gate] tearing down"
    docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" down -v --remove-orphans 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Bring up the stack ──────────────────────────────────────────────────────

if [ "${FUNC_SKIP_STACK:-0}" != "1" ]; then
  echo "[compose-gate] starting stack (project=${PROJECT_NAME})"

  # Prefer a clean slate (avoids duplicate-key on meta/IAM). If Docker cannot
  # stop leftover containers (permission denied), fail clearly so the operator
  # can `sudo docker rm -f $(sudo docker ps -aq --filter name=${PROJECT_NAME})`.
  echo "[compose-gate] removing any previous stack (including volumes)..."
  if ! docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" down -v --remove-orphans; then
    echo "[compose-gate] ERROR: could not tear down project '${PROJECT_NAME}'." >&2
    echo "[compose-gate] HINT: stuck containers often need elevated Docker access:" >&2
    echo "  sudo docker rm -f \$(sudo docker ps -aq --filter name=${PROJECT_NAME})" >&2
    echo "  sudo docker volume ls -q --filter name=${PROJECT_NAME} | xargs -r sudo docker volume rm" >&2
    exit 1
  fi

  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" up -d \
    postgres keycloak redis minio \
    iam-staff-portal-api master-data-api awe id-generator \
    pm-partner-api pm-staff-api consent-manager-api consent-manager-partner-api

  echo "[compose-gate] waiting for infrastructure to be healthy..."
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" up -d --wait \
    postgres keycloak redis minio \
    iam-staff-portal-api master-data-api awe id-generator \
    pm-partner-api pm-staff-api consent-manager-api consent-manager-partner-api

  echo "[compose-gate] seeding IAM login provider..."
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" exec -T postgres \
    psql -U iam_service_user -d iam_service -c "
      INSERT INTO login_providers (
        provider_name, client_id, client_secret,
        token_endpoint_auth_method, issuer,
        server_metadata_url, jwks_uri,
        authorization_endpoint, token_endpoint, userinfo_endpoint,
        oauth_callback_url, scope, active, created_at
      ) SELECT
        'Keycloak', 'registry-staff-portal', 'func-gate-client-secret',
        'client_secret_post', 'http://keycloak:8080/realms/staff',
        'http://keycloak:8080/realms/staff/.well-known/openid-configuration',
        'http://keycloak:8080/realms/staff/protocol/openid-connect/certs',
        'http://keycloak:8080/realms/staff/protocol/openid-connect/auth',
        'http://keycloak:8080/realms/staff/protocol/openid-connect/token',
        'http://keycloak:8080/realms/staff/protocol/openid-connect/userinfo',
        'http://localhost:18081/auth/callback',
        'openid profile email', true, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM login_providers WHERE issuer = 'http://keycloak:8080/realms/staff');
    "

  echo "[compose-gate] seeding IAM RBAC (application, roles, permissions)..."
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" exec -T postgres \
    psql -U iam_service_user -d iam_service <<'EOSQL'
    INSERT INTO staff_portal_applications
      (id, application_mnemonic, application_description, active, is_self_registered, created_at, updated_at)
    SELECT 100, 'registry-staff-portal', 'Registry Platform', true, true, NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM staff_portal_applications WHERE application_mnemonic = 'registry-staff-portal'
    );

    INSERT INTO staff_application_permissions (id, application_id, permission_mnemonic, permission_description, active, created_at, updated_at)
    VALUES
      (100, 100, 'intakeFormDefinition:view',      'intakeFormDefinition:view',      true, NOW(), NOW()),
      (101, 100, 'intakeFormDefinition:edit',      'intakeFormDefinition:edit',      true, NOW(), NOW()),
      (102, 100, 'intakeSubmission:view',          'intakeSubmission:view',          true, NOW(), NOW()),
      (103, 100, 'intakeSubmission:edit',          'intakeSubmission:edit',          true, NOW(), NOW()),
      (104, 100, 'intakeSubmission:approve',       'intakeSubmission:approve',       true, NOW(), NOW()),
      (105, 100, 'register:view',                  'register:view',                  true, NOW(), NOW()),
      (106, 100, 'register:export',                'register:export',                true, NOW(), NOW()),
      (107, 100, 'register:authenticate',          'register:authenticate',          true, NOW(), NOW()),
      (108, 100, 'registerHistory:view',           'registerHistory:view',           true, NOW(), NOW()),
      (109, 100, 'registerSection:view',           'registerSection:view',           true, NOW(), NOW()),
      (110, 100, 'registerSection:create',         'registerSection:create',         true, NOW(), NOW()),
      (111, 100, 'registerSection:edit',           'registerSection:edit',           true, NOW(), NOW()),
      (112, 100, 'registerSection:delete',         'registerSection:delete',         true, NOW(), NOW()),
      (113, 100, 'registerDefinition:view',        'registerDefinition:view',        true, NOW(), NOW()),
      (114, 100, 'registerDefinition:create',      'registerDefinition:create',      true, NOW(), NOW()),
      (115, 100, 'registerDefinition:edit',        'registerDefinition:edit',        true, NOW(), NOW()),
      (116, 100, 'registerDefinition:delete',      'registerDefinition:delete',      true, NOW(), NOW()),
      (117, 100, 'registerTab:view',               'registerTab:view',               true, NOW(), NOW()),
      (118, 100, 'registerTab:create',             'registerTab:create',             true, NOW(), NOW()),
      (119, 100, 'registerTab:edit',               'registerTab:edit',               true, NOW(), NOW()),
      (120, 100, 'registerTab:delete',             'registerTab:delete',             true, NOW(), NOW()),
      (121, 100, 'registerScore:view',             'registerScore:view',             true, NOW(), NOW()),
      (122, 100, 'registerScore:create',           'registerScore:create',           true, NOW(), NOW()),
      (123, 100, 'registerScore:edit',             'registerScore:edit',             true, NOW(), NOW()),
      (124, 100, 'registryConfiguration:edit',     'registryConfiguration:edit',     true, NOW(), NOW()),
      (160, 100, 'registryConfiguration:view',     'registryConfiguration:view',     true, NOW(), NOW()),
      (125, 100, 'changeRequest:view',             'changeRequest:view',             true, NOW(), NOW()),
      (126, 100, 'changeRequest:create',           'changeRequest:create',           true, NOW(), NOW()),
      (127, 100, 'changeRequest:approve',          'changeRequest:approve',          true, NOW(), NOW()),
      (128, 100, 'verificationChangeRequest:view', 'verificationChangeRequest:view', true, NOW(), NOW()),
      (129, 100, 'verificationChangeRequest:create','verificationChangeRequest:create',true,NOW(), NOW()),
      (130, 100, 'verificationIntakeForm:view',    'verificationIntakeForm:view',    true, NOW(), NOW()),
      (131, 100, 'verificationIntakeForm:create',  'verificationIntakeForm:create',  true, NOW(), NOW()),
      (132, 100, 'dataModel:view',                 'dataModel:view',                 true, NOW(), NOW()),
      (133, 100, 'dataModel:create',               'dataModel:create',               true, NOW(), NOW()),
      (134, 100, 'dataModel:edit',                 'dataModel:edit',                 true, NOW(), NOW()),
      (135, 100, 'dataModel:delete',               'dataModel:delete',               true, NOW(), NOW()),
      (136, 100, 'ingestKeyPath:view',             'ingestKeyPath:view',             true, NOW(), NOW()),
      (137, 100, 'ingestKeyPath:create',           'ingestKeyPath:create',           true, NOW(), NOW()),
      (138, 100, 'ingestKeyPath:edit',             'ingestKeyPath:edit',             true, NOW(), NOW()),
      (139, 100, 'ingestKeyPath:delete',           'ingestKeyPath:delete',           true, NOW(), NOW()),
      (140, 100, 'ingestExpression:view',          'ingestExpression:view',          true, NOW(), NOW()),
      (141, 100, 'ingestExpression:create',        'ingestExpression:create',        true, NOW(), NOW()),
      (142, 100, 'ingestExpression:edit',          'ingestExpression:edit',          true, NOW(), NOW()),
      (143, 100, 'ingestExpression:delete',        'ingestExpression:delete',        true, NOW(), NOW()),
      (144, 100, 'ingestTemplate:view',            'ingestTemplate:view',            true, NOW(), NOW()),
      (145, 100, 'ingestTemplate:create',          'ingestTemplate:create',          true, NOW(), NOW()),
      (146, 100, 'ingestTemplate:edit',            'ingestTemplate:edit',            true, NOW(), NOW()),
      (147, 100, 'ingestTemplate:delete',          'ingestTemplate:delete',          true, NOW(), NOW()),
      (148, 100, 'ingestSubscription:view',        'ingestSubscription:view',        true, NOW(), NOW()),
      (149, 100, 'ingestSubscription:create',      'ingestSubscription:create',      true, NOW(), NOW()),
      (150, 100, 'outgestTopic:view',              'outgestTopic:view',              true, NOW(), NOW()),
      (151, 100, 'outgestTopic:create',            'outgestTopic:create',            true, NOW(), NOW()),
      (152, 100, 'outgestTopic:edit',              'outgestTopic:edit',              true, NOW(), NOW()),
      (153, 100, 'outgestTopic:delete',            'outgestTopic:delete',            true, NOW(), NOW()),
      (154, 100, 'outgestTemplate:view',           'outgestTemplate:view',           true, NOW(), NOW()),
      (155, 100, 'outgestTemplate:create',         'outgestTemplate:create',         true, NOW(), NOW()),
      (156, 100, 'outgestTemplate:edit',           'outgestTemplate:edit',           true, NOW(), NOW()),
      (157, 100, 'outgestTemplate:delete',         'outgestTemplate:delete',         true, NOW(), NOW()),
      (158, 100, 'outgoingMessage:view',           'outgoingMessage:view',           true, NOW(), NOW()),
      (159, 100, 'incomingMessage:view',           'incomingMessage:view',           true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO staff_roles (id, application_id, role_mnemonic, role_description, active, created_at, updated_at)
    VALUES
      (100, 100, 'Operations Administrator', 'Operations Administrator', true, NOW(), NOW()),
      (101, 100, 'Technical Administrator',  'Technical Administrator',  true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO staff_role_permissions (role_id, permission_id, active, created_at, updated_at)
    SELECT r.id, p.id, true, NOW(), NOW()
    FROM staff_roles r
    CROSS JOIN staff_application_permissions p
    WHERE r.application_id = 100
      AND p.application_id = 100
    ON CONFLICT DO NOTHING;
EOSQL

  echo "[compose-gate] building registry-platform images from local Dockerfiles..."
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" build \
    staff-api partner-api celery-worker celery-beat staff-ui db-seed

  echo "[compose-gate] starting registry-platform services..."
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" up -d \
    staff-api partner-api celery-worker celery-beat staff-ui

  echo "[compose-gate] waiting for staff-api and staff-ui to be healthy..."
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" up -d --wait \
    staff-api partner-api staff-ui

  echo "[compose-gate] running db-seed..."
  # Prefer `run --rm` over `up --exit-code-from` so sibling services are not
  # stopped when the one-shot seed container exits.
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" run --rm --no-deps db-seed
  echo "[compose-gate] db-seed complete"

  # Always use fixture household id for Individual intake linkage.
  FUNC_HOUSEHOLD_ID=h001
fi

# ── Export test env ─────────────────────────────────────────────────────────

export FUNC_STAFF_API_BASE="http://127.0.0.1:18082"
export FUNC_PARTNER_API_BASE="http://127.0.0.1:18083"
export FUNC_UI_BASE="http://localhost:3000"
export FUNC_KEYCLOAK_BASE="http://localhost:18080"
export FUNC_KEYCLOAK_REALM="staff"
export FUNC_OIDC_CLIENT_ID="registry-staff-portal"
export FUNC_OIDC_CLIENT_SECRET="func-gate-client-secret"
export FUNC_OIDC_USERNAME="${FUNC_OIDC_USERNAME:-func-ft-e2e}"
export FUNC_OIDC_PASSWORD="${FUNC_OIDC_PASSWORD:-func-ft-e2e-pass}"
export FUNC_VERIFY_TLS="false"
# Fresh stack always sets FUNC_HOUSEHOLD_ID=h001 above. When reusing a stack,
# pass FUNC_HOUSEHOLD_ID explicitly or default to the fixture id.
export FUNC_HOUSEHOLD_ID="${FUNC_HOUSEHOLD_ID:-h001}"
export FUNC_DOCUMENT_UPLOAD_BUCKET="${FUNC_DOCUMENT_UPLOAD_BUCKET:-documents}"
export FUNC_REGISTRY_DSN="postgresql://registry_user:functest123@127.0.0.1:15432/registry"
export FUNC_KEYCLOAK_ADMIN_USER="admin"
export FUNC_KEYCLOAK_ADMIN_PASSWORD="admin"
export FUNC_PM_PARTNER_API_URL="http://127.0.0.1:18090"
export FUNC_PM_ADMIN_URL="http://127.0.0.1:18091"
export FUNC_CM_STAFF_URL="http://127.0.0.1:18092"
export FUNC_PM_CLIENT_ID="partner-management"
export FUNC_PM_CLIENT_SECRET="func-gate-pm-admin-secret"
export FUNC_CM_CLIENT_ID="consent-manager"
export FUNC_CM_CLIENT_SECRET="func-gate-cm-admin-secret"
# Staff Tier-2 env-gated extras — off unless caller sets them (see header).
export FUNC_AWE_ENABLED="${FUNC_AWE_ENABLED:-0}"
export FUNC_AWE_WEBHOOK_SECRET="${FUNC_AWE_WEBHOOK_SECRET:-}"
export FUNC_REGISTRANT_AUTH="${FUNC_REGISTRANT_AUTH:-0}"
export FUNC_STAFF_INGEST="${FUNC_STAFF_INGEST:-0}"

echo "[compose-gate] FUNC_STAFF_API_BASE=${FUNC_STAFF_API_BASE}"
echo "[compose-gate] FUNC_PARTNER_API_BASE=${FUNC_PARTNER_API_BASE}"
echo "[compose-gate] FUNC_UI_BASE=${FUNC_UI_BASE}"
echo "[compose-gate] FUNC_KEYCLOAK_BASE=${FUNC_KEYCLOAK_BASE}"
echo "[compose-gate] FUNC_PM_PARTNER_API_URL=${FUNC_PM_PARTNER_API_URL}"
echo "[compose-gate] FUNC_CM_STAFF_URL=${FUNC_CM_STAFF_URL}"
echo "[compose-gate] FUNC_AWE_ENABLED=${FUNC_AWE_ENABLED}"
echo "[compose-gate] FUNC_AWE_WEBHOOK_SECRET=${FUNC_AWE_WEBHOOK_SECRET:+set}"
echo "[compose-gate] FUNC_REGISTRANT_AUTH=${FUNC_REGISTRANT_AUTH}"
echo "[compose-gate] FUNC_STAFF_INGEST=${FUNC_STAFF_INGEST}"

cat >"${ROOT}/functional-testing/.env" <<EOF
FUNC_STAFF_API_BASE=${FUNC_STAFF_API_BASE}
FUNC_PARTNER_API_BASE=${FUNC_PARTNER_API_BASE}
FUNC_UI_BASE=${FUNC_UI_BASE}
FUNC_KEYCLOAK_BASE=${FUNC_KEYCLOAK_BASE}
FUNC_KEYCLOAK_REALM=${FUNC_KEYCLOAK_REALM}
FUNC_OIDC_CLIENT_ID=${FUNC_OIDC_CLIENT_ID}
FUNC_OIDC_CLIENT_SECRET=${FUNC_OIDC_CLIENT_SECRET}
FUNC_OIDC_USERNAME=${FUNC_OIDC_USERNAME}
FUNC_OIDC_PASSWORD=${FUNC_OIDC_PASSWORD}
FUNC_VERIFY_TLS=${FUNC_VERIFY_TLS}
FUNC_HOUSEHOLD_ID=${FUNC_HOUSEHOLD_ID}
FUNC_DOCUMENT_UPLOAD_BUCKET=${FUNC_DOCUMENT_UPLOAD_BUCKET}
FUNC_REGISTRY_DSN=${FUNC_REGISTRY_DSN}
FUNC_PM_PARTNER_API_URL=${FUNC_PM_PARTNER_API_URL}
FUNC_PM_ADMIN_URL=${FUNC_PM_ADMIN_URL}
FUNC_CM_STAFF_URL=${FUNC_CM_STAFF_URL}
FUNC_PM_CLIENT_ID=${FUNC_PM_CLIENT_ID}
FUNC_PM_CLIENT_SECRET=${FUNC_PM_CLIENT_SECRET}
FUNC_CM_CLIENT_ID=${FUNC_CM_CLIENT_ID}
FUNC_CM_CLIENT_SECRET=${FUNC_CM_CLIENT_SECRET}
FUNC_AWE_ENABLED=${FUNC_AWE_ENABLED}
FUNC_AWE_WEBHOOK_SECRET=${FUNC_AWE_WEBHOOK_SECRET}
FUNC_REGISTRANT_AUTH=${FUNC_REGISTRANT_AUTH}
FUNC_STAFF_INGEST=${FUNC_STAFF_INGEST}
EOF

# ── Python virtual environment for provisioning scripts ─────────────────────

VENV_DIR="${ROOT}/functional-testing/.venv"
if [ ! -f "${VENV_DIR}/bin/activate" ]; then
  echo "[compose-gate] creating python venv at ${VENV_DIR}"
  python3 -m venv "${VENV_DIR}"
fi
# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"
pip install -q -r "${ROOT}/functional-testing/requirements.txt"

# Upsert + verify deterministic functional seed (Tier-1 reads + FUNC_HOUSEHOLD_ID).
# Idempotent; also covers FUNC_SKIP_STACK=1 reuse.
if [ "${FUNC_SKIP_FUNC_SEED:-0}" != "1" ]; then
  echo "[compose-gate] loading + verifying functional seed"
  if ! FUNC_REGISTRY_DSN="${FUNC_REGISTRY_DSN}" \
    python3 "${ROOT}/functional-testing/scripts/load_functional_seed.py"; then
    echo "[compose-gate] functional seed failed" >&2
    exit 1
  fi
fi

# ── Seed Keycloak test user ─────────────────────────────────────────────────

if [ "${FUNC_SKIP_SEED:-0}" != "1" ]; then
  echo "[compose-gate] seeding keycloak test user"
  python3 "${ROOT}/functional-testing/scripts/keycloak_seed.py" || true
fi

if [ "${FUNC_SKIP_PARTNER_CONSENT_SEED:-0}" != "1" ]; then
  echo "[compose-gate] seeding partner management + consent manager"
  if ! PYTHONPATH="${ROOT}/functional-testing" \
    python3 "${ROOT}/functional-testing/scripts/partner_consent_seed.py"; then
    echo "[compose-gate] partner/consent seed failed" >&2
    exit 1
  fi
fi

sleep "${FUNC_AUTH_WARMUP_SECONDS:-5}"

# ── Run tests ───────────────────────────────────────────────────────────────

GATE_EXIT=0

if [ "${FUNC_SKIP_API:-0}" != "1" ]; then
  echo "[compose-gate] === API workflows (Tier-0) ==="
  cd "${ROOT}/functional-testing"
  PYTHONPATH="${ROOT}/functional-testing" pytest -c api/pytest.ini api/workflows -v --tb=short "$@" || GATE_EXIT=$?

  if [ "${FUNC_RUN_STAFF_TIER1:-0}" = "1" ] && [ "${GATE_EXIT}" -eq 0 ]; then
    echo "[compose-gate] === API staff Tier-1 ==="
    PYTHONPATH="${ROOT}/functional-testing" pytest -c api/pytest.ini api/staff -m tier1 -v --tb=short || GATE_EXIT=$?
  fi

  if [ "${FUNC_RUN_STAFF_TIER2:-0}" = "1" ] && [ "${GATE_EXIT}" -eq 0 ]; then
    echo "[compose-gate] === API staff Tier-2 ==="
    PYTHONPATH="${ROOT}/functional-testing" pytest -c api/pytest.ini api/staff -m tier2 -v --tb=short || GATE_EXIT=$?
  fi

  if [ "${FUNC_RUN_PARTNER_TIER3:-0}" = "1" ] && [ "${GATE_EXIT}" -eq 0 ]; then
    echo "[compose-gate] === API partner Tier-3 ==="
    PYTHONPATH="${ROOT}/functional-testing" pytest -c api/pytest.ini api/partner -m tier3 -v --tb=short || GATE_EXIT=$?
  fi
fi

if [ "${FUNC_SKIP_UI:-0}" != "1" ]; then
  echo "[compose-gate] === UI Playwright ==="
  echo "[compose-gate] FUNC_UI_BASE=${FUNC_UI_BASE}"
  cd "${ROOT}/functional-testing/ui"
  if [ -f package-lock.json ]; then
    npm ci || GATE_EXIT=$?
  else
    echo "[compose-gate] no package-lock.json — using npm install"
    npm install || GATE_EXIT=$?
  fi
  if [ "${GATE_EXIT}" -eq 0 ]; then
    npx playwright install chromium || GATE_EXIT=$?
  fi
  if [ "${GATE_EXIT}" -eq 0 ]; then
    CI=1 npx playwright test "$@" || GATE_EXIT=$?
  fi
fi

if [ "${GATE_EXIT}" -ne 0 ]; then
  echo "[compose-gate] FAILED (exit ${GATE_EXIT})"
  exit "${GATE_EXIT}"
fi

echo "[compose-gate] ALL PASSED"
