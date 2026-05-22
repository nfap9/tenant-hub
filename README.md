# Tenant Hub 公寓管理系统

面向二房东和小型物业公司的轻量化公寓管理系统。仓库使用 TypeScript monorepo：

- `apps/api`：Node.js + Express + Prisma 5 + PostgreSQL
- `apps/tenant-web`：React 18 + Vite + Ant Design 5 + React Router 7，集成运营配置与业务前台
- `apps/miniprogram`：小程序端（Taro 4 + React 18），用于组织、公寓、房间、租约、账单等业务管理

## 开发环境

### 方式一：Docker 启动中间件 + pnpm 手动启动各服务（推荐）

仅使用 Docker 启动 PostgreSQL，API 和前端通过 pnpm 手动启动，便于源码调试和热更新。

```bash
# 1. 安装依赖
pnpm install

# 2. 创建环境变量文件（已包含 Docker 数据库连接地址）
cp .env.example .env

# 3. 启动 PostgreSQL
pnpm dev:infra

# 4. 生成 Prisma Client 并执行数据库迁移
pnpm db:generate
pnpm db:migrate

# 5. 同时启动 API + tenant-web
pnpm dev
```

各服务地址：

- API：`http://localhost:4000/api`
- tenant-web：`http://localhost:5174`
- PostgreSQL（宿主机）：`localhost:5433`

> 开发环境验证码会打印在 API 控制台。

如果只启动 API 和小程序 H5 预览：

```bash
# 启动 API + 小程序 H5 模式
pnpm --parallel --filter @tenant-hub/api --filter @tenant-hub/miniprogram dev:h5
```

### 方式二：一键全量启动

```bash
pnpm dev:all
```

这条命令会自动执行：启动 PostgreSQL → Prisma generate → Prisma migrate → 同时启动 API + tenant-web。

### 方式三：全 Docker 启动（验证生产镜像）

```bash
docker compose -f docker-compose.prod.yml up --build
```

该模式用于验证生产镜像构建，API 会执行 `prisma migrate deploy`，前端会以 nginx 静态服务启动。

## 各服务独立启动命令

| 命令 | 说明 |
|------|------|
| `pnpm dev:infra` | Docker 启动 PostgreSQL |
| `pnpm dev` | 同时启动 API + tenant-web |
| `pnpm dev:web` | 同 `pnpm dev` |
| `pnpm dev:miniprogram` | 启动小程序微信开发者工具编译模式 |
| `pnpm db:generate` | 生成 Prisma Client |
| `pnpm db:migrate` | 执行数据库迁移（交互式） |
| `pnpm check` | 全量类型检查 + Lint + 构建 |

## 环境变量

本地开发只需在**仓库根目录**创建 `.env`（复制 `.env.example`），API 会自动从根目录加载。关键变量：

| 变量 | 说明 | 开发默认值 |
|------|------|-----------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://postgres:postgres@localhost:5433/tenant_hub?schema=public` |
| `JWT_SECRET` | Token 签名密钥 | `tenant-hub-dev-secret`（生产必须修改） |
| `CORS_ORIGINS` | 允许跨域的前端地址 | `http://localhost:5174,http://localhost:8081,http://localhost:19006` |
| `PORT` | API 端口 | `4000` |

## 数据库迁移

修改 `apps/api/prisma/schema.prisma` 后：

```bash
# 本地 pnpm 环境
pnpm db:migrate
pnpm db:generate
```

如果 Docker 中的 PostgreSQL 已启动但迁移失败，检查 `.env` 中的 `DATABASE_URL` 是否指向 `localhost:5433`。

## 权限说明

- 首个注册用户自动分配 `SUPER_ADMIN` 平台角色，可访问运营配置菜单（`/ops`）。
- 后续注册用户默认为 `USER`。
- 超级管理员可在运营配置 → 用户管理中授予其他用户 `SUPER_ADMIN` 角色。

## 已实现范围

- 手机号验证码、密码注册、密码登录、验证码登录
- 初次登录创建/加入组织，组织编辑、满足条件时删除组织
- 组织成员与预制角色，所有者转移
- 公寓、房东合同、房间、水电单价、可选费用配置
- 租约签订、终止、自动生成周期账单
- 房租、水电、其他费用子账单，水电读数录入、批量导出/导入、收款记录
- 运营端（整合在 tenant-web 中）：套餐配置、租户组织状态管理、角色权限配置、系统参数、短信配置
- 移动端承载最终用户的组织、公寓、房间、租约、账单、水电录入、收款等业务入口

## 设计说明

系统以组织为租户边界，业务表均携带 `organizationId`。权限采用"角色-权限码"模型，系统预置所有者、管家、只读成员，运营端可配置可选角色与权限。账单生成按租约交租周期创建周期账单，并拆分为房租、水电和其他费用子账单，便于异常处理和收款追踪。
