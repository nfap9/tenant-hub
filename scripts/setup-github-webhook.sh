#!/bin/bash
set -euo pipefail

# ============================================
# 自动配置 GitHub Webhook → Jenkins
#
# 作用: 在 GitHub 仓库添加 Push Webhook，实现代码提交自动触发 Jenkins 构建
#
# 前置条件:
#   1. GitHub 仓库已创建
#   2. 拥有 GitHub Personal Access Token (classic)，权限: repo + admin:repo_hook
#   3. Jenkins 已安装 GitHub plugin，且外网可访问
#
# 用法:
#   export GITHUB_TOKEN="ghp_xxxxxxxx"
#   export GITHUB_REPO="owner/tenant-hub"
#   export JENKINS_URL="http://jenkins.example.com"
#   bash scripts/setup-github-webhook.sh
# ============================================

GITHUB_TOKEN="${GITHUB_TOKEN:-}"
GITHUB_REPO="${GITHUB_REPO:-}"
JENKINS_URL="${JENKINS_URL:-}"
DRY_RUN="${DRY_RUN:-false}"

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
用法:
  export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
  export GITHUB_REPO="owner/repo"
  export JENKINS_URL="http://your-jenkins-server.com"
  bash scripts/setup-github-webhook.sh

环境变量:
  GITHUB_TOKEN    GitHub Personal Access Token (classic)
                  需要权限: repo, admin:repo_hook
  GITHUB_REPO     仓库全称，格式: owner/repo
  JENKINS_URL     Jenkins 外网访问地址
  DRY_RUN         设为 true 时不实际创建，只打印将要执行的操作

示例:
  GITHUB_TOKEN=ghp_xxx GITHUB_REPO=myorg/tenant-hub JENKINS_URL=http://120.79.41.29:8080 bash scripts/setup-github-webhook.sh
EOF
}

# ---- 参数校验 ----
if [[ -z "$GITHUB_TOKEN" || -z "$GITHUB_REPO" || -z "$JENKINS_URL" ]]; then
    err "缺少必需的环境变量"
    show_help
    exit 1
fi

WEBHOOK_URL="${JENKINS_URL%/}/github-webhook/"

info "GitHub Repo: ${GITHUB_REPO}"
info "Jenkins Webhook URL: ${WEBHOOK_URL}"
info "Dry Run: ${DRY_RUN}"
echo ""

# ---- 检查是否已存在相同的 webhook ----
info "检查现有 webhooks..."
EXISTING_HOOKS=$(curl -sS \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${GITHUB_REPO}/hooks" 2>/dev/null || echo "[]")

# 检查是否已配置过相同的 jenkins webhook
EXISTING_URL=$(echo "$EXISTING_HOOKS" | grep -o "${WEBHOOK_URL}" || true)
if [[ -n "$EXISTING_URL" ]]; then
    ok "Webhook 已存在，无需重复配置"
    exit 0
fi

# ---- 创建 webhook ----
if [[ "$DRY_RUN" == "true" ]]; then
    info "[Dry Run] 将要创建 webhook:"
    echo "  URL: ${WEBHOOK_URL}"
    echo "  Events: push"
    exit 0
fi

info "创建 GitHub webhook..."
RESPONSE=$(curl -sS -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${GITHUB_REPO}/hooks" \
    -d '{
        "name": "web",
        "active": true,
        "events": ["push"],
        "config": {
            "url": "'${WEBHOOK_URL}'",
            "content_type": "json"
        }
    }' 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "201" ]]; then
    ok "Webhook 创建成功"
    echo ""
    echo "配置详情:"
    echo "  触发事件: push"
    echo "  目标 URL: ${WEBHOOK_URL}"
    echo ""
    echo "测试方法:"
    echo "  1. git commit -m 'test trigger' && git push origin main"
    echo "  2. 观察 Jenkins 是否自动开始构建"
elif [[ "$HTTP_CODE" == "422" ]]; then
    # 可能是 webhook 已存在但 URL 不完全匹配
    warn "GitHub 返回 422，可能 webhook 已存在或配置有误"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    exit 1
else
    err "Webhook 创建失败 (HTTP ${HTTP_CODE})"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    exit 1
fi
