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
6. 自动申请 HTTPS 证书（DNS 生效后）

## 六、验证部署
```bash
# API 健康检查
curl https://api.your.domain/health

# 运营端
curl -I https://www.your.domain

# APK 下载页
curl -I https://www.your.domain/download
```

常见问题
｜问题｜解决｜
----
｜DNS 未生效导致 SSL 申请失败｜等待 DNS 生效后，手动执行：sudo certbot --nginx -d api.your.domain -d www.your.domain --non-interactive --agree-tos --email 你的邮箱@example.com｜
｜Docker 命令需 sudo｜脚本安装 Docker 后会将当前用户加入 docker 组，执行 newgrp docker 或重新登录 SSH 即可｜
｜证书续期｜Certbot 已自动配置定时任务，可测试：sudo certbot renew --dry-run｜

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
