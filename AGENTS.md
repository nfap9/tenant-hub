# AGENTS.md

- 本项目是 pnpm monorepo 项目
- 包管理器：pnpm，Node >= 22
- **`apps/api`** — 后端 API 服务（Node.js 22 + Express 4 + Prisma 5 + PostgreSQL 16）
- **`apps/ops-web`** — 平台运营端 Web 前台（React 18 + Vite 6 + Ant Design 5），仅供系统配置、租户管理、套餐配置等运营操作
- **`apps/miniprogram`** — 最终用户小程序端（Taro 4 + React 18），承载组织、公寓、房间、租约、账单、水电录入、收款等全部业务操作


## 代码风格与规范

### ESLint（根目录 `eslint.config.mjs` 统一管控）
- 使用 `typescript-eslint` 推荐配置。

### TypeScript
- 根 `tsconfig.base.json` 启用 `strict: true`、`esModuleInterop: true`、`skipLibCheck: true`、`forceConsistentCasingInFileNames: true`。
- 各应用继承并扩展自己的 `tsconfig.json`。
- API 使用 `module: NodeNext` / `moduleResolution: NodeNext`（ESM 原生运行）。
- ops-web 使用 `allowImportingTsExtensions: true` + `noEmit: true`（Vite 负责编译）。

### 命名与模块
- API 路由按资源命名：`/api/auth`, `/api/organizations`, `/api/apartments`, `/api/leases`, `/api/bills`, `/api/admin`。
- 服务层文件按业务领域命名，测试文件与源码**同目录**、同名加 `.test.ts` 后缀。
- 小程序源码统一放在 `src/` 下。

### 环境变量
- API 使用 `src/config/env.ts` 通过 **Zod Schema** 在运行时强校验环境变量。
- **生产安全规则**：`NODE_ENV === "production"` 时，若 `JWT_SECRET` 仍为默认的 `tenant-hub-dev-secret`，Zod 会抛校验错误阻止启动。
- 各应用均使用 `.env` 文件（已 `.gitignore`），根目录提供 `.env.example` 作为模板。

## 关键文件速查

| 目的 | 路径 |
|------|------|
| 根配置 & 脚本 | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs` |
| 环境变量模板 | `.env.example`, `.env.production.example` |
| API 入口 | `apps/api/src/server.ts`, `apps/api/src/app.ts` |
| API 环境校验 | `apps/api/src/config/env.ts` |
| API 认证中间件 | `apps/api/src/middleware/auth.ts` |
| 超级管理员初始化 | `apps/api/src/services/adminInit.ts` |
| Prisma Schema | `apps/api/prisma/schema.prisma` |
| 运营端入口 | `apps/ops-web/src/main.tsx`, `apps/ops-web/src/App.tsx` |
| 运营端短信配置 | `apps/ops-web/src/pages/SmsConfigPage.tsx` |
| 小程序入口 | `apps/miniprogram/src/app.tsx` |
| 小程序路由配置 | `apps/miniprogram/src/app.config.ts` |
| 小程序交互规范 | `docs/mobile-ui-guidelines.md` |
| Docker 生产编排 | `docker-compose.prod.yml` |
| Docker 开发编排 | `docker-compose.dev.yml` |
| CI 工作流 (GitHub) | `.github/workflows/api-ci.yml`, `.github/workflows/ops-web-ci.yml`, `.github/workflows/pr-check.yml`, `.github/workflows/release.yml` |
| CI/CD 流水线 (Jenkins) | `Jenkinsfile`, `docker-compose.infra.yml` |
| 发布脚本 | `scripts/release.js` |
| 提交校验 | `scripts/verify-commit.js` |
