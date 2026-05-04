# Tenant Hub 公寓管理系统

面向二房东和小型物业公司的轻量化公寓管理系统。仓库使用 TypeScript monorepo：

- `apps/api`：Node.js + Express + Prisma 5 + PostgreSQL
- `apps/ops-web`：React 18 + Vite + Ant Design 5 平台运营端，仅用于系统配置、租户管理、套餐配置等
- `apps/mobile`：React Native/Expo 最终用户 App，用于组织、公寓、房间、租约、账单等业务管理

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
- `api`：Express API，端口 `4000`，启动时自动执行 `prisma migrate deploy`
- `ops-web`：平台运营端 nginx 静态服务，端口 `5173`
- `mobile`：最终用户 App 的 React Native/Expo Web 预览服务，端口 `19006`

```bash
docker compose up --build
```

开发热更新模式：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

访问地址：

- API 健康检查：`http://localhost:4000/health`
- 平台运营端：`http://localhost:5173`
- 客户端 App 浏览器预览：`http://localhost:19006`

生产部署前请修改 `docker-compose.yml` 中的 `POSTGRES_PASSWORD`、`DATABASE_URL` 和 `JWT_SECRET`。

运营端账号与客户端账号使用同一套手机号登录，但权限隔离。普通用户默认没有运营平台权限；在系统没有任何运营管理员时，首个已登录用户可临时进入运营端，在“用户管理”中给指定用户授予运营权限。也可以通过环境变量 `PLATFORM_ADMIN_PHONES` 配置初始化超级管理员手机号，多个手机号用英文逗号分隔。

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
