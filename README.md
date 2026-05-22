# Tenant Hub 公寓管理系统

面向二房东和小型物业公司的轻量化公寓管理系统。仓库使用 TypeScript monorepo：

- `apps/api`：Node.js + Express + Prisma 5 + PostgreSQL
- `apps/ops-web`：React 18 + Vite + Ant Design 5 平台运营端，仅用于系统配置、租户管理、套餐配置等
- `apps/miniprogram`：小程序端（Taro 4 + React 18），用于组织、公寓、房间、租约、账单等业务管理

## 本地启动

```bash
pnpm install
cp .env.example apps/api/.env
cp .env.example apps/ops-web/.env
pnpm db:generate
pnpm db:migrate
pnpm dev
```

开发环境验证码会打印在 API 控制台。默认 API 地址为 `http://localhost:4000/api`，运营前端为 `http://localhost:5173`。

## Docker 启动

所有服务已 Docker 化：

- `postgres`：PostgreSQL 16，宿主机端口 `5433`，容器内端口 `5432`
- `api`：Express API，端口 `4000`
- `ops-web`：平台运营端，端口 `5173`

日常开发请使用热更新模式，容器会挂载本地源码并运行 API 和 Vite 的开发服务器：

```bash
docker compose -f docker-compose.dev.yml up --build
```

需要验证生产镜像时再使用基础 Compose，API 会执行 `prisma migrate deploy`，运营端会以 nginx 静态服务启动：

```bash
docker compose up --build
```

访问地址：

- API 健康检查：`http://localhost:4000/health`
- 平台运营端：`http://localhost:5173`

### 修改 Prisma Schema 后

如果修改了 `apps/api/prisma/schema.prisma`，需要同步数据库迁移并重新生成 Prisma Client。仅靠 Docker 热更新不会自动执行 migration。

本地 pnpm 开发环境：

```bash
pnpm --filter @tenant-hub/api prisma migrate dev
pnpm --filter @tenant-hub/api prisma generate
```

Docker 热更新环境：

```bash
docker compose -f docker-compose.dev.yml exec api sh -c "pnpm --filter @tenant-hub/api prisma migrate deploy && pnpm --filter @tenant-hub/api prisma generate"
docker compose -f docker-compose.dev.yml restart api
```

如果容器还没启动，先运行：

```bash
docker compose -f docker-compose.dev.yml up -d
```

生产镜像环境：

```bash
docker compose up -d --build api
```

生产 API 容器启动时会执行 `prisma migrate deploy`。如果只想手动同步数据库，可运行：

```bash
docker compose exec api sh -c "pnpm prisma migrate deploy && pnpm prisma generate"
docker compose restart api
```

生产部署前请修改 `docker-compose.yml` 中的 `POSTGRES_PASSWORD`、`DATABASE_URL` 和 `JWT_SECRET`。

运营端账号与客户端账号使用同一套手机号登录，但权限隔离。平台角色分为 `USER`（可访问客户端功能）和 `SUPER_ADMIN`（可访问运营端功能）。首个注册用户自动分配 `SUPER_ADMIN` 角色，后续注册用户默认为 `USER`，由超级管理员在运营端"用户管理"中授予其他用户 `SUPER_ADMIN` 角色。

## 已实现范围

- 手机号验证码、密码注册、密码登录、验证码登录
- 初次登录创建/加入组织，组织编辑、满足条件时删除组织
- 组织成员与预制角色，所有者转移
- 公寓、房东合同、房间、水电单价、可选费用配置
- 租约签订、终止、自动生成周期账单
- 房租、水电、其他费用子账单，水电读数录入、批量导出/导入、收款记录
- 运营端只包含套餐配置、租户组织状态管理、额度包发放、角色权限配置、系统参数
- 移动端承载最终用户的组织、公寓、房间、租约、账单、水电录入、收款等业务入口

## 设计说明

系统以组织为租户边界，业务表均携带 `organizationId`。权限采用“角色-权限码”模型，系统预置所有者、管家、只读成员，运营端可配置可选角色与权限。账单生成按租约交租周期创建周期账单，并拆分为房租、水电和其他费用子账单，便于异常处理和收款追踪。

小程序业务页面遵循 [移动端交互规范](docs/mobile-ui-guidelines.md)，页面级导航、实体卡片操作和表单操作需要分层放置。
