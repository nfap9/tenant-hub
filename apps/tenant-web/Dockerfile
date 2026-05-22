FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/tenant-web/package.json apps/tenant-web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS development
COPY apps/tenant-web apps/tenant-web
EXPOSE 5173
CMD ["pnpm", "--filter", "@tenant-hub/tenant-web", "dev"]

FROM deps AS build
ARG VITE_API_BASE_URL=http://localhost:4000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY apps/tenant-web apps/tenant-web
RUN pnpm --filter @tenant-hub/tenant-web build

FROM nginx:1.27-alpine AS production
COPY apps/tenant-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/tenant-web/dist /usr/share/nginx/html
EXPOSE 80
