pipeline {
    agent { label '4c8g' }

    options {
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timestamps()
        disableConcurrentBuilds()
    }

    triggers {
        // GitHub Webhook 推送触发（需要配置 GitHub webhook 指向 Jenkins）
        githubPush()
        // 备用：每 2 分钟轮询一次，防止 webhook 失效时构建卡住
        pollSCM('H/2 * * * *')
    }

    environment {
        NODE_VERSION = '22'
        PNPM_VERSION = '10.33.0'
        PROJECT_DIR = "${WORKSPACE}"
        DEPLOY_DIR = "${HOME}/tenant-hub"
        // 构建阶段使用的测试环境变量（非敏感）
        TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/tenant_hub_test?schema=public'
        TEST_JWT_SECRET = 'jenkins-test-secret-do-not-use-in-production'
        TEST_NODE_ENV = 'test'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Setup Environment') {
            steps {
                sh '''#!/bin/bash
                    set -e
                    echo "=== Node.js Version ==="
                    node -v || { echo "Node.js not found"; exit 1; }

                    echo "=== pnpm Version ==="
                    if ! command -v pnpm &> /dev/null || [ "$(pnpm -v | cut -d'.' -f1)" != "10" ]; then
                        echo "Installing pnpm ${PNPM_VERSION}..."
                        npm install -g pnpm@${PNPM_VERSION}
                    fi
                    pnpm -v

                    echo "=== Docker Version ==="
                    docker -v || { echo "Docker not found"; exit 1; }
                    docker compose version || { echo "Docker Compose not found"; exit 1; }

                    echo "=== PM2 Version ==="
                    pm2 -v || { echo "PM2 not found"; exit 1; }
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''#!/bin/bash
                    set -e
                    echo "Installing dependencies..."
                    pnpm install --frozen-lockfile
                '''
            }
        }

        stage('Generate Prisma Client') {
            steps {
                sh 'pnpm --filter @tenant-hub/api prisma generate'
            }
        }

        stage('Parallel Checks & Build') {
            parallel {
                stage('API') {
                    stages {
                        stage('API: Lint') {
                            steps {
                                sh 'pnpm --filter @tenant-hub/api lint'
                            }
                        }
                        stage('API: Typecheck') {
                            steps {
                                sh 'pnpm --filter @tenant-hub/api typecheck'
                            }
                        }
                        stage('API: Test') {
                            steps {
                                sh '''#!/bin/bash
                                    set -e
                                    echo "Starting test database..."
                                    docker rm -f tenant-hub-postgres-test 2>/dev/null || true
                                    docker run -d --name tenant-hub-postgres-test \
                                        -e POSTGRES_DB=tenant_hub_test \
                                        -e POSTGRES_USER=postgres \
                                        -e POSTGRES_PASSWORD=postgres \
                                        -p 127.0.0.1:5433:5432 \
                                        postgres:16-alpine

                                    echo "Waiting for test database..."
                                    for i in $(seq 1 30); do
                                        if docker exec tenant-hub-postgres-test pg_isready -U postgres -d tenant_hub_test >/dev/null 2>&1; then
                                            echo "Test database is ready"
                                            break
                                        fi
                                        if [ "$i" -eq 30 ]; then
                                            echo "Test database failed to start"
                                            exit 1
                                        fi
                                        sleep 1
                                    done

                                    export DATABASE_URL="${TEST_DATABASE_URL}"
                                    export JWT_SECRET="${TEST_JWT_SECRET}"
                                    export NODE_ENV="${TEST_NODE_ENV}"

                                    echo "Running migrations for test..."
                                    pnpm --filter @tenant-hub/api prisma migrate deploy

                                    echo "Running API tests..."
                                    pnpm --filter @tenant-hub/api test
                                '''
                            }
                            post {
                                always {
                                    sh 'docker rm -f tenant-hub-postgres-test 2>/dev/null || true'
                                }
                            }
                        }
                        stage('API: Build') {
                            steps {
                                sh 'pnpm --filter @tenant-hub/api build'
                            }
                        }
                    }
                }

                stage('Ops Web') {
                    stages {
                        stage('Ops Web: Lint') {
                            steps {
                                sh 'pnpm --filter @tenant-hub/ops-web lint'
                            }
                        }
                        stage('Ops Web: Typecheck') {
                            steps {
                                sh 'pnpm --filter @tenant-hub/ops-web typecheck'
                            }
                        }
                        stage('Ops Web: Build') {
                            steps {
                                sh '''#!/bin/bash
                                    set -e
                                    # 构建时注入 API 地址（从 Jenkins 环境变量或默认值）
                                    export VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://localhost:4000/api}"
                                    pnpm --filter @tenant-hub/ops-web build
                                '''
                            }
                        }
                    }
                }

                stage('Miniprogram') {
                    stages {
                        stage('Miniprogram: Build Weapp') {
                            steps {
                                sh 'pnpm --filter @tenant-hub/miniprogram build:weapp'
                            }
                        }
                        stage('Miniprogram: Build H5') {
                            steps {
                                sh '''#!/bin/bash
                                    set -e
                                    # 小程序 H5 构建需要 API_BASE_URL
                                    export API_BASE_URL="${API_BASE_URL:-${VITE_API_BASE_URL:-http://localhost:4000/api}}"
                                    pnpm --filter @tenant-hub/miniprogram build:h5
                                '''
                            }
                        }
                    }
                }
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                // 从 Jenkins Credentials 中安全读取生产环境变量
                withCredentials([
                    string(credentialsId: 'tenant-hub-database-url', variable: 'CRED_DATABASE_URL'),
                    string(credentialsId: 'tenant-hub-jwt-secret', variable: 'CRED_JWT_SECRET'),
                    string(credentialsId: 'tenant-hub-jwt-expires-in', variable: 'CRED_JWT_EXPIRES_IN'),
                    string(credentialsId: 'tenant-hub-vite-api-url', variable: 'CRED_VITE_API_BASE_URL'),
                    string(credentialsId: 'tenant-hub-api-base-url', variable: 'CRED_API_BASE_URL'),
                    string(credentialsId: 'tenant-hub-cors-origins', variable: 'CRED_CORS_ORIGINS'),
                    string(credentialsId: 'tenant-hub-platform-admin-phone', variable: 'CRED_PLATFORM_ADMIN_PHONE'),
                    string(credentialsId: 'tenant-hub-platform-admin-password', variable: 'CRED_PLATFORM_ADMIN_PASSWORD'),
                    string(credentialsId: 'tenant-hub-postgres-db', variable: 'CRED_POSTGRES_DB'),
                    string(credentialsId: 'tenant-hub-postgres-user', variable: 'CRED_POSTGRES_USER'),
                    string(credentialsId: 'tenant-hub-postgres-password', variable: 'CRED_POSTGRES_PASSWORD'),
                ]) {
                    sh '''#!/bin/bash
                        set -e
                        echo "=== Starting Deployment ==="
                        bash scripts/jenkins-deploy.sh \
                            --project-dir "${DEPLOY_DIR}" \
                            --build-number "${BUILD_NUMBER}" \
                            --git-commit "${GIT_COMMIT}"
                    '''
                }
            }
        }
    }

    post {
        always {
            script {
                // 清理工作区中可能残留的数据库容器
                sh 'docker rm -f tenant-hub-postgres-test 2>/dev/null || true'
            }
        }
        success {
            echo "✅ Pipeline completed successfully"
        }
        failure {
            echo "❌ Pipeline failed"
        }
    }
}
