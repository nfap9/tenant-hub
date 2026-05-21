#!/bin/bash
set -euo pipefail

# ============================================
# Tenant Hub Jenkins Agent (4C8G) 环境初始化脚本
#
# 适用: Ubuntu 22.04 LTS
# 执行方式: bash scripts/jenkins-init-agent.sh
# ============================================

if [[ $EUID -eq 0 ]]; then
   echo "请勿以 root 用户运行此脚本，请使用 ubuntu 用户并确保有 sudo 权限"
   exit 1
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}   $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR]${NC}  $*" >&2; }

NODE_VERSION="22"
PNPM_VERSION="10.33.0"

# ============================================
# 1. 系统基础更新
# ============================================
info "[1/10] 更新系统包..."
sudo apt-get update -y
sudo apt-get upgrade -y
ok "系统包更新完成"

# ============================================
# 2. 安装基础工具
# ============================================
info "[2/10] 安装基础工具..."
sudo apt-get install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    unzip \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    build-essential \
    python3 \
    python3-pip \
    jq \
    net-tools
ok "基础工具安装完成"

# ============================================
# 3. 安装 Node.js 22 (via NodeSource)
# ============================================
info "[3/10] 安装 Node.js ${NODE_VERSION}..."
if command -v node &> /dev/null && [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" = "$NODE_VERSION" ]; then
    ok "Node.js ${NODE_VERSION} 已安装: $(node -v)"
else
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | sudo -E bash -
    sudo apt-get install -y nodejs
    ok "Node.js $(node -v) 安装完成"
fi

# ============================================
# 4. 安装 pnpm
# ============================================
info "[4/10] 安装 pnpm ${PNPM_VERSION}..."
if command -v pnpm &> /dev/null && pnpm -v | grep -q "^${PNPM_VERSION%%.*}"; then
    ok "pnpm $(pnpm -v) 已安装"
else
    npm install -g pnpm@${PNPM_VERSION}
    ok "pnpm $(pnpm -v) 安装完成"
fi

# 配置 pnpm 全局路径
export PNPM_HOME="${HOME}/.local/share/pnpm"
export PATH="${PNPM_HOME}:${PATH}"
if ! grep -q "PNPM_HOME" "${HOME}/.bashrc"; then
    echo "export PNPM_HOME=${PNPM_HOME}" >> "${HOME}/.bashrc"
    echo "export PATH=\${PNPM_HOME}:\${PATH}" >> "${HOME}/.bashrc"
fi
ok "pnpm 配置完成"

# ============================================
# 5. 安装 Docker & Docker Compose
# ============================================
info "[5/10] 安装 Docker..."
if command -v docker &> /dev/null; then
    ok "Docker $(docker -v) 已安装"
else
    # 添加 Docker 官方 GPG key
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    # 添加 Docker 仓库
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # 将当前用户加入 docker 组
    sudo usermod -aG docker "$USER"
    ok "Docker 安装完成，已加入 docker 组（需重新登录生效）"
fi

# ============================================
# 6. 安装 PM2
# ============================================
info "[6/10] 安装 PM2..."
if command -v pm2 &> /dev/null; then
    ok "PM2 $(pm2 -v) 已安装"
else
    pnpm add -g pm2
    ok "PM2 $(pm2 -v) 安装完成"
fi

# 配置 PM2 开机自启（需要 systemd）
if command -v systemctl &> /dev/null; then
    pm2 startup systemd --user "$(whoami)" --hp "${HOME}" 2>/dev/null || true
    ok "PM2 systemd 启动项已配置"
fi

# ============================================
# 7. 安装 Nginx
# ============================================
info "[7/10] 安装 Nginx..."
if command -v nginx &> /dev/null; then
    ok "Nginx $(nginx -v 2>&1 | head -1) 已安装"
else
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
    ok "Nginx 安装完成"
fi

# ============================================
# 8. 安装 Certbot
# ============================================
info "[8/10] 安装 Certbot..."
if command -v certbot &> /dev/null; then
    ok "Certbot 已安装"
else
    sudo apt-get install -y certbot python3-certbot-nginx
    ok "Certbot 安装完成"
fi

# ============================================
# 9. 安装 PostgreSQL Client (pg_isready, pg_dump)
# ============================================
info "[9/10] 安装 PostgreSQL Client..."
if command -v pg_isready &> /dev/null; then
    ok "PostgreSQL Client 已安装"
else
    sudo apt-get install -y postgresql-client
    ok "PostgreSQL Client 安装完成"
fi

# ============================================
# 10. 防火墙配置 (UFW)
# ============================================
info "[10/10] 配置防火墙..."
if command -v ufw &> /dev/null; then
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow 22/tcp comment 'SSH'
    sudo ufw allow 80/tcp comment 'HTTP'
    sudo ufw allow 443/tcp comment 'HTTPS'
    # Jenkins Agent 不需要暴露端口，所有服务通过 2C2G Nginx 反向代理访问
    sudo ufw --force enable || true
    ok "防火墙配置完成"
else
    warn "ufw 未安装，跳过防火墙配置"
fi

# ============================================
# 11. 创建 Jenkins Agent 工作目录
# ============================================
info "创建 Jenkins Agent 工作目录..."
mkdir -p "${HOME}/jenkins-agent"
mkdir -p "${HOME}/tenant-hub"
mkdir -p "${HOME}/tenant-hub/backups"
ok "工作目录创建完成"

# ============================================
# 完成
# ============================================
echo ""
echo "=========================================="
echo -e "${GREEN}Jenkins Agent 环境初始化完成${NC}"
echo "=========================================="
echo ""
echo "已安装组件:"
echo "  - Node.js $(node -v 2>/dev/null || echo 'N/A')"
echo "  - pnpm $(pnpm -v 2>/dev/null || echo 'N/A')"
echo "  - Docker $(docker -v 2>/dev/null || echo 'N/A')"
echo "  - PM2 $(pm2 -v 2>/dev/null || echo 'N/A')"
echo "  - Nginx $(nginx -v 2>&1 | head -1 2>/dev/null || echo 'N/A')"
echo ""
echo "注意事项:"
echo "  1. 如果 Docker 刚安装，需要重新登录或执行: newgrp docker"
echo "  2. Jenkins Agent 标签应为: 4c8g"
echo "  3. 请将 Jenkins Agent JAR 下载到 ${HOME}/jenkins-agent/agent.jar"
echo "  4. 生产环境 .env 变量请通过 Jenkins Credentials 管理"
echo ""
