# PageHut: production image (Next.js standalone server, ~150 MB).
#   docker build -t pagehut .
#   docker run -p 3000:3000 --env-file .env.local pagehut
# Local mode needs no environment variables; GitHub sign-in needs the four in .env.example.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 PAGEHUT_STANDALONE=1
RUN pnpm build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S pagehut && adduser -S pagehut -G pagehut
COPY --from=build --chown=pagehut:pagehut /app/.next/standalone ./
COPY --from=build --chown=pagehut:pagehut /app/.next/static ./.next/static
COPY --from=build --chown=pagehut:pagehut /app/public ./public
USER pagehut
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/auth/status >/dev/null || exit 1
CMD ["node", "server.js"]
