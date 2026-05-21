#!/bin/bash
set -euo pipefail

# ============================================
# Tenant Hub Jenkins 生产部署脚本
#
# 适用: Jenkins Agent (4C8G) 本地部署
# 触发: Jenkinsfile Deploy stage
#
# 部署内容:
#   1. 写入 .env.production（从 Jenkins Credentials 注入）
#   2. 启动 PostgreSQL + Redis (docker compose)
#   3. 执行 Prisma 数据库迁移
#   4. PM2 启动/重启后端 API
#   5. Nginx 托管前端静态文件
#   6. serve 托管小程序 H5 预览
#   7. 健康检查
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${HOME}/tenant-hub"
BUILD_NUMBER=""
GIT_COMMIT=""
SKIP_HEALTHCHECK=false

# ---- 颜色输出 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}   $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR]${NC}  $*" >&2; }

show_help() {
    cat << 'EOF'
Tenant Hub Jenkins 部署脚本

用法:
  bash scripts/jenkins-deploy.sh [选项]

选项:
  --project-dir <路径>   项目部署目录 (默认: ~/tenant-hub)
  --build-number <编号>  Jenkins 构建编号
  --git-commit <sha>     Git commit hash
  --skip-healthcheck     跳过健康检查
  -h, --help             显示此帮助
EOF
}

# ---- 参数解析 ----
while [[ $# -gt 0 ]]; do
    case $1 in
        --project-dir)      PROJECT_DIR="$2"; shift 2 ;;
        --build-number)     BUILD_NUMBER="$2"; shift 2 ;;
        --git-commit)       GIT_COMMIT="$2"; shift 2 ;;
        --skip-healthcheck) SKIP_HEALTHCHECK=true; shift ;;
        -h|--help)          show_help; exit 0 ;;
        *) err "未知参数: $1"; show_help; exit 1 ;;
    esac
done

info "Tenant Hub 生产部署"
info "部署目录: ${PROJECT_DIR}"
info "构建编号: ${BUILD_NUMBER:-<未指定>}"
info "Git Commit: ${GIT_COMMIT:-<未指定>}"
echo ""

# ============================================
# 0. 前置检查
# ============================================
info "[0/8] 前置检查..."

for cmd in docker pnpm pm2 nginx; do
    if ! command -v "$cmd" &> /dev/null; then
        err "$cmd 未安装，请先运行 scripts/jenkins-init-agent.sh"
        exit 1
    fi
done

# 检查 Jenkins Credentials 注入的环境变量
required_envs=("CRED_DATABASE_URL" "CRED_JWT_SECRET" "CRED_VITE_API_BASE_URL")
missing_envs=()
for env in "${required_envs[@]}"; do
    if [[ -z "${!env:-}" ]]; then
        missing_envs+=("$env")
    fi
done

