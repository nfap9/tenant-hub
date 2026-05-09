# Tenant Hub — AI Agent 项目指南

> 本文档面向 AI 编程助手。阅读者应对本项目一无所知，通过本文档即可安全、准确地进行代码修改与问题排查。

---

## 1. 项目概览

Tenant Hub（`tenant-hub`）是一款面向二房东和小型物业公司的**轻量化公寓管理系统**。采用 **pnpm monorepo** 架构，仓库根目录管理三个应用：

- **`apps/api`** — 后端 API 服务（Node.js + Express + Prisma + PostgreSQL）
- **`apps/ops-web`** — 平台运营端 Web 前台（React 18 + Vite + Ant Design 5），仅供系统配置、租户管理、套餐配置等运营操作
- **`apps/mobile`** — 最终用户移动端 App（React Native 0.76 CLI，非 Expo），承载组织、公寓、房间、租约、账单、水电录入、收款等全部业务操作

系统核心特征：
- **多租户按组织隔离**：所有业务表均携带 `organizationId`。
- **RBAC 权限**：采用“角色-权限码”模型，系统预置所有者、管家、只读成员；运营端可配置自定义角色与权限。
- **账单模型**：租约 → 周期账单（`MonthlyBill`）→ 子账单（`BillItem`，含房租、水电、其他费用）→ 收款记录（`Payment`）。支持预付/后付、水电读数录入、CSV 批量导入/导出。
- **平台运营隔离**：普通用户与运营管理员共用一套手机号登录体系，通过 `platformRole` 字段隔离权限。

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 包管理 & Monorepo | pnpm 10.33.0 workspaces |
| 语言 | TypeScript 5.7（`target: ES2022`，`module: ESNext`） |
| 代码检查 | ESLint 9 + `typescript-eslint`（根目录统一配置） |
| 容器化 | Docker + Docker Compose |

### 2.1 API (`apps/api`)
- **运行时**：Node.js 22（`type: "module"`，原生 ESM）
- **框架**：Express 4.21
- **ORM & 数据库**：Prisma 5.22 + PostgreSQL 16
- **构建/运行**：开发用 `tsx watch src/server.ts`；生产先 `tsc` 编译为 `dist/`，再 `node dist/server.js`
- **关键依赖**：Zod（校验）、bcryptjs（密码/OTP 哈希）、jsonwebtoken（JWT）、helmet、cors、dayjs、nanoid

### 2.2 运营端 (`apps/ops-web`)
- **框架**：React 18.3 + Vite 6
- **UI 库**：Ant Design 5（主题主色 `#146c5c`，中文字体 `Avenir Next, PingFang SC, Microsoft YaHei`）
- **构建**：`tsc -b && vite build`，生产以 nginx 1.27-alpine 静态托管
- **部署**：SPA 需配置 `try_files` 回退 `index.html`

### 2.3 移动端 (`apps/mobile`)
- **框架**：React Native 0.76（**React Native CLI，非 Expo**）
- **引擎**：Hermes
- **测试**：Jest 29（`@testing-library/react-native`）
- **打包**：Gradle（Android 项目完整纳入仓库；iOS 目录被 `.gitignore` 忽略）
- **Monorepo 适配**：`metro.config.js` 已配置 `watchFolders` 指向 workspace 根目录，`nodeModulesPaths` 同时解析本地与 workspace `node_modules`
- **环境变量**：`react-native-dotenv` 处理 `API_BASE_URL` 等

---

## 3. 目录结构

