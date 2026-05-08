# Tenant Hub 生产部署方案

> 适用场景：单台服务器部署全套服务（API + 运营端 + 数据库 + APK 下载）。

---

## 1. 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                          公网流量                              │
│    api.xxx.com / ops.xxx.com / ops.xxx.com/download          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Nginx (反向代理 + HTTPS + APK 下载)               │
│    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│    │  443 → api  │  │ 443 → ops   │  │ /apk/ 下载   │       │
│    │  80 跳转    │  │ /download   │  │ 目录索引     │       │
│    └──────┬──────┘  └──────┬──────┘  └─────────────┘       │
└───────────┼────────────────┼────────────────────────────────┘
            │                │
    ┌───────▼────────┐ ┌─────▼───────────┐
    │  API (Docker)  │ │ ops-web (Docker)│
    │  Express 4000  │ │  Nginx 80       │
    └───────┬────────┘ └─────────────────┘
            │
    ┌───────▼────────┐
    │ PostgreSQL 16  │
    │   Docker 5432  │
    └────────────────┘
```

| 组件 | 部署方式 | 说明 |
|------|----------|------|
| PostgreSQL | Docker Compose | 数据卷持久化，自动健康检查 |
| API (Express) | Docker Compose | 多阶段构建，自动执行 migrate deploy |
| ops-web (React) | Docker Compose | Nginx 静态托管，gzip 压缩 |
| 反向代理 | 系统 Nginx | 虚拟主机 + Certbot HTTPS |
| APK 下载 | Nginx 静态目录 | 自动索引 + 下载页面 + 二维码 |

---

## 2. 项目部署

### 2.1 上传代码

将项目代码上传到服务器应用目录（如 `~/tenant-hub`），确保包含：
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- `apps/api/`（含 `prisma/`）
- `apps/ops-web/`（含 `nginx.conf`）
- `docker-compose.prod.yml`, `scripts/`, `.env.production.example`

### 2.2 配置环境变量

```bash
cd ~/tenant-hub

# 基于模板创建生产环境变量文件（不要提交到 Git）
cp .env.production.example .env.production

# 编辑 .env.production，至少修改以下敏感项：
# - POSTGRES_PASSWORD（数据库密码，至少16位随机字符串）
# - DATABASE_URL（其中的密码需与 POSTGRES_PASSWORD 一致）
# - JWT_SECRET（至少64位随机字符串）
# - CORS_ORIGINS（生产环境域名）
# - VITE_API_BASE_URL（生产环境 API 地址）
```

### 2.3 启动 Docker 服务

```bash
cd ~/tenant-hub

# 构建并启动生产环境（需指定 env-file，否则 ops-web 构建参数读取不到）
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d

# 查看状态
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

> `docker-compose.prod.yml` 中 API 和 ops-web 的端口仅绑定 `127.0.0.1`，不暴露到公网，所有外部流量必须经过 Nginx。

### 2.4 Nginx 反向代理配置

```bash
cd ~/tenant-hub

# 创建 APK 存放目录并放置下载页
mkdir -p apk
cp scripts/download-page.html apk/index.html

# 替换域名并复制 Nginx 配置（将 DOMAIN 替换为你的真实域名）
export DOMAIN_API="api.tenant-hub.com"
export DOMAIN_OPS="ops.tenant-hub.com"
export PROJECT_DIR="$HOME/tenant-hub"

sed -e "s|API_DOMAIN|$DOMAIN_API|g" scripts/nginx-api.conf | sudo tee /etc/nginx/sites-available/tenant-hub-api
sed -e "s|OPS_DOMAIN|$DOMAIN_OPS|g" -e "s|PROJECT_DIR|$PROJECT_DIR|g" scripts/nginx-ops.conf | sudo tee /etc/nginx/sites-available/tenant-hub-ops

# 启用站点
sudo ln -sf /etc/nginx/sites-available/tenant-hub-api /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/tenant-hub-ops /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试并重载 Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 2.5 申请 HTTPS 证书

```bash
# 确保证书申请前域名 DNS 已指向本机 IP
sudo certbot --nginx -d $DOMAIN_API -d $DOMAIN_OPS --non-interactive --agree-tos --email your-email@example.com

