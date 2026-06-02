# AGENTS.md

## 项目概述

Tenant Hub（租务通）是一个轻量化的公寓租赁管理系统，采用 **pnpm monorepo** 架构。项目目前包含：

- **`apps/api`** — 后端 API 服务（Node.js 22 + Express 4 + Prisma 5 + PostgreSQL 16）

---

## 技术栈与运行时架构

需要了解项目技术架构、技术栈、目录结构可查看 `docs/ARCHITRCTURE.md`

---

## 项目准备

如果你要启动项目需要了解： `docs/PREPARE.md`

---

## 构建与常用命令

所有命令均在仓库根目录执行：

| 命令                | 说明                                     |
| ------------------- | ---------------------------------------- |
| `pnpm install`      | 安装所有 workspace 依赖                  |
| `pnpm dev`          | 启动 `api` 开发服务                      |
| `pnpm dev:all`      | 一键启动本地开发（基础设施和项目代码）   |
| `pnpm dev:infra`    | 启动 Docker 基础设施                     |
| `pnpm build`        | 递归构建所有应用                         |
| `pnpm check`        | 全量类型检查 + Lint + 格式检查 + 构建    |
| `pnpm lint`         | 递归执行所有子应用的 lint                |
| `pnpm format`       | Prettier 格式化整个仓库                  |
| `pnpm format:check` | Prettier 格式检查                        |
| `pnpm typecheck`    | 递归执行所有子应用的 TypeScript 类型检查 |
| `pnpm test`         | 递归执行测试                             |
| `pnpm db:generate`  | 生成 Prisma Client                       |
| `pnpm db:migrate`   | 执行 Prisma migrate dev                  |
| `pnpm release`      | 交互式版本发布                           |

---

## 代码风格指南

### 格式化

- **Prettier**：根级统一配置（`.prettierrc`）
  - `semi: true`
  - `singleQuote: true`
  - `tabWidth: 2`
  - `trailingComma: "es5"`
  - `printWidth: 80`
  - `endOfLine: "lf"`

- **每次修改完代码后必须执行**：`pnpm format` 格式化，然后执行 `pnpm check` 检查。

### Lint

- **ESLint**：根级 flat config（`eslint.config.mjs`），使用 `typescript-eslint` + `eslint-config-prettier`
- 忽略目录：`dist/`, `node_modules/`, `.expo/`, `coverage/`
- 规则：
  - `@typescript-eslint/no-explicit-any: off`
  - `@typescript-eslint/no-namespace: off`
  - `@typescript-eslint/no-unused-vars: error`（允许 `_` 前缀参数）

### Git 提交规范

- **Husky** 钩子：
  - `pre-commit`：执行 `pnpm check`
  - `commit-msg`：执行 `node scripts/verify-commit.js`，校验提交信息格式
- **提交信息格式**：`type(scope): subject`
- **允许的 type**：`feat`, `fix`, `docs`, `dx`, `style`, `refactor`, `perf`, `test`, `workflow`, `build`, `ci`, `chore`, `types`, `wip`
- 示例：`feat(bills): add utility import support`

---

## 测试说明

修改测试代码前请阅读 `docs/TESTRULES.md`

---

## 数据库与 ORM

要了解数据库设或ORM 可查看 `docs/MODEL.md`

---

## 部署与 CI/CD

部署相关查看 `docs/DEPLOY.md`

---

## 命名与模块约定

- API 路由按资源命名：`/api/auth`, `/api/organizations`, `/api/apartments`, `/api/leases`, `/api/bills`
- 测试目录与源码目录保持镜像结构：`__tests__/routes/` 对应 `src/routes/`
- TypeScript 路径别名：`@/` → `src/`
- API 使用 ESM

---

## 认证与安全

### 认证架构

- **JWT Bearer Token**：`Authorization: Bearer <jwt>`
- **组织隔离**：通过 `x-organization-id` Header 指定当前组织
- **RBAC 权限**：`Role` 模型存储权限字符串数组，`*` 为通配符
- **平台角色**：`User.platformRole` 区分普通用户与 `SUPER_ADMIN`

### 中间件链

1. `helmet()` — 安全响应头
2. `cors(...)` — 跨域处理（生产环境限制 `CORS_ORIGINS`）
3. `express.json({ limit: '2mb' })` — JSON 解析

### 错误处理

`src/middleware/error.ts` 统一处理：

- `HttpError` → 精确状态码 + 消息
- `ZodError` → 400 + `error.flatten()`
- Prisma `P2002` → 409 "数据已存在"
- Prisma `P2003` → 400 "数据仍被关联使用"
- Prisma `P2025` → 404 "数据不存在"
- 其他未知错误 → 500 "服务器内部错误"

### 其他安全要点

- 密码与 OTP 均使用 bcrypt 哈希存储
- Token 在密码修改后会失效（校验 `passwordChangedAt`）
- 配额操作使用 PostgreSQL advisory lock（`pg_advisory_xact_lock`）防止并发竞争
