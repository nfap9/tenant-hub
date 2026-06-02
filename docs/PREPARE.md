# 项目准备阶段需要了解的内容

### 环境变量

API 通过 `src/config/env.ts` 用 **Zod** 校验环境变量，从仓库根目录的 `.env` 加载。关键变量：

| 变量                          | 说明                                              |
| ----------------------------- | ------------------------------------------------- |
| `DATABASE_URL`                | PostgreSQL 连接字符串（必需）                     |
| `JWT_SECRET`                  | TOKEN加密密钥，生产环境必须显式配置且不能为默认值 |
| `JWT_EXPIRES_IN`              | Token 过期时间，默认 `7d`                         |
| `CORS_ORIGINS`                | 允许跨域的前端地址，逗号分隔                      |
| `PORT`                        | API 端口，默认 `4000`                             |
| `OTP_EXPIRES_IN_MINUTES`      | OTP 过期时间，默认 `5` 分钟                       |
| `BCRYPT_OTP_SALT_ROUNDS`      | OTP 哈希轮数，默认 `10`                           |
| `BCRYPT_PASSWORD_SALT_ROUNDS` | 密码哈希轮数，默认 `12`                           |
| `INVITE_EXPIRES_IN_HOURS`     | 邀请默认有效期，默认 `24` 小时                    |
| `INVITE_EXPIRES_MAX_HOURS`    | 邀请最大有效期，默认 `168` 小时                   |
| `SCHEDULER_ENABLED`           | 定时任务开关，`true` / `false`，默认 `true`       |
> 开发环境准备：复制 `.env.example` 为根目录 `.env`，按需修改。
