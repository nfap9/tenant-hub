# 此文件说明当前项目测试现状和测试规范、说明

### API 测试

- **框架**：Vitest（`vitest.config.ts`）
  - `environment: 'node'`
  - `globals: true`
  - 包含模式：`src/**/*.test.ts`, `__tests__/**/*.test.ts`
  - 覆盖率：v8 provider，阈值 **30%**（branches / functions / lines / statements）

- **测试目录**：`apps/api/__tests__/`，与 `src/` 结构镜像对应
  - `routes/*.test.ts` — 路由集成测试（supertest）
  - `services/*.test.ts` — 服务单元测试
  - `middleware/*.test.ts` — 中间件单元测试
  - `config/*.test.ts` — 配置/Prisma 中间件测试
  - `utils/*.test.ts` — 工具函数测试

- **Mock 策略**：大量使用 `vi.mock()` 模拟 `prisma`、`env`、`bcryptjs`、`smsService` 等模块。Prisma 模型被模拟为带 `vi.fn()` 方法的普通对象。

### Web 端测试

- **当前状态**：`apps/tenant-web` **无测试代码**。
- 无 `__tests__` 目录，无 `*.test.*` / `*.spec.*` 文件。
- `tenant-web` 的 devDependencies 中未引入 vitest、jest、@testing-library/react、playwright、cypress 等测试库。
