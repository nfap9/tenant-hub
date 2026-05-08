# Tenant Hub 单机器生产部署方案

> 适用场景：1 台 Ubuntu 22.04 LTS 服务器，部署全套服务（API + 运营端 + 数据库 + APK 下载）。

---

## 1. 技术栈与部署架构

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
| 反向代理 | 系统 Nginx | 虚拟主机 + Certbot 自动 HTTPS |
| APK 下载 | Nginx 静态目录 | 自动索引 + 下载页面 + 二维码 |

---

## 2. 服务器环境准备

### 2.1 基础系统

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl vim git ufw fail2ban

# 设置时区
sudo timedatectl set-timezone Asia/Shanghai
```

### 2.2 安装 Docker

```bash
# 添加 Docker 官方 GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 将当前用户加入 docker 组（退出重新登录生效）
sudo usermod -aG docker $USER

# 验证
docker --version
docker compose version
```

### 2.3 安装 Nginx + Certbot

```bash
# 安装 Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# 安装 Certbot（Let's Encrypt 自动证书）
sudo apt install -y certbot python3-certbot-nginx
```

### 2.4 防火墙配置

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

---

## 3. 项目部署配置

### 3.1 代码部署

```bash
# 创建应用目录
mkdir -p ~/tenant-hub && cd ~/tenant-hub

# 克隆代码（或上传代码）
git clone <your-repo-url> .

# 如果通过 scp/rsync 上传，确保包含：
# - package.json, pnpm-lock.yaml, pnpm-workspace.yaml, tsconfig.base.json
# - apps/api/** (含 prisma/)
# - apps/ops-web/** (含 nginx.conf)
# - docker-compose.prod.yml, scripts/
```

### 3.2 环境变量配置

```bash
cd ~/tenant-hub

# 生产环境变量文件（此文件含敏感信息，不要提交到 Git）
cat > .env.production << 'EOF'
# ============================
# PostgreSQL
# ============================
POSTGRES_DB=tenant_hub
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<随机强密码，至少16位>

# ============================
# API 服务
# ============================
DATABASE_URL=postgresql://postgres:<上方密码>@postgres:5432/tenant_hub?schema=public
JWT_SECRET=<随机64位字符串>
JWT_EXPIRES_IN=7d
CORS_ORIGINS=https://ops.tenant-hub.com
PORT=4000
OTP_EXPIRES_IN_MINUTES=5
BCRYPT_OTP_SALT_ROUNDS=10
BCRYPT_PASSWORD_SALT_ROUNDS=12
INVITE_EXPIRES_IN_HOURS=24
INVITE_EXPIRES_MAX_HOURS=168

# ============================
# 运维前端 (构建时传入)
# ============================
VITE_API_BASE_URL=https://api.tenant-hub.com/api
EOF

# 生成随机密码的辅助命令（可选）
# openssl rand -base64 32
```

### 3.3 启动 Docker 服务

```bash
cd ~/tenant-hub

# 构建并启动生产环境
docker compose -f docker-compose.prod.yml up --build -d

# 查看启动状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f
```

> `docker-compose.prod.yml` 中 API 和 ops-web 的端口仅绑定 `127.0.0.1`，不暴露到公网，所有外部流量必须经过 Nginx。

### 3.4 Nginx 反向代理配置

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

# 删除默认站点（避免冲突）
sudo rm -f /etc/nginx/sites-enabled/default

# 测试并重载 Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 3.5 申请 HTTPS 证书

```bash
# 确保证书申请前域名 DNS 已指向本机 IP
sudo certbot --nginx -d $DOMAIN_API -d $DOMAIN_OPS --non-interactive --agree-tos --email your-email@example.com

# Certbot 会自动修改 Nginx 配置添加 443 和证书路径
# 测试自动续期
sudo certbot renew --dry-run
```

> **注意**：请将 `tenant-hub.com` 替换为你的真实域名，并确保 DNS A 记录指向服务器公网 IP。

---

## 4. 验证部署

```bash
# 检查 API 健康
curl https://api.tenant-hub.com/health

# 检查运营端
curl -I https://ops.tenant-hub.com

# 检查 APK 下载页
curl -I https://ops.tenant-hub.com/download
```

---

## 5. APK 构建与分发

### 5.1 构建 APK

```bash
cd ~/tenant-hub

# 确保 API 地址指向生产环境
echo 'API_BASE_URL=https://api.tenant-hub.com/api' > apps/mobile/.env

# 构建 Android APK
pnpm mobile:build:apk

# 产物位置（根据实际构建输出调整）
# apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

### 5.2 上传到服务器

```bash
# 本地执行，将 APK 上传到服务器下载目录
scp apps/mobile/android/app/build/outputs/apk/release/app-release.apk \
  user@your-server:~/tenant-hub/apk/tenant-hub-x.x.x.apk

# SSH 到服务器更新下载页
ssh user@your-server "cp ~/tenant-hub/scripts/download-page.html ~/tenant-hub/apk/index.html"
```

### 5.3 访问方式

