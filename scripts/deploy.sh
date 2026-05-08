#!/bin/bash
set -e

# ============================================
# Tenant Hub 单机器生产部署脚本 (Ubuntu 22.04)
# 使用 Nginx + Certbot 反向代理，支持 APK 下载
# ============================================

PROJECT_DIR="$HOME/tenant-hub"
DOMAIN_API="${DOMAIN_API:-api.tenant-hub.com}"
DOMAIN_OPS="${DOMAIN_OPS:-ops.tenant-hub.com}"
EMAIL="${EMAIL:-admin@tenant-hub.com}"

echo "=========================================="
echo "Tenant Hub 生产部署脚本"
echo "=========================================="

# ---- 安装 Docker ----
if ! command -v docker &> /dev/null; then
    echo "[1/7] 安装 Docker..."
    sudo apt update
    sudo apt install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "Docker 安装完成，请重新登录以应用 docker 组权限"
else
    echo "[1/7] Docker 已安装，跳过"
fi

# ---- 安装 Nginx + Certbot ----
if ! command -v nginx &> /dev/null; then
    echo "[2/7] 安装 Nginx..."
    sudo apt install -y nginx
    sudo systemctl enable nginx
else
    echo "[2/7] Nginx 已安装，跳过"
fi

if ! command -v certbot &> /dev/null; then
    echo "[3/7] 安装 Certbot..."
    sudo apt install -y certbot python3-certbot-nginx
else
    echo "[3/7] Certbot 已安装，跳过"
fi

# ---- 系统基础配置 ----
echo "[4/7] 系统基础配置..."
sudo apt install -y ufw fail2ban
sudo timedatectl set-timezone Asia/Shanghai || true

# 防火墙配置
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable

# ---- 创建项目目录 ----
echo "[5/7] 创建项目目录..."
mkdir -p "$PROJECT_DIR/backups"
mkdir -p "$PROJECT_DIR/scripts"
mkdir -p "$PROJECT_DIR/apk"

# ---- 配置 Nginx（如果项目代码已存在） ----
if [ -f "$PROJECT_DIR/scripts/nginx-api.conf" ] && [ -f "$PROJECT_DIR/scripts/nginx-ops.conf" ]; then
    echo "[6/7] 配置 Nginx 虚拟主机..."

    sed -e "s|API_DOMAIN|$DOMAIN_API|g" "$PROJECT_DIR/scripts/nginx-api.conf" | sudo tee /etc/nginx/sites-available/tenant-hub-api > /dev/null
    sed -e "s|OPS_DOMAIN|$DOMAIN_OPS|g" -e "s|PROJECT_DIR|$PROJECT_DIR|g" "$PROJECT_DIR/scripts/nginx-ops.conf" | sudo tee /etc/nginx/sites-available/tenant-hub-ops > /dev/null

    sudo ln -sf /etc/nginx/sites-available/tenant-hub-api /etc/nginx/sites-enabled/
    sudo ln -sf /etc/nginx/sites-available/tenant-hub-ops /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default

    sudo nginx -t && sudo systemctl reload nginx

    # 复制下载页到 apk 目录
    if [ -f "$PROJECT_DIR/scripts/download-page.html" ]; then
        cp "$PROJECT_DIR/scripts/download-page.html" "$PROJECT_DIR/apk/index.html"
    fi
else
    echo "[6/7] 项目代码尚未上传，跳过 Nginx 配置"
fi

# ---- 数据库备份脚本 ----
echo "[7/7] 配置数据库备份..."
cat > "$PROJECT_DIR/scripts/backup-db.sh" << EOF
#!/bin/bash
BACKUP_DIR="$PROJECT_DIR/backups"
CONTAINER="tenant-hub-postgres"
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="\$BACKUP_DIR/tenant_hub_\$DATE.sql"
RETENTION_DAYS=30

# 从容器环境变量读取数据库配置，回退到默认值
DB_NAME=\$(docker exec "\$CONTAINER" printenv POSTGRES_DB 2>/dev/null || echo "tenant_hub")
DB_USER=\$(docker exec "\$CONTAINER" printenv POSTGRES_USER 2>/dev/null || echo "postgres")

mkdir -p "\$BACKUP_DIR"
docker exec "\$CONTAINER" pg_dump -U "\$DB_USER" -d "\$DB_NAME" > "\$BACKUP_FILE"
gzip "\$BACKUP_FILE"
find "\$BACKUP_DIR" -name "tenant_hub_*.sql.gz" -mtime +\$RETENTION_DAYS -delete

echo "[\$(date)] Backup completed: \${BACKUP_FILE}.gz"
EOF
chmod +x "$PROJECT_DIR/scripts/backup-db.sh"

# 添加定时任务（如果不存在）
CRON_CMD="0 3 * * * $PROJECT_DIR/scripts/backup-db.sh >> $PROJECT_DIR/backups/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -F "$CRON_CMD") || (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

echo ""
echo "=========================================="
echo "基础环境部署完成！"
echo "=========================================="
echo ""
echo "请继续完成以下步骤："
echo ""
echo "1. 上传项目代码到: $PROJECT_DIR"
echo "   需要包含的文件:"
echo "   - package.json, pnpm-lock.yaml, pnpm-workspace.yaml"
echo "   - tsconfig.base.json, docker-compose.prod.yml"
echo "   - apps/api/ (含 prisma/), apps/ops-web/ (含 nginx.conf)"
echo "   - scripts/nginx-api.conf, scripts/nginx-ops.conf"
echo "   - scripts/download-page.html"
echo ""
echo "2. 创建环境变量文件:"
echo "   cd $PROJECT_DIR"
echo "   cp .env.production.example .env.production"
echo "   # 编辑 .env.production，修改密码和密钥"
echo ""
echo "3. 启动 Docker 服务:"
echo "   docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d"
echo ""
echo "4. 配置域名 DNS，将以下域名指向本机 IP:"
echo "   - $DOMAIN_API"
echo "   - $DOMAIN_OPS"
echo ""
echo "5. 运行以下命令启用 Nginx 配置（如果第6步被跳过）:"
echo "   cd $PROJECT_DIR"
echo "   sed -e \"s|API_DOMAIN|\$DOMAIN_API|g\" scripts/nginx-api.conf | sudo tee /etc/nginx/sites-available/tenant-hub-api"
echo "   sed -e \"s|OPS_DOMAIN|\$DOMAIN_OPS|g\" -e \"s|PROJECT_DIR|$PROJECT_DIR|g\" scripts/nginx-ops.conf | sudo tee /etc/nginx/sites-available/tenant-hub-ops"
echo "   sudo ln -sf /etc/nginx/sites-available/tenant-hub-* /etc/nginx/sites-enabled/"
echo "   sudo rm -f /etc/nginx/sites-enabled/default"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "6. 申请 HTTPS 证书:"
echo "   sudo certbot --nginx -d $DOMAIN_API -d $DOMAIN_OPS --non-interactive --agree-tos --email $EMAIL"
echo ""
echo "7. 上传 APK 文件到 $PROJECT_DIR/apk/ 目录即可提供下载"
echo ""
