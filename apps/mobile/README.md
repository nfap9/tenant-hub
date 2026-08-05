# @tenant-hub/mobile

Tenant Hub（租务通）移动管理端，基于 Expo SDK 57 + expo-router + zustand。

## 启动

在仓库根目录执行：

```bash
pnpm install
pnpm --filter @tenant-hub/mobile dev
```

也可以用 `pnpm --filter @tenant-hub/mobile ios` / `android` 直接起对应模拟器。

## 后端地址配置

API 地址在 `app.json` 的 `expo.extra.apiBaseUrl`，默认 `http://localhost:4000/api`（本地 `apps/api`）：

- **iOS 模拟器**：可直接使用 `localhost`。
- **Android 模拟器**：`localhost` 指模拟器自身，需改为 `http://10.0.2.2:4000/api`。
- **真机调试**：改为宿主机局域网 IP，如 `http://192.168.x.x:4000/api`，并保证手机与宿主机在同一网络。

## 目录结构

- `src/app/` — expo-router 路由（登录、选择组织、Drawer 主界面）
- `src/api/` — API client 与接口封装（自动注入 Bearer token 与 `x-organization-id`）
- `src/store/` — zustand 会话 store（token / orgId 经 expo-secure-store 持久化）
- `src/ui/` — 主题与基础组件
- `src/utils/` — 中文标签映射、金额格式化
