#!/bin/bash
set -euo pipefail

# ============================================
# Tenant Hub 一键生产部署脚本 (Ubuntu 22.04)
#
# 用法:
#   bash scripts/deploy.sh --domain www.xxx.com --email admin@xxx.com
#
# 首次运行会自动完成以下全部步骤：
#   1. 安装 Docker、Certbot
#   2. 配置防火墙、备份脚本
#   3. 校验 .env.production
#   4. 启动 Docker 服务并等待健康检查
#   5. 配置 Nginx 反向代理（单域名：前端 + API 统一代理）
#   6. 申请 HTTPS 证书（域名解析生效后自动执行）
#   7. 最终部署验证
#
# 若 .env.production 未配置或含有默认值，脚本会安全退出并提示修改。
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$HOME/tenant-hub}"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-admin@tenant-hub.com}"
SKIP_SSL=false

# ---- 颜色输出（终端检测） ----
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

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
  --domain <域名>        部署域名 (默认: 空，必填)
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
        --email)       EMAIL="$2";      shift 2 ;;
        --project-dir) PROJECT_DIR="$2"; shift 2 ;;
        --skip-ssl)    SKIP_SSL=true;   shift ;;
        -h|--help)     show_help; exit 0 ;;
        *) err "未知参数: $1"; show_help; exit 1 ;;
    esac
done

info "Tenant Hub 一键部署"
info "项目目录: $PROJECT_DIR"
info "部署域名: ${DOMAIN:-<未指定>}"
echo ""

# ============================================
# 0. 前置检查
# ============================================

info "[1/5] 前置检查..."

# 域名
if [[ -z "$DOMAIN" ]]; then
    err "请使用 --domain 指定部署域名"
    show_help
    exit 1
fi

