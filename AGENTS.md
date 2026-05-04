# Tenant Hub 公寓管理系统

面向二房东和小型物业公司的轻量化公寓管理系统。仓库为 TypeScript monorepo，使用 pnpm workspace 管理。

## 项目结构

```
tenant-hub/
├── apps/
│   ├── api/         # Node.js + Express + Prisma 后端 API
│   ├── ops-web/     # React + Vite + Ant Design 5 平台运营端
│   └── mobile/      # React Native / Expo 最终用户 App
├── package.json           # 根 package.json，定义 workspace scripts
├── pnpm-workspace.yaml    # workspace 定义：apps/*
├── tsconfig.base.json     # 公共 TS 配置
├── docker-compose.yml     # 生产/默认 Docker 编排
├── docker-compose.dev.yml # 开发热更新覆盖
└── .env.example           # 环境变量模板
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 包管理 | pnpm 10.33.0（corepack） |
| 运行时 | Node.js >= 20（Docker 镜像使用 node:22-alpine） |
| 后端框架 | Express 4 + TypeScript 5.7 |
| ORM / 数据库 | Prisma 5.22 + PostgreSQL 16 |
| 校验 | Zod |
| 密码 / OTP | bcryptjs（哈希）+ 6 位随机数字验证码 |
| 认证 | JWT（Bearer Token），有效期 7 天 |
| 运营前端 | React 18 + Vite 6 + Ant Design 5 |
| 移动端 | React Native 0.76 + Expo 52 + react-native-web |
| 容器化 | Docker + Docker Compose，API 与 ops-web 使用多阶段构建 |

## 本地开发

前置要求：Node.js >= 20，pnpm，本地 PostgreSQL（或 Docker）。

```bash
# 1. 安装依赖
pnpm install

# 2. 复制环境变量
cp .env.example apps/api/.env
cp .env.example apps/ops-web/.env

# 3. 生成 Prisma Client 并执行迁移
pnpm db:generate
pnpm db:migrate

# 4. 同时启动 API + 运营前端（并行）
pnpm dev
```

- API 默认地址：`http://localhost:4000/api`
- 运营前端默认地址：`http://localhost:5173`
- 健康检查：`GET http://localhost:4000/health`

开发环境验证码会打印在 API 控制台（`console.info`），无需真实短信通道。

### 常用根级命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 并行启动 api + ops-web 开发服务 |
| `pnpm build` | 递归构建所有 app |
| `pnpm lint` | 递归执行 ESLint（api / ops-web） |
| `pnpm typecheck` | 递归执行 `tsc --noEmit` |
| `pnpm db:generate` | 为 api 生成 Prisma Client |
| `pnpm db:migrate` | 为 api 执行 Prisma Migrate dev |

## Docker 启动（全服务）

```bash
# 默认模式（生产镜像 + nginx 静态服务）
docker compose up --build

# 开发热更新模式（源码挂载、Vite dev server、tsx watch）
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

服务映射：

| 服务 | 容器名 | 宿主机端口 | 说明 |
|------|--------|-----------|------|
| postgres | tenant-hub-postgres | 5433 → 5432 | PostgreSQL 16 |
| api | tenant-hub-api | 4000 → 4000 | Express API，启动时自动 `prisma migrate deploy` |
| ops-web | tenant-hub-ops-web | 5173 → 80（生产）/ 5173（开发） | nginx 静态 或 Vite dev |
| mobile | tenant-hub-mobile | 8081, 19000–19002, 19006 | Expo web 预览 |

> 生产部署前务必修改 `docker-compose.yml` 中的 `POSTGRES_PASSWORD`、`DATABASE_URL` 和 `JWT_SECRET`。

## 代码组织与模块划分

### `apps/api`

API 采用扁平路由 + 服务层结构，入口为 `src/server.ts`。

```
src/
├── server.ts          # 启动：ensureSystemRoles() → listen PORT
├── app.ts             # Express 实例：helmet / cors / json / routers / errorHandler
├── config/
│   ├── env.ts         # Zod 校验环境变量，导出 platformAdminPhones
│   └── prisma.ts      # PrismaClient 单例
├── middleware/
│   ├── auth.ts        # JWT 签发与校验、组织成员校验、权限校验、平台权限校验
│   └── error.ts       # 统一错误处理：HttpError / ZodError / 500
├── routes/
│   ├── auth.ts        # 注册、密码/验证码登录、OTP、/me
│   ├── organizations.ts # 组织 CRUD、成员、角色、所有者转移
│   ├── apartments.ts  # 公寓、费用项、房间批量操作
│   ├── leases.ts      # 租约签订、终止、账单自动生成
│   ├── bills.ts       # 账单、水电读数录入、CSV 批量导出/导入、收款
│   └── admin.ts       # 平台运营接口：用户、套餐、组织状态、角色权限、系统参数
├── services/
│   ├── billing.ts     # 按周期生成账单、刷新账单合计与状态
│   └── roles.ts       # 系统预置角色与权限常量
└── utils/
    ├── asyncHandler.ts # 包装 async 路由，自动 catch 抛给 next(error)
    └── http.ts         # HttpError 类 + ok() 响应助手
