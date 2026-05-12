#!/bin/bash
set -e

# ============================================
# Tenant Hub 一键生产部署脚本 (Ubuntu 22.04)
#
# 用法:
#   bash scripts/deploy.sh --domain www.xxx.com --email admin@xxx.com
#
# 首次运行会自动完成以下全部步骤：
#   1. 安装 Docker、Nginx、Certbot
#   2. 配置防火墙、备份脚本
#   3. 校验 .env.production
#   4. 启动 Docker 服务并等待健康检查
#   5. 配置 Nginx 反向代理（单域名：前端 + API 统一代理）
#   6. 申请 HTTPS 证书（域名解析生效后自动执行）
#   7. 最终部署验证
#
# 若 .env.production 未配置或含有默认值，脚本会安全退出并提示修改。
# ============================================

PROJECT_DIR="${PROJECT_DIR:-$HOME/tenant-hub}"
DOMAIN="${DOMAIN:-}"
DOMAIN_OPS="${DOMAIN_OPS:-ops.tenant-hub.com}"
EMAIL="${EMAIL:-admin@tenant-hub.com}"
SKIP_SSL=false

# 向后兼容：若未传 --domain 但传了 --domain-ops，使用 --domain-ops
if [ -z "$DOMAIN" ]; then
    DOMAIN="$DOMAIN_OPS"
fi

# ---- 颜色输出 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}   $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR]${NC}  $*" >&2; }

show_help() {
    cat << 'EOF'
Tenant Hub 一键部署脚本

用法:
  bash scripts/deploy.sh [选项]

选项:
  --domain <域名>        部署域名 (默认: ops.tenant-hub.com)
  --domain-ops <域名>    兼容旧参数，同 --domain
  --email <邮箱>         用于 Certbot 的邮箱 (默认: admin@tenant-hub.com)
  --project-dir <路径>   项目目录 (默认: ~/tenant-hub)
  --skip-ssl             跳过 HTTPS 证书申请
  -h, --help             显示此帮助

示例:
  bash scripts/deploy.sh --domain www.example.com --email admin@example.com
EOF
}

# ---- 参数解析 ----
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)      DOMAIN="$2"; shift 2 ;;
        --domain-ops)  DOMAIN="$2"; shift 2 ;;
        --domain-api)  warn "--domain-api 已废弃，单域名方案不再使用"; shift 2 ;;
        --email)       EMAIL="$2";      shift 2 ;;
        --project-dir) PROJECT_DIR="$2"; shift 2 ;;
        --skip-ssl)    SKIP_SSL=true;   shift ;;
        -h|--help)     show_help; exit 0 ;;
        *) err "未知参数: $1"; show_help; exit 1 ;;
    esac
done

info "Tenant Hub 一键部署"
info "项目目录: $PROJECT_DIR"
info "部署域名: $DOMAIN"
echo ""

# ============================================
# 0. 前置检查
# ============================================

if [ ! -f "$PROJECT_DIR/docker-compose.prod.yml" ]; then
    err "项目代码未找到: $PROJECT_DIR/docker-compose.prod.yml"
    err "请先拉取代码: git clone <仓库地址> $PROJECT_DIR"
    exit 1
fi

# 检查 .env.production
ENV_FILE="$PROJECT_DIR/.env.production"
ENV_TEMPLATE="$PROJECT_DIR/.env.production.example"

if [ ! -f "$ENV_FILE" ]; then
    if [ ! -f "$ENV_TEMPLATE" ]; then
        err "环境变量模板也未找到: $ENV_TEMPLATE"
        exit 1
    fi
    cp "$ENV_TEMPLATE" "$ENV_FILE"
    warn "已从模板创建 .env.production，请先编辑后再运行此脚本"
    echo ""
    echo "需要修改的关键字段："
    echo "  POSTGRES_PASSWORD      → 强密码（16位以上）"
    echo "  DATABASE_URL           → 其中的密码与 POSTGRES_PASSWORD 一致"
    echo "  JWT_SECRET             → 32位以上随机字符串"
    echo "  CORS_ORIGINS           → https://$DOMAIN"
    echo "  VITE_API_BASE_URL      → https://$DOMAIN/api"
    echo "  PLATFORM_ADMIN_PHONE   → 超级管理员手机号（可选）"
    echo ""
    echo "编辑命令: nano $ENV_FILE"
    exit 1
fi

# 检查 .env.production 是否还含有默认值
ENV_INVALID=false
ENV_CONTENT=$(cat "$ENV_FILE")

# 提取实际值（去掉注释）
get_env_val() {
    local key="$1"
    echo "$ENV_CONTENT" | grep "^${key}=" | sed 's/^[^=]*=//' | tr -d '"' | tr -d "'" | xargs
}

POSTGRES_PASSWORD=$(get_env_val "POSTGRES_PASSWORD")
JWT_SECRET=$(get_env_val "JWT_SECRET")
VITE_API_BASE_URL=$(get_env_val "VITE_API_BASE_URL")
CORS_ORIGINS=$(get_env_val "CORS_ORIGINS")

