# AGENTS.md

## 项目架构

- 本项目是 pnpm monorepo 项目
- 包管理器：pnpm，Node >= 22
- **`apps/api`** — 后端 API 服务（Node.js 22 + Express 4 + Prisma 5 + PostgreSQL 16）
- **`apps/tenant-web`** — Web 管理端（React 18 + Vite 6 + Ant Design 5），承载组织、公寓、房间、租约、账单、水电录入、收款等全部业务操作，同时包含平台运营配置（租户管理、套餐配置、系统配置等）
- **`apps/miniprogram`** — 最终用户小程序端（Taro 4 + React 18），承载组织、公寓、房间、租约、账单、水电录入、收款等全部业务操作

## 代码检查

每次修改完代码需要使用 `pnpm format` 格式化代码；然后使用 `pnpm check` 检查代码

## 命名与模块

- API 路由按资源命名：`/api/auth`, `/api/organizations`, `/api/apartments`, `/api/leases`, `/api/bills`, `/api/admin`。

## 测试代码

测试代码放在各个子项目中的 ``__tests__` 目录中，目录与代码目录保持对应；
