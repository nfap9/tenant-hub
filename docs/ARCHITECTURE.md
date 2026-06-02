# 技术架构

### Monorepo 结构

```
tenant-hub/
├── apps/
│   ├── api/                 # 后端 API
│   ├── miniprogram/         # 微信小程序
│   └── tenant-web/          # Web 管理后台
├── package.json             # 根 workspace 配置
├── pnpm-workspace.yaml      # packages: ['apps/*']
├── tsconfig.base.json       # 共享 TypeScript 基础配置
├── eslint.config.mjs        # 根级 ESLint flat config
├── .prettierrc              # Prettier 配置
├── docker-compose.infra.yml # 本地开发 PostgreSQL
├── docker-compose.prod.yml  # 生产环境 Docker 编排
└── .github/workflows/       # GitHub Actions CI/CD
```

> **注意**：当前 monorepo 只有 `apps/*`，没有共享的 `packages/*` 公共库。三个应用之间代码独立，各自维护 domain types 与 API client。

## 技术栈

### 后端 API (`apps/api`)

| 层级      | 技术                                       |
| --------- | ------------------------------------------ |
| 运行时    | Node.js 22（`type: "module"`，纯 ESM）     |
| 框架      | Express 4                                  |
| ORM       | Prisma 5.22.0                              |
| 数据库    | PostgreSQL 16                              |
| 认证      | bcryptjs + jsonwebtoken + nanoid（OTP）    |
| 校验      | Zod                                        |
| 定时任务  | node-cron（每日 02:00 Asia/Shanghai 执行） |
| 开发/构建 | `tsx watch`（开发）、`tsc`（构建）         |
| 其他      | helmet（安全头）、cors、dayjs、dotenv      |

### Web 管理端 (`apps/tenant-web`)

| 层级       | 技术                                                  |
| ---------- | ----------------------------------------------------- |
| 框架       | React 18                                              |
| 构建工具   | Vite 6                                                |
| UI 库      | Ant Design 5 + `@ant-design/icons`                    |
| 路由       | React Router DOM 7                                    |
| 样式       | SCSS（全局 + 组件级）                                 |
| 开发服务器 | 端口 5174，启用 polling watch（兼容 Docker/容器环境） |
| 构建流程   | `tsc -b && vite build`                                |

### 微信小程序端 (`apps/miniprogram`)

| 层级     | 技术                      |
| -------- | ------------------------- |
| 框架     | Taro 4.0.9 + React 18     |
| 编译器   | Webpack 5                 |
| 样式     | SCSS / Sass               |
| 主要平台 | 微信小程序（WeChat）      |
| 构建命令 | `taro build --type weapp` |

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
```

### Web 端代码结构

```
apps/tenant-web/src/
├── main.tsx                    # Vite 入口
├── App.tsx                     # ConfigProvider + 路由
├── router/
│   └── index.tsx               # React Router，懒加载页面 + 认证守卫
├── layout/
│   └── MainLayout.tsx          # 侧边栏 + 头部 + 内容区
├── pages/                      # 按业务域分组
│   ├── dashboard/
│   ├── apartments/             # 列表、详情、表单、费用、批量房间
│   ├── rooms/                  # 列表、表单、租约新建/编辑/退租
│   ├── bills/                  # 列表、收款、抄表、水电、导入导出、月度明细
│   ├── settings/               # 设置、我的租约、组织、账户、套餐
│   └── ops/                    # 运营后台（Dashboard、用户、套餐、组织、角色、短信、系统设置）
├── api/                        # 按域分组的 API client（fetch 封装）
├── components/ui/              # 可复用 UI（EmptyState、PageHeader、StatCard）
├── context/
│   └── AppSessionContext.tsx   # 全局会话/组织/权限状态（React Context）
├── styles/
│   ├── global.scss
│   ├── _variables.scss
│   └── _mixins.scss
├── types/
│   └── domain.ts
└── utils/
    ├── batchRooms.ts
    ├── format.ts
    └── storage.ts            # localStorage 封装
```

**路由认证守卫：**

- `RequireAuth` — 未登录重定向到 `/login`
- `RequireOrg` — 无组织成员资格时拦截
- `RequireSuperAdmin` — 限制 `/ops/*` 仅 SUPER_ADMIN 可访问

### 小程序端代码结构

```
apps/miniprogram/src/
├── app.tsx                     # Taro 应用入口，提供 AppSessionContext
├── app.config.ts               # 页面列表 + TabBar 配置
├── app.scss                    # 全局样式 + CSS 变量
├── api/
│   └── client.ts               # Taro.request 封装 + 401 处理
├── pages/                      # 按业务域分组（与 Web 端对应）
│   ├── index/                  # 首页（Dashboard）
│   ├── apartments/
│   ├── rooms/
│   ├── bills/
│   ├── settings/
│   └── login/
├── components/
│   ├── ui/                     # 自定义 UI 组件库（Button、Card、Input、Badge 等）
│   ├── NoOrganization.tsx
│   ├── TaskSheet.tsx
│   └── Toast.tsx
├── context/
│   └── AppSessionContext.tsx   # 全局会话/组织状态
├── theme/
│   └── tokens.scss             # SCSS 设计令牌
├── types/
│   └── domain.ts
└── utils/
    ├── batchRooms.ts
    ├── format.ts
    └── storage.ts              # Taro 存储封装
```
