FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/ops-web/package.json apps/ops-web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS development
COPY apps/ops-web apps/ops-web
EXPOSE 5173
CMD ["pnpm", "--filter", "@tenant-hub/ops-web", "dev"]

FROM deps AS build
ARG VITE_API_BASE_URL=http://localhost:4000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY apps/ops-web apps/ops-web
RUN pnpm --filter @tenant-hub/ops-web build

FROM nginx:1.27-alpine AS production
COPY apps/ops-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/ops-web/dist /usr/share/nginx/html
EXPOSE 80
