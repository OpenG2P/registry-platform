# Agent Portal UI — Next.js standalone image.
#
# Same shape as the Staff Portal UI image (ui/staff-ui/Dockerfile): the agent
# portal is the staff portal pointed at a different realm and login provider,
# so it runs the same way — a Next.js server, not a static bundle behind nginx.
# The server side is not optional: it is the BFF that holds the httpOnly auth
# cookies and adds the backend's auth headers, so the browser never sees a token.
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

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
