# 技术架构

### Monorepo 结构

```
tenant-hub/
├── apps/
│   └── api/                 # 后端 API
├── package.json             # 根 workspace 配置
├── pnpm-workspace.yaml      # packages: ['apps/*']
├── tsconfig.base.json       # 共享 TypeScript 基础配置
├── eslint.config.mjs        # 根级 ESLint flat config
├── .prettierrc              # Prettier 配置
├── docker-compose.infra.yml # 本地开发 PostgreSQL
├── docker-compose.prod.yml  # 生产环境 Docker 编排
└── .github/workflows/       # GitHub Actions CI/CD
```

## 技术栈

### 后端 API (`apps/api`)

| 层级      | 技术                                                 |
| --------- | ---------------------------------------------------- |
| 运行时    | Node.js 22（`type: "module"`，纯 ESM）               |
| 框架      | Express 4                                            |
| ORM       | Prisma 5.22.0                                        |
| 数据库    | PostgreSQL 16                                        |
| 认证      | bcryptjs + jsonwebtoken + nanoid（OTP）              |
| 校验      | Zod                                                  |
| 定时任务  | node-cron（每日 02:00 Asia/Shanghai 执行）           |
| 开发/构建 | `tsx watch`（开发）、`tsc`（构建）、`vitest`（测试） |
| 其他      | helmet（安全头）、cors、dayjs、dotenv                |

## 代码组织

### API 代码结构

```
apps/api/
├── prisma/
│   ├── schema.prisma        # 单文件 Prisma schema
│   └── migrations/          # 迁移文件（约 10+ 个）
├── src/
│   ├── server.ts            # 入口：启动 HTTP 服务、定时任务、优雅关闭
│   ├── app.ts               # Express 应用：中间件 + 路由挂载
│   ├── config/
│   │   ├── env.ts           # Zod 环境变量解析（加载根目录 .env）
│   │   └── prisma.ts        # PrismaClient 单例 + 软删除中间件
│   ├── middleware/
│   │   ├── auth.ts          # JWT 认证、组织成员、权限、平台角色
│   │   └── error.ts         # 全局错误处理（HttpError / Zod / Prisma）
│   ├── routes/              # Express 路由（无独立 controller 文件，逻辑内联）
│   │   ├── auth.ts          # /api/auth
│   │   ├── organizations.ts # /api/organizations
│   │   ├── apartments.ts    # /api/apartments
│   │   ├── leases.ts        # /api/leases
│   │   ├── bills.ts         # /api/bills
│   │   ├── admin.ts         # /api/admin
│   │   └── platform.ts      # /api/platform
│   ├── services/            # 业务逻辑层
│   │   ├── billing.ts
│   │   ├── leaseLifecycle.ts
│   │   ├── leaseSettlement.ts
│   │   ├── autoRenew.ts
│   │   ├── scheduler.ts
│   │   ├── csv.ts
│   │   ├── utilityImport.ts
│   │   ├── smsService.ts
│   │   ├── roles.ts
│   │   ├── quotas.ts
│   │   ├── orgInvites.ts
│   │   └── adminInit.ts
│   ├── types/
│   │   └── express.d.ts     # 扩展 Express.Request（user / organizationId / permissions）
│   └── utils/
│       ├── asyncHandler.ts  # 包装 async 路由处理器以捕获异常
│       └── http.ts          # HttpError 类 + ok() 响应辅助函数
└── __tests__/               # 测试目录，与 src 目录结构镜像对应
    ├── config/
    ├── middleware/
    ├── routes/
    ├── services/
    └── utils/
```
