# AGENTS.md

## 项目概述

Tenant Hub（租务通）是一个轻量化的公寓租赁管理系统，采用 **pnpm monorepo** 架构。项目包含三个应用：

- **`apps/api`** — 后端 API 服务（Node.js 22 + Express 4 + Prisma 5 + PostgreSQL 16）
- **`apps/tenant-web`** — Web 管理后台（React 18 + Vite 6 + Ant Design 5）
- **`apps/mobile`** — 移动端 App（Expo SDK 57 + expo-router + zustand），以 AI agent 对话为核心入口

Web 端面向公寓运营方，仅保留核心租赁业务功能：组织管理、房源管理、房间管理、租约管理、账单与收款、水电抄表。

移动端首页即 AI 助手（复用后端 `/api/ai/*` 的 SSE 流式对话与写操作人工确认），另配资产、财务、抄表三个业务页（只读为主 + 抄表录入）；UI 风格与组件参考 tenant-assis 项目（白底、靛蓝 `#4F46E5` 主色、卡片式、无第三方组件库）。移动端启动：`pnpm dev:mobile`（iOS 模拟器默认 `http://localhost:4000/api`，真机/Android 需修改 `apps/mobile/app.json` 的 `extra.apiBaseUrl`，详见 `apps/mobile/README.md`）。

### AI Agent 架构（LangGraph）

后端 AI 模块（`apps/api/src/ai/`）基于 **LangGraph JS** 构建：

- `ai/graph/` — 核心：`StateGraph`（`MessagesAnnotation`）双节点（`agent` 调模型 ⇄ `tools` 执行工具），`PostgresSaver` checkpointer 持久化会话状态（`thread_id = conversationId`，消息历史存 checkpoints 表，不再有 AiMessage 表）
- 模型层：`@langchain/openai` / `@langchain/anthropic`，多模型 fallback 用 `withFallbacks()`；模型注册表存于数据库 `AiModel` 表（`ai/models/registry.ts` 异步 DB 版 + 进程内缓存），通过 Web 端「AI 模型管理」页（`/api/ai-models` CRUD，需 `aiModel:manage` 权限）维护，无环境变量配置入口
- 工具集（`ai/tools/`）：7 读 + 7 写共 14 个 `ToolMeta`（zod schema + execute/preview + 权限）；读工具直接执行，写工具在 tools 节点 preview 后 `interrupt()` 暂停图，等待人工确认
- SSE 协议（chat / resume 共用）：`text_delta`（真流式）、`message`（消息快照）、`tool_call`、`interrupt`（待确认操作）、`error`、`done`
- 写操作确认：`POST /api/ai/conversations/:id/resume`（`{ actionId, decision: 'approve'|'reject' }`），以 `Command` 恢复图并 SSE 流出后续执行
- 历史回放：`GET /api/ai/conversations/:id/state`（图状态消息 + 待处理 interrupts + 审计记录）
- 上下文窗口管理：agent 节点调用模型前按 `AiModel.contextWindowTokens` 裁剪历史（`ai/graph/contextWindow.ts`，只裁输入不动 checkpoint）
- 可观测性（可选）：配置 `LANGSMITH_TRACING=true` 等环境变量后，LangSmith 自动追踪图/模型/工具调用，trace 带 `conversationId`/`organizationId`/`userId` 元数据（见 `.env.example`，trace 含完整对话内容，注意数据合规）
- 审计表（Prisma）：`AiToolCall`（工具调用记录）、`AiPendingAction`（待确认操作审计）、`AiUsageDaily`（用量记账）

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
| `pnpm dev`          | 并行启动 `api` + `tenant-web` 开发服务   |
| `pnpm dev:mobile`   | 启动移动端 Expo 开发服务                 |
| `pnpm dev:all`      | 一键启动本地开发（基础设施和项目代码）   |
| `pnpm dev:infra`    | 启动 Docker 基础设施                     |
| `pnpm build`        | 递归构建所有应用                         |
| `pnpm check`        | 全量类型检查 + Lint + 格式检查 + 构建    |
| `pnpm lint`         | 递归执行所有子应用的 lint                |
| `pnpm format`       | Prettier 格式化整个仓库                  |
| `pnpm format:check` | Prettier 格式检查                        |
| `pnpm typecheck`    | 递归执行所有子应用的 TypeScript 类型检查 |
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
- **允许的 type**：`feat`, `fix`, `docs`, `dx`, `style`, `refactor`, `perf`, `workflow`, `build`, `ci`, `chore`, `types`, `wip`
- 示例：`feat(bills): add utility reading support`

---

## 部署与 CI/CD

部署相关查看 `docs/DEPLOY.md`

---

## 命名与模块约定

- API 路由按资源命名：`/api/auth`, `/api/organizations`, `/api/apartments`, `/api/leases`, `/api/bills`
- API 文档（Swagger UI）：`http://localhost:4000/api-docs`（原始 spec 在 `/api-docs.json`）；由 `apps/api/src/openapi/` 基于 zod schema 生成，请求 schema 以路由文件导出的 zod const 为单一事实来源，新增/修改端点需同步维护 `openapi/docs/` 下对应注册文件
- TypeScript 路径别名：`@/` → `src/`
- API 与 Web 端均使用 ESM

---

## 认证与安全

### 认证架构

- **JWT Bearer Token**：`Authorization: Bearer <jwt>`
- **组织隔离**：通过 `x-organization-id` Header 指定当前组织
- **RBAC 权限**：`Role` 模型存储权限字符串数组，`*` 为通配符

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

- 密码使用 bcrypt 哈希存储
- Token 在密码修改后会失效（校验 `passwordChangedAt`）
