# =============================================================================
# OpenG2P Registry Agent Portal UI — Multi-stage Docker Build
# =============================================================================
# Build:
#   docker build -t openg2p-registry-agent-ui:latest \
#     --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
#     --build-arg BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ") ./ui/agent-ui
#
# Run:
#   docker run -p 8080:8080 openg2p-registry-agent-ui:latest
#
# Deploy pattern:
#   Static SPA served by nginx, which DOES proxy `/agent_portal/*` to the API
#   (the SPA calls its own origin). Set AGENT_API_UPSTREAM to the API's
#   host:port — in Kubernetes "<release>-agent-portal-api:80".
#   React-router deep links fall back to /index.html (see nginx.conf).
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first for better layer caching.
COPY package*.json ./
RUN npm ci

# Copy sources + build.
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime (non-root nginx)
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine

ARG GIT_COMMIT=dev
ARG BUILD_TIME=dev

LABEL org.opencontainers.image.source="https://gitlab.com/openg2p/registry/registry-platform"
LABEL org.opencontainers.image.title="OpenG2P Registry Agent Portal UI"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

# Installed as a TEMPLATE: the nginx entrypoint runs envsubst over
# /etc/nginx/templates/*.template into /etc/nginx/conf.d/ at start, which is
# what lets one image point at a release-prefixed Service name.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# docker-compose default; Kubernetes overrides it from the chart.
ENV AGENT_API_UPSTREAM="agent-portal-api:8000"
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --spider http://localhost:8080/ || exit 1