# 项目代码
if [[ ! -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
    err "项目代码未找到: $PROJECT_DIR/docker-compose.prod.yml"
    err "请先拉取代码: git clone <仓库地址> $PROJECT_DIR"
    exit 1
fi

# 端口占用
for port in 80 443; do
    listeners=$(ss -tlnp 2>/dev/null | grep ":$port " || true)
    if [[ -n "$listeners" ]]; then
        non_docker=$(echo "$listeners" | grep -v -E "docker|containerd" || true)
        if [[ -n "$non_docker" ]]; then
            err "端口 $port 已被系统进程占用，请手动释放后再部署"
            echo "$non_docker" >&2
            exit 1
        fi
    fi
done

# .env.production
ENV_FILE="$PROJECT_DIR/.env.production"

if [[ ! -f "$ENV_FILE" ]]; then
    warn "请先创建 .env.production 后再运行此脚本"
    exit 1
fi

validate_env() {
    local env_file=$1
    local vars=("DATABASE_URL" "JWT_SECRET" "VITE_API_BASE_URL")
    local errors=()

    for var in "${vars[@]}"; do
        if ! grep -qE "^${var}=[^[:space:]]+" "$env_file"; then
            errors+=("缺少或为空: $var")
        fi
    done

    local jwt_secret
    jwt_secret=$(grep -E "^JWT_SECRET=" "$env_file" | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
    if [[ "$jwt_secret" == "tenant-hub-dev-secret" ]]; then
        errors+=("JWT_SECRET 不能为默认值 tenant-hub-dev-secret")
    fi

    if [[ ${#errors[@]} -gt 0 ]]; then
        err ".env.production 校验失败:"
        for e in "${errors[@]}"; do
            err "  - $e"
        done
        exit 1
    fi
}

validate_env "$ENV_FILE"

VITE_API_BASE_URL=$(grep -E "^VITE_API_BASE_URL=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
if [[ -z "$VITE_API_BASE_URL" ]]; then
    err "无法从 .env.production 读取 VITE_API_BASE_URL"
    exit 1
fi

# Docker
if ! command -v docker &> /dev/null; then
    err "Docker 未安装"
    err "请参考 https://docs.docker.com/engine/install/ubuntu/ 安装 Docker"
    exit 1
fi

if command -v systemctl &> /dev/null; then
    if ! systemctl is-active --quiet docker 2>/dev/null; then
        err "Docker 服务未运行"
        err "请执行: sudo systemctl enable --now docker"
        exit 1
    fi
fi

if ! docker info &>/dev/null; then
    err "当前用户无 Docker 操作权限"
    err "请确认当前用户已在 docker 组，并重新登录后重试"
    err "检查命令: groups | grep docker"
    exit 1
fi

# Docker Compose 命令检测
if docker compose version &>/dev/null; then
    DOCKER_CMD="docker"
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_CMD="docker-compose"
    DOCKER_COMPOSE_CMD="docker-compose"
else
    err "未检测到可用的 Docker Compose 命令"
    err "请安装 Docker Compose 插件或独立版本: https://docs.docker.com/compose/install/"
    exit 1
fi

# curl（Ubuntu Server 最小安装可能未预装）
if ! command -v curl &> /dev/null; then
    err "curl 未安装"
    err "请执行: sudo apt install -y curl"
    exit 1
fi

# Certbot
if ! command -v certbot &> /dev/null; then
    err "Certbot 未安装"
    err "请执行: sudo apt install -y certbot"
    exit 1
fi

# ufw
if ! command -v ufw &> /dev/null; then
    err "ufw 未安装"
    err "请执行: sudo apt install -y ufw"
    exit 1
fi

if ! ufw status | grep -q "Status: active"; then
    err "ufw 防火墙未启用"
    err "请执行: sudo ufw --force enable"
    exit 1
fi

for rule in "22/tcp" "80/tcp" "443/tcp"; do
    if ! ufw status | grep -q "$rule"; then
        err "ufw 未放行 $rule"
        err "请执行: sudo ufw allow $rule"
        exit 1
    fi
done

ok "前置检查通过"

# ============================================
# 2. 创建项目目录
# ============================================

info "[2/5] 创建项目目录..."
mkdir -p "$PROJECT_DIR/backups"
mkdir -p "$PROJECT_DIR/scripts"
ok "项目目录就绪"

# ============================================
# 3. 构建 ops-web
# ============================================

info "[3/5] 构建 ops-web..."
cd "$PROJECT_DIR"

# 每次部署都重新构建 ops-web dist，确保前端代码与最新源码一致
if [[ -d "$PROJECT_DIR/apps/ops-web/dist" ]]; then
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

# ============================================
# 4. 生成 Nginx 配置
# ============================================

info "生成 nginx 配置文件..."

cert_path="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
key_path="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

# 生成完整 HTTPS 配置（含 80 端口强制跳转）
generate_full_nginx_conf() {
    cat > "$PROJECT_DIR/scripts/nginx-container.conf" << EOF
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri.html \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
}

# 生成临时 HTTP 配置（首次部署无证书时使用）
generate_http_nginx_conf() {
    cat > "$PROJECT_DIR/scripts/nginx-container.conf" << EOF
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri.html \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
}

if [[ -f "$cert_path" ]] && [[ -f "$key_path" ]]; then
    generate_full_nginx_conf
else
    info "首次部署或证书缺失，先生成 HTTP 配置用于证书申请..."
    generate_http_nginx_conf
fi
ok "nginx 配置已生成"

# ============================================
# 5. 启动 Docker 服务
# ============================================

info "[4/5] 启动 Docker 服务..."

$DOCKER_COMPOSE_CMD -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate

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
    if [[ "$WAITED" -ge "$MAX_WAIT" ]]; then
        err "API 服务在 ${MAX_WAIT} 秒内未就绪"
        err "请查看日志: $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml logs api"
        exit 1
    fi
    sleep 3
    WAITED=$((WAITED + 3))
    echo -n "."
done
echo ""

# ============================================
# 6. 检查/申请 HTTPS 证书
# ============================================

cert_path="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
key_path="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

if [[ "$SKIP_SSL" == true ]]; then
    warn "已跳过 HTTPS 证书申请（--skip-ssl）"
elif [[ -f "$cert_path" ]] && [[ -f "$key_path" ]]; then
    ok "HTTPS 证书已存在，跳过申请"
else
    info "[5/5] 检查域名解析并申请 HTTPS 证书..."

    # 获取本机公网 IP
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [[ -z "$LOCAL_IP" ]]; then
        LOCAL_IP=$(ip addr show 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 | head -n1)
    fi
    PUBLIC_IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo "$LOCAL_IP")

    # 检查域名是否解析到本机
    DNS_READY=true
    DOMAIN_IP=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -n1)
    if [[ -z "$DOMAIN_IP" ]]; then
        DOMAIN_IP=$(dig +short "$DOMAIN" 2>/dev/null | head -n1)
    fi

    if [[ -z "$DOMAIN_IP" ]]; then
        warn "$DOMAIN DNS 未解析，无法申请证书"
        DNS_READY=false
    elif [[ "$DOMAIN_IP" != "$PUBLIC_IP" ]] && [[ "$DOMAIN_IP" != "$LOCAL_IP" ]]; then
        warn "$DOMAIN 解析到 $DOMAIN_IP，但本机 IP 为 $PUBLIC_IP/$LOCAL_IP"
        DNS_READY=false
    else
        ok "$DOMAIN DNS 解析正确 → $DOMAIN_IP"
    fi

    if [[ "$DNS_READY" == true ]]; then
        # 使用 webroot 模式申请证书（nginx 运行在 Docker 容器中，无法使用 --nginx 插件）
        sudo certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"
        ok "HTTPS 证书申请成功"
        # 重新生成完整 HTTPS 配置并重载 nginx
        generate_full_nginx_conf
        $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml exec nginx nginx -s reload || warn "nginx 重载失败，请手动检查"
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
# 7. 配置数据库备份
# ============================================

info "配置数据库自动备份..."
cat > "$PROJECT_DIR/scripts/backup-db.sh" << EOF
#!/bin/bash
set -euo pipefail

DOCKER_COMPOSE_CMD="$DOCKER_COMPOSE_CMD"

PROJECT_DIR="\$(cd "\$(dirname "\$0")/.." && pwd)"
BACKUP_DIR="\$PROJECT_DIR/backups"
RETENTION_DAYS=30

# 获取 postgres 容器 ID
CONTAINER=\$("\$DOCKER_COMPOSE_CMD" -f "\$PROJECT_DIR/docker-compose.prod.yml" ps -q postgres 2>/dev/null || true)
if [[ -z "\$CONTAINER" ]]; then
    echo "[\$(date)] ERROR: postgres container not found" >&2
    exit 1
fi

DB_NAME=\$(docker exec "\$CONTAINER" printenv POSTGRES_DB 2>/dev/null || echo "tenant_hub")
DB_USER=\$(docker exec "\$CONTAINER" printenv POSTGRES_USER 2>/dev/null || echo "postgres")

DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="\$BACKUP_DIR/tenant_hub_\$DATE.sql"

mkdir -p "\$BACKUP_DIR"

if ! docker exec "\$CONTAINER" pg_dump -U "\$DB_USER" -d "\$DB_NAME" > "\$BACKUP_FILE"; then
    echo "[\$(date)] ERROR: pg_dump failed" >&2
    rm -f "\$BACKUP_FILE"
    exit 1
fi

gzip "\$BACKUP_FILE"
find "\$BACKUP_DIR" -name "tenant_hub_*.sql.gz" -mtime +\$RETENTION_DAYS -delete

echo "[\$(date)] Backup completed: \${BACKUP_FILE}.gz"
EOF
chmod +x "$PROJECT_DIR/scripts/backup-db.sh"

CRON_CMD="0 3 * * * $PROJECT_DIR/scripts/backup-db.sh >> $PROJECT_DIR/backups/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -F "$CRON_CMD") || (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
ok "数据库备份脚本已配置（每天凌晨 3 点执行）"

# ============================================
# 8. 最终验证
# ============================================

info "部署验证"
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
if curl -fsSL -o /dev/null -H "Host: $DOMAIN" -k "$OPS_URL" &>/dev/null; then
    ok "运营端访问: $OPS_URL → HTTP 200"
    OPS_OK=true
else
    err "运营端访问失败"
fi

echo ""
echo "=========================================="
if [[ "$HEALTH_OK" == true ]] && [[ "$OPS_OK" == true ]]; then
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
echo "  查看日志:    cd $PROJECT_DIR && $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml logs -f"
echo "  查看状态:    cd $PROJECT_DIR && $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml ps"
echo "  重启服务:    cd $PROJECT_DIR && $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml restart"
echo "  备份数据库:  $PROJECT_DIR/scripts/backup-db.sh"
echo ""

# 建议安装的安全组件
if ! command -v fail2ban-server &> /dev/null; then
    warn "建议安装 fail2ban 以增强服务器安全性"
    warn "安装命令: sudo apt install -y fail2ban && sudo systemctl enable --now fail2ban"
fi