```
tenant-hub/
├── apps/
│   ├── api/                  # 后端 API
│   │   ├── src/
│   │   │   ├── server.ts     # 入口：启动 HTTP、确保系统角色、优雅关闭
│   │   │   ├── app.ts        # Express 实例：helmet/cors/路由/errorHandler
│   │   │   ├── config/
│   │   │   │   ├── env.ts    # Zod 校验的环境变量（含生产环境 JWT_SECRET 强校验）
│   │   │   │   └── prisma.ts # Prisma Client 单例
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts   # JWT 校验、组织成员校验、权限校验、平台权限校验
│   │   │   │   └── error.ts  # 全局错误处理
│   │   │   ├── routes/       # 路由：auth, apartments, bills, leases, organizations, admin
│   │   │   └── services/     # 业务逻辑：billing, leaseLifecycle, roles, csv, utilityImport, adminInit…
│   │   ├── prisma/
│   │   │   └── schema.prisma # 完整数据库模型（20+ 张表）
│   │   └── Dockerfile        # 多阶段构建（base → deps → development → build → production）
│   ├── ops-web/              # 平台运营端
│   │   ├── src/
│   │   │   ├── main.tsx      # React 根 + Ant Design ConfigProvider（zh_CN）
│   │   │   ├── App.tsx       # 布局：侧边栏导航、懒加载页面、登录 gate
│   │   │   ├── api/client.ts # fetch 封装：Bearer Auth、x-organization-id、localStorage session
│   │   │   ├── pages/        # AuthPage, AdminPage, OpsDashboardPage, SmsConfigPage
│   │   │   └── styles/global.css
│   │   ├── nginx.conf        # SPA fallback + gzip
│   │   └── Dockerfile        # Node build → nginx static serve
│   └── mobile/               # 移动端 App
│       ├── android/            # 完整 Android 工程（Git 追踪）
│       ├── src/
│       │   ├── app/
│       │   │   ├── AppRoot.tsx       # Tab 导航壳 + 登录 gate + 组织切换
│       │   │   └── useAppSession.ts  # Session / 组织 / 成员状态管理
│       │   ├── screens/        # 业务页面：apartments, auth, bills, home, rooms, settings
│       │   ├── components/     # 共享组件 + ui/ 基础组件（Button, Card, Input, Badge…）
│       │   ├── services/       # http.ts（fetch 封装）、session.ts
│       │   ├── theme/          # tokens + styles
│       │   └── types/domain.ts # 与 Prisma 模型对应的 TypeScript 类型
│       ├── tests/              # 遗留集成测试（tsx 直接运行，共 13 个 `.test.ts`）
│       ├── metro.config.js
│       ├── babel.config.js
│       └── jest.config.js
├── scripts/
│   ├── deploy.sh               # 一键部署脚本（单域名方案）
│   ├── nginx-site.conf         # Nginx 统一站点配置（前端 + API 路径分流）
│   ├── nginx-api.conf          # [已废弃] 双域名方案 API 配置
│   └── nginx-ops.conf          # [已废弃] 双域名方案运营端配置
├── docs/
│   ├── mobile-ui-guidelines.md # 移动端交互规范（层级、按钮、表单、卡片、文案）
│   ├── acceptance-test-plan.md # 发布前核心业务验收清单（7 大章节）
│   ├── 验收问题.md
│   └── superpowers/            # 功能计划（plans）与设计规格（specs）
├── package.json                # 根脚本、engines（node >= 20）、pnpm 10.33.0
├── pnpm-workspace.yaml         # `apps/*`
├── tsconfig.base.json          # 公共 TS 配置（strict, esModuleInterop, skipLibCheck）
├── eslint.config.mjs           # 统一 ESLint 配置（typescript-eslint recommended）
├── docker-compose.prod.yml     # 生产编排（postgres + api + ops-web，nginx 静态）
├── docker-compose.dev.yml      # 开发热更新编排（tsx watch + vite dev，volume 挂载源码）
└── .env.example                # 环境变量模板
```

---

## 4. 常用命令

所有命令均应在**仓库根目录**执行：

```bash
# 安装依赖
pnpm install

# 本地开发（并行启动 API + ops-web 热更新）
pnpm dev

# 移动端开发（启动 Metro + Android）
pnpm dev:mobile        # 等价于 pnpm --filter @tenant-hub/mobile dev:android

# 代码质量流水线（测试 → 类型检查 →  lint → 构建）
pnpm check

# 数据库操作
pnpm db:generate       # prisma generate
pnpm db:migrate        # prisma migrate dev

# 各应用独立命令
pnpm --filter @tenant-hub/api dev
pnpm --filter @tenant-hub/ops-web dev
pnpm --filter @tenant-hub/mobile android

# 移动端构建 APK
pnpm mobile:build:apk

# 代码质量流水线
pnpm check               # test → typecheck → lint → build
```

> 首次使用 Docker 前，请复制对应场景的模板：
> - 本地开发：`cp .env.example .env`
> - 服务器部署：`cp .env.production.example .env.production`

### 4.1 Docker 启动

```bash
# 日常开发（热更新，源码挂载）
docker compose -f docker-compose.dev.yml up --build

# 生产部署（API 会执行 prisma migrate deploy，ops-web 以 nginx 启动）
docker compose --env-file .env.production -f docker-compose.prod.yml up --build
```

访问地址：
- API 健康检查：`http://localhost:4000/health`
- 运营端：`http://localhost:5173`
- PostgreSQL：`localhost:5433`

### 4.2 修改 Prisma Schema 后

**本地 pnpm 环境**：
```bash
pnpm --filter @tenant-hub/api prisma migrate dev
pnpm --filter @tenant-hub/api prisma generate
```

**Docker 热更新环境**（容器已运行时）：
```bash
docker compose -f docker-compose.dev.yml exec api sh -c \
  "pnpm --filter @tenant-hub/api prisma migrate deploy && pnpm --filter @tenant-hub/api prisma generate"
docker compose -f docker-compose.dev.yml restart api
```

---

## 5. 代码风格与规范

### 5.1 ESLint（根目录 `eslint.config.mjs` 统一管控）
- 使用 `typescript-eslint` 推荐配置。
- 忽略：`dist/`, `node_modules/`, `.expo/`, `coverage/`。
- 关键规则：
  - `@typescript-eslint/no-explicit-any`: `off`
  - `@typescript-eslint/no-namespace`: `off`
  - `@typescript-eslint/no-unused-vars`: `error`，但参数名以 `_` 开头可豁免

### 5.2 TypeScript
- 根 `tsconfig.base.json` 启用 `strict: true`、`esModuleInterop: true`、`skipLibCheck: true`、`forceConsistentCasingInFileNames: true`。
- 各应用继承并扩展自己的 `tsconfig.json`。

### 5.3 命名与模块
- API 路由按资源命名：`/api/auth`, `/api/organizations`, `/api/apartments`, `/api/leases`, `/api/bills`, `/api/admin`。
- 服务层文件按业务领域命名，测试文件与源码**同目录**、同名加 `.test.ts` 后缀。
- 移动端源码统一放在 `src/` 下，`@/` 别名映射到 `src/`。

### 5.4 环境变量
- API 使用 `src/config/env.ts` 通过 **Zod Schema** 在运行时强校验环境变量。
- **生产安全规则**：`NODE_ENV === "production"` 时，若 `JWT_SECRET` 仍为默认的 `tenant-hub-dev-secret`，Zod 会抛校验错误阻止启动。
- 各应用均使用 `.env` 文件（已 `.gitignore`），根目录提供 `.env.example`（本地开发）和 `.env.production.example`（服务器部署）作为模板。

---

## 6. 测试策略

### 6.1 API 测试
- **无 Jest/Vitest 框架**。测试通过 `tsx` 直接运行 `.test.ts` 文件。
- 测试文件与源码**同目录共存**：`env.test.ts`, `auth.test.ts`, `billing.test.ts`, `billingPayments.test.ts`, `csv.test.ts`, `leaseLifecycle.test.ts`, `orgInvites.test.ts`, `leaseSettlement.test.ts`, `utilityImport.test.ts`。
- 运行：`pnpm --filter @tenant-hub/api test`（脚本内串联多个 `tsx` 命令）。

### 6.2 移动端测试
- **单元测试**：Jest 29 + `@testing-library/react-native`。
  - 配置在 `jest.config.js`，覆盖率阈值统一为 **30%**（branches/functions/lines/statements）。
  - 测试文件匹配 `**/__tests__/**/*.test.ts` 与 `.tsx`。
  - 运行：`pnpm mobile:test`
- **遗留集成测试**：`tests/` 目录下的 13 个 `.test.ts` 文件，通过 `tsx` 直接运行。
  - 运行：`pnpm --filter @tenant-hub/mobile test:legacy`

### 6.3 发布前必须通过项
- `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm build` 全部通过。
- Docker 冷启动通过，数据库迁移成功。
- 不存在组织间数据越权、已租房间重复签约、账单金额错误、普通用户进入运营端等 P0/P1 问题。

---

## 7. 安全与权限

### 7.1 认证
- 手机号 + 密码 / 手机号 + OTP 验证码登录。
- OTP 与密码均使用 bcrypt 哈希（OTP 默认 10 rounds，密码默认 12 rounds）。
- JWT Bearer Token，有效期默认 7 天。

### 7.2 授权
- **组织隔离**：所有业务查询必须携带 `x-organization-id` 请求头，并由 `auth.ts` 中间件校验当前用户是否为该组织成员。
- **角色权限**：`auth.ts` 中间件提供 `requirePermission(...)`，校验用户在当前组织内的角色是否拥有对应权限码。
- **平台权限**：运营端路由通过 `requirePlatformAccess()` 校验 `effectivePlatformRole`。普通用户默认 `NONE`。
- **超级管理员初始化**：
  - 可通过 `PLATFORM_ADMIN_PHONE` + `PLATFORM_ADMIN_PASSWORD` 配置自动创建超级管理员账号；系统启动时若该手机号不存在则自动创建（`platformRole = SUPER_ADMIN`），已存在则跳过。
  - **开发环境 Fallback**：仅在 `NODE_ENV === "development"` 且系统未配置任何平台管理员时，首个已登录用户可临时进入运营端进行授权。生产环境此机制关闭，必须通过环境变量预置或已有管理员在运营端授权。

### 7.3 生产部署安全提醒
- 生产部署前，请复制 `.env.production.example` 为 `.env.production`，并**务必修改** `JWT_SECRET`、`POSTGRES_PASSWORD`、`CORS_ORIGINS`、`VITE_API_BASE_URL` 为实际值。
- `docker-compose.prod.yml` 已强制要求配置 `VITE_API_BASE_URL`，且运行时依赖 `.env.production` 中的安全项，若未设置将无法启动。
- API 容器启动会自动执行 `prisma migrate deploy`，请确保数据库连接串正确。

---

## 8. 数据库与 Prisma

- **数据库**：PostgreSQL 16。
- **ORM**：Prisma 5.22，Client 生成后位于 `apps/api/node_modules/@prisma/client`。
- **核心模型**：
  - `User`, `Organization`, `OrgMember`, `Role`, `OrgInvite`
  - `Apartment`, `Room`, `Lease`, `LeaseSettlement`, `SettlementPayment`
  - `Bill`, `BillItem`, `MonthlyBill`, `Payment`
  - `MeterReading`, `Plan`, `Subscription`, `OrgQuotaPackage`, `SystemSetting`
- **重要枚举**：`BillStatus`, `LeaseStatus`, `RentCycle`, `BillItemType`, `PlatformRole`, `MeterType`, `MeterReadingSource`…

---

## 9. CI/CD

- **文件**：`.github/workflows/mobile-ci.yml`
- **触发条件**：`push` / `pull_request` 到 `main`/`master`，且变更路径为 `apps/mobile/**`、工作流文件、`tsconfig.base.json`、`eslint.config.mjs`。
- **Job 1 — 检查**：Typecheck → Lint → Test（Jest）
- **Job 2 — 构建 APK**：依赖 Job 1 通过；使用 Java 17 Zulu + Android SDK；执行 `./gradlew assembleRelease`；产物保留 7 天。
- 节点版本：Node 20；包管理器：pnpm 10.33.0。

---

## 10. 移动端交互规范摘要

> 完整规范见 `docs/mobile-ui-guidelines.md`。对 AI 修改 `apps/mobile` 业务页面时，必须遵守以下原则：

1. **层级最小化**：能用原地展开就不用抽屉；能用抽屉就不用独立页面；但绝不能为了少跳转牺牲清晰度。
2. **表单不放弹窗**：弹窗只做确认/警告；有输入内容时用抽屉或独立子页面。
3. **底部面板不承载业务表单**：仅用于筛选、排序、少量快捷选择。
4. **按钮层级**：
   - 主按钮：创建、保存、提交、确认（`button` + `buttonText`）
   - 次级按钮：编辑、展开、取消（`secondaryButton` / `smallButton`）
   - 危险按钮：删除、移除、退租、转移所有者（`smallDangerButton`）
   - 同一区域最多一个主按钮。
5. **卡片职责**：列表卡片只放识别信息和摘要；详情摘要卡片可放“编辑”等对象级操作；卡片内不放页面级“返回”按钮。
6. **文案**：按钮说明动作结果（不用“确定”“操作”）；返回按钮说明返回目标；空状态说明下一步入口。

---

## 11. 关键文件速查

| 目的 | 路径 |
|------|------|
| 根配置 & 脚本 | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs` |
| 环境变量模板 | `.env.example` |
| API 入口 | `apps/api/src/server.ts`, `apps/api/src/app.ts` |
| API 环境校验 | `apps/api/src/config/env.ts` |
| API 认证中间件 | `apps/api/src/middleware/auth.ts` |
| 超级管理员初始化 | `apps/api/src/services/adminInit.ts` |
| Prisma Schema | `apps/api/prisma/schema.prisma` |
| 运营端入口 | `apps/ops-web/src/main.tsx`, `apps/ops-web/src/App.tsx` |
| 运营端短信配置 | `apps/ops-web/src/pages/SmsConfigPage.tsx` |
| 移动端入口 | `apps/mobile/src/app/AppRoot.tsx` |
| 移动端 Metro 配置 | `apps/mobile/metro.config.js` |
| 移动端 Jest 配置 | `apps/mobile/jest.config.js` |
| 移动端交互规范 | `docs/mobile-ui-guidelines.md` |
| 部署指南 | `docs/deployment-guide.md` |
| Docker 生产编排 | `docker-compose.prod.yml` |
| Docker 开发编排 | `docker-compose.dev.yml` |
| CI 工作流 | `.github/workflows/mobile-ci.yml` |