if echo "$POSTGRES_PASSWORD" | grep -qiE 'changeme|password|123456|default'; then
    err "POSTGRES_PASSWORD 仍为默认值或弱密码"
    ENV_INVALID=true
fi

if echo "$JWT_SECRET" | grep -qiE 'changeme|your-very-strong|secret|default|example'; then
    err "JWT_SECRET 仍为默认值"
    ENV_INVALID=true
fi

if echo "$VITE_API_BASE_URL" | grep -qiE 'localhost|yourdomain|example|changeme'; then
    err "VITE_API_BASE_URL 仍为默认值: $VITE_API_BASE_URL"
    ENV_INVALID=true
fi

if echo "$CORS_ORIGINS" | grep -qiE '\*|localhost|yourdomain|example|changeme'; then
    err "CORS_ORIGINS 仍为默认值或使用了 *: $CORS_ORIGINS"
    ENV_INVALID=true
fi

if [ "$ENV_INVALID" = true ]; then
    err ".env.production 含有未修改的默认值，请编辑后重新运行"
    err "文件路径: $ENV_FILE"
    exit 1
fi

ok ".env.production 配置校验通过"
echo ""

# ============================================
# 1. 安装 Docker
# ============================================

DOCKER_CMD="docker"
NEED_RELOGIN=false

if ! command -v docker &> /dev/null; then
    info "[1/7] 安装 Docker..."
    sudo apt update
    sudo apt install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker "$USER"
    NEED_RELOGIN=true
    ok "Docker 安装完成，当前用户已加入 docker 组"
else
    ok "[1/7] Docker 已安装，跳过"
fi

# 检查当前会话是否有 docker 权限
if ! $DOCKER_CMD info &>/dev/null; then
    if groups | grep -q '\bdocker\b'; then
        warn "当前会话未加载 docker 组权限，尝试 newgrp docker 切换..."
        exec sg docker "bash $0 --domain $DOMAIN --email $EMAIL --project-dir $PROJECT_DIR $( [ "$SKIP_SSL" = true ] && echo '--skip-ssl' )"
    else
        DOCKER_CMD="sudo docker"
        warn "当前用户无 docker 组权限，将使用 sudo 运行 docker 命令"
    fi
fi

# ============================================
# 2. 安装 Nginx + Certbot
# ============================================

# 系统级 Nginx 不再需要（nginx 运行在 Docker 容器中）
# 如果系统 nginx 正在运行，后续步骤会提示手动停止

if ! command -v certbot &> /dev/null; then
    info "[2/6] 安装 Certbot..."
    sudo apt install -y certbot
    ok "Certbot 安装完成"
else
    ok "[2/6] Certbot 已安装，跳过"
fi

# ============================================
# 3. 系统基础配置
# ============================================

info "[3/6] 系统基础配置..."
sudo apt install -y ufw fail2ban
sudo timedatectl set-timezone Asia/Shanghai || true

# 防火墙配置
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable
ok "防火墙已启用（允许 SSH/HTTP/HTTPS）"

# ============================================
# 4. 创建项目目录
# ============================================

info "[4/6] 创建项目目录..."
mkdir -p "$PROJECT_DIR/backups"
mkdir -p "$PROJECT_DIR/scripts"
ok "项目目录就绪"

# ============================================
# 5. 启动 Docker 服务
# ============================================

info "[5/6] 构建 ops-web..."
cd "$PROJECT_DIR"

# 每次部署都重新构建 ops-web dist，确保前端代码与最新源码一致
if [ -d "$PROJECT_DIR/apps/ops-web/dist" ]; then
    info "清理旧版 ops-web dist..."
    rm -rf "$PROJECT_DIR/apps/ops-web/dist"
fi

info "构建 ops-web 静态文件..."
docker build --target build -f apps/ops-web/Dockerfile \
  --build-arg VITE_API_BASE_URL="$VITE_API_BASE_URL" \
  -t tenant-hub-ops-web-build .
docker create --name ops-web-extract tenant-hub-ops-web-build >/dev/null
docker cp ops-web-extract:/app/apps/ops-web/dist "$PROJECT_DIR/apps/ops-web/dist"
docker rm ops-web-extract >/dev/null
docker rmi tenant-hub-ops-web-build >/dev/null 2>&1 || true
ok "ops-web 构建完成"

info "[6/6] 启动 Docker 服务..."

# 检查系统 nginx 是否占用 80/443 端口（nginx 容器需要这些端口）
if systemctl is-active --quiet nginx 2>/dev/null; then
    warn "检测到系统 nginx 正在运行，将自动停止并禁用..."
    sudo systemctl stop nginx
    sudo systemctl disable nginx
    ok "系统 nginx 已停止并禁用"
fi

# 确保 nginx 容器重新创建，避免旧容器端口绑定残留问题
$DOCKER_CMD compose -f docker-compose.prod.yml rm -sf nginx >/dev/null 2>&1 || true

$DOCKER_CMD compose -f docker-compose.prod.yml --env-file .env.production up --build -d

ok "Docker 服务已启动"