```

**重要约定**：

- 所有业务表均携带 `organizationId`，以组织为租户边界。
- 权限模型为「角色-权限码」：系统预置 `owner`（全部权限 `*`）、`manager`、`readonly`；运营端可创建自定义角色并分配权限码。
- 路由层使用 `z.object(...).parse(req.body)` 做输入校验；业务错误使用 `throw new HttpError(status, message)`。
- 异步路由统一包裹 `asyncHandler(...)`，避免未捕获的 Promise 异常导致进程退出。
- 文件导入使用 `.js` 扩展名（因为 `tsconfig` 采用 `NodeNext` 模块解析）。

### `apps/ops-web`

运营端为单页应用，仅用于系统配置、租户管理、套餐配置等。

```
src/
├── main.tsx           # ReactDOM root + Ant Design ConfigProvider（中文、主题色 #146c5c）
├── App.tsx            # 路由级页面切换 + 登录状态校验 + 平台权限拦截
├── api/client.ts      # fetch 封装：自动附加 Bearer Token 和 x-organization-id
├── pages/
│   ├── AuthPage.tsx       # 登录/注册（密码 + 验证码）
│   ├── OpsDashboardPage.tsx # 运营总览 + 组织列表
│   └── AdminPage.tsx        # 用户、套餐、组织、角色权限四合一管理页
└── styles/global.css    # 全局样式、运营端布局、Ant Design 覆写
```

### `apps/mobile`

移动端为 React Native / Expo 项目，承载最终用户的业务入口（组织、公寓、房间、租约、账单等）。

```
src/
├── App.tsx      # 主界面：底部 Tab 导航（首页/组织/公寓/租约/账单）+ 登录态管理
└── api.ts       # fetch 封装 + localStorage 读写 session（兼容 web 预览）
```

当前移动端部分页面仍使用硬编码示例数据（`sampleApartments`、`sampleBills`），处于逐步对接真实 API 的阶段。

## 数据模型要点

关键表与关系（详见 `apps/api/prisma/schema.prisma`）：

- `User` / `OtpCode`：用户与验证码（5 分钟有效期，bcrypt 哈希存储）。
- `Organization` / `OrgMember` / `Role`：多租户组织、成员与角色权限。
- `Apartment` / `Room`：公寓与房间，房间状态 `VACANT | RESERVED | OCCUPIED | MAINTENANCE`。
- `Lease` / `LeaseFee`：租约与附加费用，支持 `MONTHLY | QUARTERLY | YEARLY` 交租周期。
- `Bill` / `BillItem` / `Payment`：周期账单拆分为房租、水电、其他费用子账单，支持部分收款。
- `Plan` / `Subscription` / `OrgQuotaPackage`：套餐订阅与额外额度包。
- `SystemSetting`：键值对系统参数。

账单生成逻辑（`services/billing.ts`）：按租约 `cycle` 从 `startDate` 到 `endDate` 创建周期账单，每个账单拆分为 `RENT` + `UTILITY` + `OTHER` 子项。水电子项初始状态为 `BILLING`，录入读数后计算金额并变为 `UNPAID`。

## 认证与权限

### 用户认证

- 注册：手机号 + 用户名 + 密码（>= 8 位）+ 验证码。
- 登录：支持密码登录或验证码登录。
- Token：JWT Bearer，有效期 7 天，payload 为 `{ id, phone, username }`。

### 组织上下文

登录后请求需携带 Header `x-organization-id`（或在 URL path 中提供），后端通过 `requireOrg` 中间件校验用户是否为该组织活跃成员，并将其 `role.permissions` 挂载到 `req.permissions`。

### 权限码

| 权限码 | 说明 |
|--------|------|
| `*` | 全部权限（owner） |
| `apartment:view` / `apartment:manage` | 公寓查看/管理 |
| `room:view` / `room:manage` | 房间查看/管理 |
| `lease:view` / `lease:manage` | 租约查看/管理 |
| `bill:view` / `bill:manage` | 账单查看/管理 |
| `org:manage` | 组织信息编辑 |
| `member:manage` | 成员管理 |

### 平台运营权限

- 用户字段 `platformRole` 为 `NONE | OPERATOR | ADMIN | SUPER_ADMIN`。
- 环境变量 `PLATFORM_ADMIN_PHONES` 可配置初始化超级管理员手机号（多个用英文逗号分隔）。
- 若系统中没有任何运营管理员，首个已登录用户可临时进入运营端（bootstrap 机制），并在「用户管理」中给他人授权。
- 所有 `/api/admin/*` 接口受 `requirePlatformAccess` 保护。

## 构建与部署

### API

```bash
cd apps/api
pnpm build          # tsc -p tsconfig.json → dist/
pnpm start          # node dist/server.js
```

Docker 多阶段构建：`deps` → `development` / `build` → `production`。生产阶段仅复制 `dist`、`prisma` 与生产依赖，启动命令为 `prisma migrate deploy && node dist/server.js`。

### Ops Web

```bash
cd apps/ops-web
pnpm build          # tsc -b && vite build → dist/
pnpm preview        # vite preview
```

Docker 生产阶段基于 `nginx:1.27-alpine`，`try_files` 配置支持前端路由刷新。

### Mobile

```bash
cd apps/mobile
pnpm web            # expo start --web --host lan --port 19006
```

Docker 仅用于开发预览，非生产构建。

## 代码风格指南

- **模块系统**：ESM（`"type": "module"`），API 中 TS 导入需带 `.js` 扩展名。
- **类型校验**：根级 `pnpm typecheck` 会递归检查；ops-web 使用 `--noEmit`，mobile 当前也使用 `--noEmit`。
- **错误处理**：
  - 路由层抛 `HttpError`，由 `errorHandler` 统一转成 JSON 响应。
  - Zod 校验失败会自动进入 `errorHandler`，返回 `400` 及 `details`。
  - 异步路由必须包 `asyncHandler`。
- **环境变量**：API 端通过 `apps/api/src/config/env.ts` 用 Zod 做运行时校验，禁止在业务代码中直接读取 `process.env`。
- **数据库访问**：统一使用 `apps/api/src/config/prisma.ts` 导出的 PrismaClient 单例，禁止在每个文件里新建实例。
- **语言**：所有代码注释、UI 文案、错误提示均使用中文。

## 测试策略

**当前状态**：项目中尚未配置测试框架，也没有测试文件。`apps/mobile` 的 `lint` 脚本当前仅为 `echo mobile lint pending`。

如需补充测试，建议方向：

- **API**：在 `apps/api` 中引入 Vitest 或 Jest，配合 `prisma` 的测试数据库或 mock，重点覆盖 `services/billing.ts` 的账单生成逻辑、权限中间件、以及各路由的输入校验边界。
- **前端**：ops-web 与 mobile 目前以页面级交互为主，可引入 React Testing Library 做组件渲染与表单交互测试。

## 安全注意事项

- **JWT_SECRET**：生产环境必须替换为高强度随机字符串，当前默认值仅用于本地开发。
- **DATABASE_URL / POSTGRES_PASSWORD**：Docker 编排中使用了弱密码，部署前必须修改。
- **OTP**：开发环境验证码直接打印在控制台，生产环境需接入真实短信通道并缩短有效期或增加速率限制。
- **CORS**：API 当前使用 `cors()` 默认配置（允许全部来源），生产部署应限制为具体域名。
- **helmet**：已启用，提供基础 HTTP 安全头。
- **密码策略**：当前仅要求长度 >= 8 位，未强制复杂度或常见密码检查。
- **Platform Admin Bootstrap**：当 `platformAdminCount === 0` 时，任何首个登录用户都会被视为超级管理员，系统初始化后应尽快创建正式管理员并限制此行为。
