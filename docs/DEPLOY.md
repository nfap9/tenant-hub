# 此文件说明部署相关规则

### Docker

- **API Dockerfile**（`apps/api/Dockerfile`）：多阶段构建（base → deps → development → build → production）
  - 生产镜像基于 `node:22-alpine`，运行 `prisma migrate deploy && node dist/server.js`
  - 暴露端口 `4000`
### Docker Compose

- **`docker-compose.infra.yml`**：本地开发 PostgreSQL 16（宿主机端口 `5433`）
- **`docker-compose.prod.yml`**：生产编排
  - `api` 服务：端口 `127.0.0.1:4000:4000`，healthcheck `/health`

### GitHub Actions

- **`pr-check.yml`**：根配置变更时执行 lint + typecheck（全部）
- **`api-ci.yml`**：API 代码变更时执行 typecheck + lint + build
- **`release.yml`**：`main` 分支每次 push 执行全量检查（根 lint/typecheck + API lint/typecheck/build）

### 版本发布

- 执行 `pnpm release`，交互式选择 `patch / minor / major`
- 脚本自动：更新版本号 → 生成 CHANGELOG → 提交 → 打 tag → 推送
- 提交信息格式：`release: v{x.y.z}`