# ---- 等待健康检查 ----
info "等待 API 服务就绪（最多 180 秒）..."
MAX_WAIT=180
WAITED=0
while true; do
    if curl -fsS http://localhost:4000/health &>/dev/null; then
        ok "API 健康检查通过"
        break
    fi
    if [ "$WAITED" -ge "$MAX_WAIT" ]; then
        err "API 服务在 ${MAX_WAIT} 秒内未就绪"
        err "请查看日志: $DOCKER_CMD compose -f docker-compose.prod.yml logs api"
        exit 1
    fi
    sleep 3
    WAITED=$((WAITED + 3))
    echo -n "."
done
echo ""

# ============================================
# 7. 检查/申请 HTTPS 证书
# ============================================

cert_path="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
key_path="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

if [ "$SKIP_SSL" = true ]; then
    warn "已跳过 HTTPS 证书申请（--skip-ssl）"
elif [ -f "$cert_path" ] && [ -f "$key_path" ]; then
    ok "HTTPS 证书已存在，跳过申请"
else
    info "[7/7] 检查域名解析并申请 HTTPS 证书..."

    # 获取本机公网 IP
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    PUBLIC_IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo "$LOCAL_IP")

    # 检查域名是否解析到本机
    DNS_READY=true
    DOMAIN_IP=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -n1)
    if [ -z "$DOMAIN_IP" ]; then
        DOMAIN_IP=$(dig +short "$DOMAIN" 2>/dev/null | head -n1)
    fi

    if [ -z "$DOMAIN_IP" ]; then
        warn "$DOMAIN DNS 未解析，无法申请证书"
        DNS_READY=false
    elif [ "$DOMAIN_IP" != "$PUBLIC_IP" ] && [ "$DOMAIN_IP" != "$LOCAL_IP" ]; then
        warn "$DOMAIN 解析到 $DOMAIN_IP，但本机 IP 为 $PUBLIC_IP/$LOCAL_IP"
        DNS_READY=false
    else
        ok "$DOMAIN DNS 解析正确 → $DOMAIN_IP"
    fi

    if [ "$DNS_READY" = true ]; then
        # 使用 webroot 模式申请证书（nginx 运行在 Docker 容器中，无法使用 --nginx 插件）
        sudo certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"
        ok "HTTPS 证书申请成功"
    else
        warn "域名 DNS 未正确指向本机，跳过证书申请"
        echo ""
        echo "请完成以下步骤后手动申请证书："
        echo "  1. 在 DNS 服务商处将 $DOMAIN 的 A 记录指向 $PUBLIC_IP"
        echo "  2. 等待 DNS 生效（通常 5-60 分钟）"
        echo "  3. 手动执行: sudo certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --non-interactive --agree-tos --email $EMAIL"
        echo ""
    fi
fi

# ============================================
# 8. 配置数据库备份
# ============================================

info "配置数据库自动备份..."
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

CRON_CMD="0 3 * * * $PROJECT_DIR/scripts/backup-db.sh >> $PROJECT_DIR/backups/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -F "$CRON_CMD") || (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
ok "数据库备份脚本已配置（每天凌晨 3 点执行）"

# ============================================
# 9. 最终验证
# ============================================

echo ""
echo "=========================================="
echo "部署验证"
echo "=========================================="

HEALTH_OK=false
OPS_OK=false

# API 健康检查（直接访问容器端口，绕过 nginx 重定向）
API_URL="http://localhost:4000/health"
if curl -fsS "$API_URL" &>/dev/null; then
    ok "API 健康检查: $API_URL → $(curl -fsS "$API_URL")"
    HEALTH_OK=true
else
    err "API 健康检查失败"
fi

# 运营端检查（通过 nginx 容器访问，跟随重定向）
OPS_URL="https://localhost"
if curl -fsSL -o /dev/null -H "Host: $DOMAIN" -k -I "$OPS_URL" &>/dev/null; then
    ok "运营端访问: $OPS_URL → HTTP 200"
    OPS_OK=true
else
    err "运营端访问失败"
fi

echo ""
echo "=========================================="
if [ "$HEALTH_OK" = true ] && [ "$OPS_OK" = true ]; then
    echo -e "${GREEN}Tenant Hub 部署成功！${NC}"
else
    echo -e "${YELLOW}Tenant Hub 已部署，但部分验证未通过，请检查日志${NC}"
fi
echo "=========================================="
echo ""
echo "访问地址:"
echo "  运营端:   https://$DOMAIN"
echo "  API:      https://$DOMAIN/api"
echo ""
echo "常用命令:"
echo "  查看日志:    cd $PROJECT_DIR && docker compose -f docker-compose.prod.yml logs -f"
echo "  查看状态:    cd $PROJECT_DIR && docker compose -f docker-compose.prod.yml ps"
echo "  重启服务:    cd $PROJECT_DIR && docker compose -f docker-compose.prod.yml restart"
echo "  备份数据库:  $PROJECT_DIR/scripts/backup-db.sh"
echo ""

if [ "$NEED_RELOGIN" = true ]; then
    warn "Docker 是本次安装的新用户组，建议执行一次: newgrp docker"
    warn "或退出 SSH 重新登录，以确保后续 docker 命令无需 sudo"
fi