| 地址 | 说明 |
|------|------|
| `https://ops.tenant-hub.com/download` | 漂亮的下载页面（含版本信息、二维码） |
| `https://ops.tenant-hub.com/apk/` | 文件目录列表（直接查看所有版本） |
| `https://ops.tenant-hub.com/apk/tenant-hub-x.x.x.apk` | 直接下载链接 |

---

## 6. 数据库备份策略

### 6.1 自动备份脚本

```bash
mkdir -p ~/tenant-hub/backups

cat > ~/tenant-hub/scripts/backup-db.sh << 'EOF'
#!/bin/bash
# 数据库自动备份脚本

BACKUP_DIR="/home/$(whoami)/tenant-hub/backups"
DB_NAME="tenant_hub"
DB_USER="postgres"
CONTAINER="tenant-hub-postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/tenant_hub_$DATE.sql"
RETENTION_DAYS=30

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 执行备份
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

# 压缩备份
gzip "$BACKUP_FILE"

# 清理旧备份（保留30天）
find "$BACKUP_DIR" -name "tenant_hub_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup completed: ${BACKUP_FILE}.gz"
EOF

chmod +x ~/tenant-hub/scripts/backup-db.sh
```

### 6.2 定时任务

```bash
# 每天凌晨 3 点自动备份
crontab -l > /tmp/crontab_backup 2>/dev/null || true
echo "0 3 * * * /home/$(whoami)/tenant-hub/scripts/backup-db.sh >> /home/$(whoami)/tenant-hub/backups/backup.log 2>&1" | crontab -

# 验证
crontab -l
```

### 6.3 手动恢复备份

```bash
# 解压并恢复
gunzip -c backups/tenant_hub_20260101_030000.sql.gz | \
  docker exec -i tenant-hub-postgres psql -U postgres -d tenant_hub
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

# 清理旧日志（Docker 自动轮转，也可手动限制大小）
docker system prune -f
```

---

## 8. 更新与回滚

### 8.1 更新部署

```bash
cd ~/tenant-hub

# 拉取最新代码
git pull origin main

# 重新构建并启动（Docker Compose 会先创建新容器再停止旧容器）
docker compose -f docker-compose.prod.yml up -d --build

# 清理旧镜像
docker image prune -f
```

### 8.2 快速回滚

```bash
cd ~/tenant-hub

# 回退到上一个 Git 版本
git log --oneline -5
git reset --hard <commit-hash>

# 重新构建部署
docker compose -f docker-compose.prod.yml up -d --build
```

### 8.3 Nginx 配置回滚

```bash
# Certbot 修改后的 Nginx 配置会自动备份在：
# /etc/nginx/sites-available/tenant-hub-api 和 tenant-hub-ops
# 如有问题可手动编辑后重载
sudo nginx -t && sudo systemctl reload nginx
```

---

## 9. 安全加固建议

1. **SSH 安全**：禁用 root 登录、使用密钥认证、修改默认 22 端口
2. **定期更新**：`sudo apt update && sudo apt upgrade -y`
3. **Docker 安全**：
   - 不暴露 PostgreSQL 端口到宿主机（仅容器内访问）
   - API 和 ops-web 仅绑定 `127.0.0.1`，不直接对外
4. **JWT_SECRET**：定期轮换，长度至少 64 字符
5. **CORS_ORIGINS**：严格限定域名，不开放通配符
6. **fail2ban**：自动封禁暴力破解 IP
7. **Nginx 限速**（可选）：防止 APK 被恶意刷流量
   ```nginx
   location /apk/ {
       limit_rate 2m;  # 限制下载速度
   }
   ```

---

## 10. 部署检查清单

- [ ] Ubuntu 22.04 系统更新完成
- [ ] Docker & Docker Compose 安装完成
- [ ] Nginx + Certbot 安装完成
- [ ] DNS A 记录指向服务器 IP（api.xxx.com / ops.xxx.com）
- [ ] `.env.production` 已创建且密码已修改
- [ ] `docker-compose.prod.yml` 已创建
- [ ] `docker compose -f docker-compose.prod.yml up -d` 成功
- [ ] Nginx 站点配置已启用，`nginx -t` 通过
- [ ] HTTPS 证书申请成功（`curl https://api.xxx.com/health` 正常）
- [ ] 运营端 `https://ops.xxx.com` 可访问
- [ ] APK 下载页 `https://ops.xxx.com/download` 正常
- [ ] 数据库备份脚本和定时任务已配置
- [ ] 防火墙仅开放 22/80/443

---

## 附录：一键部署脚本

项目已提供 `scripts/deploy.sh`，可在新服务器上快速初始化环境：

```bash
# 复制到服务器并执行
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# 脚本会自动完成：
# - Docker 安装
# - Nginx + Certbot 安装
# - 防火墙配置
# - 项目目录创建
# - 数据库备份脚本和定时任务
```

执行后按提示继续完成：代码上传、`.env.production` 配置、Nginx 虚拟主机启用、证书申请。