# 测试自动续期
sudo certbot renew --dry-run
```

---

## 3. 验证部署

```bash
# 检查 API 健康
curl https://api.tenant-hub.com/health

# 检查运营端
curl -I https://ops.tenant-hub.com

# 检查 APK 下载页
curl -I https://ops.tenant-hub.com/download
```

---

## 4. APK 构建与分发

### 4.1 构建 APK（本地或 CI）

```bash
cd ~/tenant-hub

# 确保 API 地址指向生产环境
echo 'API_BASE_URL=https://api.tenant-hub.com/api' > apps/mobile/.env

# 构建 Android APK（需要本地安装 Android SDK 和 Java 环境）
pnpm mobile:build:apk
```

产物位置：`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

### 4.2 上传到服务器

```bash
# 本地执行，将 APK 上传到服务器下载目录
scp apps/mobile/android/app/build/outputs/apk/release/app-release.apk \
  user@your-server:~/tenant-hub/apk/tenant-hub-x.x.x.apk
```

### 4.3 访问方式

| 地址 | 说明 |
|------|------|
| `https://ops.tenant-hub.com/download` | 下载页面（含版本信息、二维码） |
| `https://ops.tenant-hub.com/apk/` | 文件目录列表 |
| `https://ops.tenant-hub.com/apk/tenant-hub-x.x.x.apk` | 直接下载链接 |

---

## 5. 数据库备份

### 5.1 配置自动备份

创建备份脚本：

```bash
cat > ~/tenant-hub/scripts/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/$(whoami)/tenant-hub/backups"
DB_NAME="tenant_hub"
DB_USER="postgres"
CONTAINER="tenant-hub-postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/tenant_hub_$DATE.sql"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
gzip "$BACKUP_FILE"
find "$BACKUP_DIR" -name "tenant_hub_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup completed: ${BACKUP_FILE}.gz"
EOF
chmod +x ~/tenant-hub/scripts/backup-db.sh
```

配置定时任务（每天凌晨 3 点执行）：

```bash
CRON_CMD="0 3 * * * /home/$(whoami)/tenant-hub/scripts/backup-db.sh >> /home/$(whoami)/tenant-hub/backups/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -F "$CRON_CMD") || (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
```

### 5.2 手动恢复备份

```bash
gunzip -c backups/tenant_hub_20260101_030000.sql.gz | \
  docker exec -i tenant-hub-postgres psql -U postgres -d tenant_hub
```

---

## 6. 更新与回滚

### 6.1 更新部署

```bash
cd ~/tenant-hub

# 拉取最新代码
git pull origin main

# 重新构建并启动
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 清理旧镜像
docker image prune -f
```

### 6.2 快速回滚

```bash
cd ~/tenant-hub

# 回退到指定版本
git log --oneline -5
git reset --hard <commit-hash>

# 重新构建部署
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

---

## 7. 日志管理

```bash
# 查看各服务实时日志
docker logs -f tenant-hub-api
docker logs -f tenant-hub-ops-web
docker logs -f tenant-hub-postgres

# 查看 Nginx 访问日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 8. 部署检查清单

- [ ] 服务器已安装 Docker、Nginx、Certbot
- [ ] DNS A 记录指向服务器 IP（api.xxx.com / ops.xxx.com）
- [ ] `.env.production` 已创建且密码已修改
- [ ] `docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d` 成功
- [ ] Nginx 站点配置已启用，`nginx -t` 通过
- [ ] HTTPS 证书申请成功
- [ ] 运营端和 API 健康检查正常
- [ ] APK 下载页正常
- [ ] 数据库备份脚本和定时任务已配置
