FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && apk add --no-cache openssl wget
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS development
COPY apps/api apps/api
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @tenant-hub/api prisma generate && pnpm --filter @tenant-hub/api dev"]

FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter @tenant-hub/api prisma generate
RUN pnpm --filter @tenant-hub/api build

FROM base AS production
ENV HUSKY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --prod
RUN pnpm --filter @tenant-hub/api prisma generate
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/server.js"]