if [[ ${#missing_envs[@]} -gt 0 ]]; then
    err "缺少必需的环境变量（请检查 Jenkins Credentials）:"
    for e in "${missing_envs[@]}"; do
        err "  - $e"
    done
    exit 1
fi

ok "前置检查通过"

# ============================================
# 1. 准备部署目录
# ============================================
info "[1/8] 准备部署目录..."

mkdir -p "${PROJECT_DIR}"
mkdir -p "${PROJECT_DIR}/backups"
mkdir -p "${PROJECT_DIR}/scripts"
mkdir -p "${PROJECT_DIR}/apps/ops-web"
mkdir -p "${PROJECT_DIR}/apps/miniprogram"

# 创建版本标记
echo "build_number=${BUILD_NUMBER}" > "${PROJECT_DIR}/.deploy-version"
echo "git_commit=${GIT_COMMIT}" >> "${PROJECT_DIR}/.deploy-version"
echo "deploy_time=$(date -Iseconds)" >> "${PROJECT_DIR}/.deploy-version"

ok "部署目录就绪"

# ============================================
# 2. 写入 .env.production（从 Jenkins Credentials 安全注入）
# ============================================
info "[2/8] 写入生产环境变量..."

ENV_FILE="${PROJECT_DIR}/.env.production"

# 注意: 以下变量由 Jenkins Credentials 注入，不会出现在代码仓库中
cat > "$ENV_FILE" << EOF
# ============================================
# Tenant Hub 生产环境变量
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')
# 构建编号: ${BUILD_NUMBER}
# Git Commit: ${GIT_COMMIT}
# 警告: 此文件由 Jenkins 自动生成，请勿手动修改
# ============================================

# PostgreSQL
POSTGRES_DB=${CRED_POSTGRES_DB:-tenant_hub}
POSTGRES_USER=${CRED_POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${CRED_POSTGRES_PASSWORD}

# API
DATABASE_URL=${CRED_DATABASE_URL}
JWT_SECRET=${CRED_JWT_SECRET}
JWT_EXPIRES_IN=${CRED_JWT_EXPIRES_IN:-7d}
CORS_ORIGINS=${CRED_CORS_ORIGINS:-https://localhost}
PORT=4000
NODE_ENV=production

OTP_EXPIRES_IN_MINUTES=5
BCRYPT_OTP_SALT_ROUNDS=10
BCRYPT_PASSWORD_SALT_ROUNDS=12
INVITE_EXPIRES_IN_HOURS=24
INVITE_EXPIRES_MAX_HOURS=168

PLATFORM_ADMIN_PHONE=${CRED_PLATFORM_ADMIN_PHONE:-}
PLATFORM_ADMIN_PASSWORD=${CRED_PLATFORM_ADMIN_PASSWORD:-}

# 前端
VITE_API_BASE_URL=${CRED_VITE_API_BASE_URL}

# 小程序
API_BASE_URL=${CRED_API_BASE_URL:-${CRED_VITE_API_BASE_URL}}
EOF

# 安全加固: 限制文件权限
chmod 600 "$ENV_FILE"
ok ".env.production 已生成 (权限 600)"

# API 运行时通过 dotenv 读取的是项目根目录的 .env，创建软链接
ln -sf "$ENV_FILE" "${PROJECT_DIR}/.env"
ok ".env -> .env.production 软链接已创建"

# ============================================
# 3. 启动/更新基础设施 (PostgreSQL + Redis)
# ============================================
info "[3/8] 启动基础设施 (PostgreSQL + Redis)..."

# 将必要文件复制到部署目录
cp "${SCRIPT_DIR}/../docker-compose.infra.yml" "${PROJECT_DIR}/docker-compose.infra.yml"

cd "$PROJECT_DIR"

# 如果容器已在运行，先检查状态
if docker compose -f docker-compose.infra.yml ps | grep -q "tenant-hub-postgres"; then
    info "PostgreSQL 容器已在运行，检查健康状态..."
    if ! docker compose -f docker-compose.infra.yml exec -T postgres pg_isready -U "${CRED_POSTGRES_USER:-postgres}" -d "${CRED_POSTGRES_DB:-tenant_hub}" &>/dev/null; then
        warn "PostgreSQL 健康检查失败，尝试重启..."
        docker compose -f docker-compose.infra.yml restart postgres
    fi
else
    info "启动 PostgreSQL + Redis..."
    docker compose -f docker-compose.infra.yml up -d
fi

# 等待 PostgreSQL 就绪
info "等待 PostgreSQL 就绪（最多 60 秒）..."
for i in $(seq 1 60); do
    if docker compose -f docker-compose.infra.yml exec -T postgres pg_isready -U "${CRED_POSTGRES_USER:-postgres}" -d "${CRED_POSTGRES_DB:-tenant_hub}" &>/dev/null; then
        ok "PostgreSQL 已就绪"
        break
    fi
    if [ "$i" -eq 60 ]; then
        err "PostgreSQL 在 60 秒内未就绪"
        docker compose -f docker-compose.infra.yml logs postgres --tail=50
        exit 1
    fi
    sleep 1
done

ok "基础设施就绪"

# ============================================
# 4. 执行数据库迁移
# ============================================
info "[4/8] 执行 Prisma 数据库迁移..."

# 使用生产环境的数据库连接串执行迁移
cd "${SCRIPT_DIR}/../apps/api"

# 临时导出 DATABASE_URL 给 Prisma 使用
export DATABASE_URL="${CRED_DATABASE_URL}"

# 迁移前自动备份（可选，保留最近 10 个自动备份）
BACKUP_DIR="${PROJECT_DIR}/backups"
if docker compose -f "${PROJECT_DIR}/docker-compose.infra.yml" ps | grep -q "Up"; then
    info "执行迁移前数据库备份..."
    BACKUP_FILE="${BACKUP_DIR}/pre_migrate_$(date +%Y%m%d_%H%M%S).sql"
    if docker compose -f "${PROJECT_DIR}/docker-compose.infra.yml" exec -T postgres pg_dump -U "${CRED_POSTGRES_USER:-postgres}" -d "${CRED_POSTGRES_DB:-tenant_hub}" > "${BACKUP_FILE}" 2>/dev/null; then
        gzip -f "${BACKUP_FILE}" 2>/dev/null || true
        # 保留最近 10 个自动备份
        ls -t "${BACKUP_DIR}"/pre_migrate_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
        ok "迁移前备份完成: ${BACKUP_FILE}.gz"
    else
        warn "迁移前备份失败，继续执行迁移..."
    fi
fi

# 执行迁移
info "运行 prisma migrate deploy..."
pnpm prisma migrate deploy

ok "数据库迁移完成"

# ============================================
# 5. 部署后端 API (PM2)
# ============================================
info "[5/8] 部署后端 API (PM2)..."

API_DEPLOY_DIR="${PROJECT_DIR}/apps/api"
mkdir -p "$API_DEPLOY_DIR"

# 复制构建产物和必要文件到部署目录
# 注意: 在 Jenkins 工作区中，构建产物已经生成
cp -r "${SCRIPT_DIR}/../apps/api/dist" "${API_DEPLOY_DIR}/"
cp "${SCRIPT_DIR}/../apps/api/package.json" "${API_DEPLOY_DIR}/"
cp -r "${SCRIPT_DIR}/../apps/api/prisma" "${API_DEPLOY_DIR}/"
cp "${SCRIPT_DIR}/../package.json" "${PROJECT_DIR}/package.json"
cp "${SCRIPT_DIR}/../pnpm-lock.yaml" "${PROJECT_DIR}/pnpm-lock.yaml"
cp "${SCRIPT_DIR}/../pnpm-workspace.yaml" "${PROJECT_DIR}/pnpm-workspace.yaml"
cp "${SCRIPT_DIR}/../tsconfig.base.json" "${PROJECT_DIR}/tsconfig.base.json"

# 在部署目录安装生产依赖
cd "$API_DEPLOY_DIR"
pnpm install --frozen-lockfile --prod
pnpm prisma generate

# 写入 PM2 ecosystem 配置
PM2_CONFIG="${PROJECT_DIR}/ecosystem.config.cjs"
cat > "$PM2_CONFIG" << 'EOF'
module.exports = {
  apps: [
    {
      name: 'tenant-hub-api',
      script: './dist/server.js',
      cwd: './apps/api',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      // 日志
      log_file: './logs/api-combined.log',
      out_file: './logs/api-out.log',
      error_file: './logs/api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 自动重启
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // 内存限制
      max_memory_restart: '512M',
      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 10000,
      // 健康检查
      // pm2 支持在配置中设置 health check，这里用外部脚本检查
    },
    {
      name: 'tenant-hub-miniprogram-h5',
      script: 'serve',
      args: ['-s', './apps/miniprogram/dist', '-l', '8080'],
      cwd: '.',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      log_file: './logs/mp-h5-combined.log',
      out_file: './logs/mp-h5-out.log',
      error_file: './logs/mp-h5-error.log',
      autorestart: true,
      max_memory_restart: '256M',
    },
  ],
};
EOF

# 确保日志目录存在
mkdir -p "${PROJECT_DIR}/logs"

# 停止旧进程并启动新进程
cd "$PROJECT_DIR"
pm2 startOrRestart ecosystem.config.cjs --env production

ok "后端 API 和小程序 H5 已通过 PM2 启动"

# ============================================
# 6. 部署前端 Ops Web (Nginx 静态文件)
# ============================================
info "[6/8] 部署运营端前端 (Nginx)..."

OPS_WEB_DIST="${PROJECT_DIR}/apps/ops-web/dist"
mkdir -p "$OPS_WEB_DIST"

# 复制构建产物
cp -r "${SCRIPT_DIR}/../apps/ops-web/dist/." "${OPS_WEB_DIST}/"

# 生成 Nginx 站点配置
NGINX_SITE="/etc/nginx/sites-available/tenant-hub-apps"
NGINX_ENABLED="/etc/nginx/sites-enabled/tenant-hub-apps"

sudo tee "$NGINX_SITE" > /dev/null << 'EOF'
# 4C8G 上的 Nginx：托管运营端静态文件
# API 由 PM2 直接监听 4000，无需 Nginx 反向代理
# 2C2G Nginx 直接访问 4C8G:4000 (PM2) 和 4C8G:3000 (Nginx)

server {
    listen 3000;
    server_name _;
    root /home/ubuntu/tenant-hub/apps/ops-web/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 前端路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# 启用站点配置
if [[ ! -L "$NGINX_ENABLED" ]]; then
    sudo ln -sf "$NGINX_SITE" "$NGINX_ENABLED"
fi

# 测试并重载 Nginx
sudo nginx -t
sudo systemctl reload nginx || sudo systemctl start nginx

ok "运营端前端已部署到 Nginx (端口 3000)"

# ============================================
# 7. 部署小程序 H5 预览
# ============================================
info "[7/8] 部署小程序 H5 预览..."

MP_DIST="${PROJECT_DIR}/apps/miniprogram/dist"
mkdir -p "$MP_DIST"

# 复制 H5 构建产物
cp -r "${SCRIPT_DIR}/../apps/miniprogram/dist/." "${MP_DIST}/" 2>/dev/null || true

# 检查 serve 是否已安装
if ! command -v serve &> /dev/null; then
    info "安装 serve..."
    pnpm add -g serve
fi

# serve 已通过 PM2 在 ecosystem.config.cjs 中管理，前面已经启动
ok "小程序 H5 预览已就绪 (端口 8080)"

# ============================================
# 8. 健康检查与清理
# ============================================
info "[8/8] 健康检查..."

if [[ "$SKIP_HEALTHCHECK" == true ]]; then
    warn "已跳过健康检查"
else
    # 等待 API 启动
    sleep 3

    API_HEALTH="http://127.0.0.1:4000/health"
    OPS_WEB_HEALTH="http://127.0.0.1:3000"
    MP_H5_HEALTH="http://127.0.0.1:8080"

    HEALTH_OK=true

    # API 健康检查
    info "检查 API 健康状态..."
    if curl -fsS "$API_HEALTH" &>/dev/null; then
        ok "API 健康检查通过: $(curl -fsS "$API_HEALTH")"
    else
        err "API 健康检查失败: $API_HEALTH"
        HEALTH_OK=false
    fi

    # Ops Web 检查
    info "检查运营端前端..."
    if curl -fsS -o /dev/null "$OPS_WEB_HEALTH" &>/dev/null; then
        ok "运营端前端可访问: $OPS_WEB_HEALTH"
    else
        err "运营端前端访问失败: $OPS_WEB_HEALTH"
        HEALTH_OK=false
    fi

    # 小程序 H5 检查
    info "检查小程序 H5 预览..."
    if curl -fsS -o /dev/null "$MP_H5_HEALTH" &>/dev/null; then
        ok "小程序 H5 预览可访问: $MP_H5_HEALTH"
    else
        err "小程序 H5 预览访问失败: $MP_H5_HEALTH"
        HEALTH_OK=false
    fi

    if [[ "$HEALTH_OK" != true ]]; then
        err "部分健康检查未通过，请查看日志:"
        err "  API 日志: pm2 logs tenant-hub-api --lines 50"
        err "  Nginx 日志: sudo tail -50 /var/log/nginx/error.log"
        exit 1
    fi
fi

# 清理旧备份（保留 30 天）
find "${PROJECT_DIR}/backups" -name "*.sql.gz" -mtime +30 -delete 2>/dev/null || true

# PM2 保存进程列表
pm2 save

# ============================================
# 部署完成
# ============================================
echo ""
echo "=========================================="
echo -e "${GREEN}Tenant Hub 部署成功${NC}"
echo "=========================================="
echo ""
echo "部署信息:"
echo "  构建编号: ${BUILD_NUMBER}"
echo "  Git Commit: ${GIT_COMMIT}"
echo "  部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "服务访问地址 (4C8G 本地):"
echo "  运营端:  http://127.0.0.1:3000"
echo "  API:     http://127.0.0.1:4000"
echo "  小程序H5: http://127.0.0.1:8080"
echo ""
echo "外部访问地址 (通过 2C2G Nginx 反向代理):"
echo "  https://<your-domain>/         -> 运营端"
echo "  https://<your-domain>/api/     -> API"
echo "  https://<your-domain>/mp/      -> 小程序 H5 预览"
echo ""
echo "常用命令:"
echo "  查看 API 日志:     pm2 logs tenant-hub-api"
echo "  查看 H5 日志:      pm2 logs tenant-hub-miniprogram-h5"
echo "  重启 API:          pm2 restart tenant-hub-api"
echo "  数据库备份:        ${PROJECT_DIR}/scripts/backup-db.sh"
echo "  查看容器状态:      docker compose -f ${PROJECT_DIR}/docker-compose.infra.yml ps"
echo ""
