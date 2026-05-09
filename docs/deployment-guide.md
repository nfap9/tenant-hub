部署步骤

## 一、DNS配置

域名配置
- api.your.domain
- www.your.domain

## 二、防火墙开启 80、443、22端口

## 三、克隆代码

```bash
git clone <你的仓库地址> ~/tenant-hub
cd ~/tenant-hub
```

## 四、配置.env.production

``` bash
cd ~/tenant-hub
cp .env.production.example .env.production
nano .env.production
```
必须修改以下字段

```
# 数据库密码（16位以上随机字符串）
POSTGRES_PASSWORD=你的强密码
DATABASE_URL="postgresql://postgres:你的强密码@postgres:5432/tenant_hub?schema=public"

# JWT 密钥（32位以上随机字符串）
JWT_SECRET=你的随机字符串

# CORS 域名（必须与运营端域名一致）
CORS_ORIGINS="https://www.your.domain"

# 运营端构建时注入的 API 地址
VITE_API_BASE_URL="https://api.your.domain/api"

# 可选：自动创建超级管理员账号
PLATFORM_ADMIN_PHONE="你的手机号"
PLATFORM_ADMIN_PASSWORD="管理员密码"
```

## 五、执行部署脚本

> ⚠️ **重要：先确认 DNS 已生效**
>
> `deploy.sh` 会在脚本内部检查域名解析是否指向本机 IP。如果 DNS 未生效，脚本会**跳过 HTTPS 证书申请**，避免触发 Let's Encrypt 速率限制。
>
> 部署前建议先验证：
> ```bash
> dig +short api.your.domain
> dig +short www.your.domain
> ```
> 确保输出为你的服务器公网 IP。

```bash
cd ~/tenant-hub
bash scripts/deploy.sh \
  --domain-api api.your.domain \
  --domain-ops www.your.domain \
  --email 你的邮箱@example.com
```
脚本会自动完成：

1. 安装 Docker、Nginx、Certbot
2. 配置防火墙（ufw）和自动备份脚本
3. 校验 .env.production
4. 构建并启动 Docker 服务（PostgreSQL + API + ops-web）
5. 配置 Nginx 反向代理
6. 自动申请 HTTPS 证书（仅在 DNS 已生效时）

## 六、验证部署
```bash
# API 健康检查
curl https://api.your.domain/health

# 运营端
curl -I https://www.your.domain

# APK 下载页
curl -I https://www.your.domain/download
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| **部署后 HTTPS 无法访问**（443 Connection Refused） | DNS 未生效时，脚本为保护 Let's Encrypt 配额会**跳过证书申请** | 等待 DNS 生效后手动申请：<br>`sudo certbot --nginx -d api.your.domain -d www.your.domain --non-interactive --agree-tos --email 你的邮箱@example.com`<br>申请后 certbot 会自动修改 Nginx 配置添加 443 监听，执行 `sudo nginx -t && sudo systemctl reload nginx` 即可 |
| Docker 命令需 sudo | 脚本安装 Docker 后将当前用户加入 docker 组，但当前 SSH 会话未刷新组权限 | 执行 `newgrp docker` 或重新登录 SSH |
| 证书续期 | — | Certbot 已自动配置定时任务，可测试：`sudo certbot renew --dry-run` |

### 关于「DNS 未生效时跳过证书申请」的设计说明

`deploy.sh` 在第 6 步会尝试通过 `getent hosts` / `dig +short` 查询域名解析的 IP。如果查询结果不等于本机公网/内网 IP，脚本会判定 DNS 未就绪，输出：

```
域名 DNS 未正确指向本机，跳过证书申请
```

这是有意为之的防护策略：
- Let's Encrypt 的 HTTP-01 挑战要求域名必须解析到本机 80 端口
- 若强制申请，certbot 会失败并计入**速率限制**（同一域名每小时最多 5 次失败）
- 因此脚本选择保守策略：跳过申请，让用户在 DNS 生效后手动执行

**经验总结**：新域名刚配置 A 记录后，全球 DNS 生效通常需要 5 分钟~数小时。建议在部署前先 `dig +short` 确认，或部署后若看到「跳过证书申请」提示，直接手动执行 certbot 即可，无需重新跑完整部署脚本。

后续更新
```bash
cd ~/tenant-hub
git pull origin main
bash scripts/deploy.sh --domain-api api.your.domain --domain-ops www.your.domain --email 你的邮箱@example.com
```
如需构建并上传 APK：
```bash
pnpm mobile:build:apk
# 本地构建后上传
scp apps/mobile/android/app/build/outputs/apk/release/app-release.apk \
  ubuntu@{path}:~/tenant-hub/apk/tenant-hub-v1.0.0.apk
```
