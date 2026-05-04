FROM node:22-alpine
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/mobile/package.json apps/mobile/package.json
RUN pnpm install --frozen-lockfile

COPY apps/mobile apps/mobile
WORKDIR /app/apps/mobile
EXPOSE 8081 19000 19001 19002 19006
CMD ["pnpm", "web"]
