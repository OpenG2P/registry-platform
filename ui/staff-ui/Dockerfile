# Staff Portal UI — Next.js standalone image.
#
# Built directly from this directory (docker build context = ui/staff-portal-ui);
# the source lives in this repo, so there is no clone step. Published as
# openg2p/openg2p-registry-staff-portal-ui by
# .github/workflows/docker-staff-portal-ui.yml.
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
# Install dependencies first so this layer is cached unless the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci
# Then copy the rest of the source and produce the standalone build
# (next.config.ts sets `output: "standalone"`).
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN npm install sharp

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
