# @tenant-hub/mobile

React Native 移动端应用，面向公寓管理系统的移动端场景。

## 技术栈

- **React Native 0.76**
- **React Native CLI**
- **TypeScript**
- **Hermes** JS 引擎

## 环境要求

- Node.js >= 20
- pnpm >= 10
- JDK 17（Android 构建）
- Android SDK（Android 构建）

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动 Metro 开发服务器
pnpm dev

# 在 Android 模拟器/真机上运行
pnpm android

# 在 iOS 模拟器上运行（仅限 macOS）
pnpm ios
```

## 工程化脚本

### 代码质量

```bash
# 类型检查
pnpm typecheck

# ESLint 检查
pnpm lint

# 格式化代码
pnpm format

# 检查格式化
pnpm format:check
```

### 测试

```bash
# 运行 Jest 测试（组件/单元测试）
pnpm test

# 监听模式
pnpm test:watch

# 覆盖率报告
pnpm test:coverage

# 运行 Legacy 集成测试
pnpm test:legacy
```

### Android APK 构建

#### 本地构建

```bash
# Debug APK
pnpm android:build:debug

# Release APK（无正式签名时使用 debug keystore 作为 fallback）
pnpm android:apk
```

构建产物位于 `android/app/build/outputs/apk/` 目录下。

#### 配置正式签名（Release）

1. 生成 keystore：

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

2. 配置签名（三选一）：

- **方式 A：gradle.properties**（不推荐提交到 git）

  ```properties
  ANDROID_RELEASE_STORE_FILE=my-release-key.keystore
  ANDROID_RELEASE_KEY_ALIAS=my-key-alias
  ANDROID_RELEASE_STORE_PASSWORD=*****
  ANDROID_RELEASE_KEY_PASSWORD=*****
  ```

- **方式 B：环境变量**（推荐 CI 使用）
  ```bash
  export ANDROID_RELEASE_STORE_FILE=my-release-key.keystore
  export ANDROID_RELEASE_KEY_ALIAS=my-key-alias
  export ANDROID_RELEASE_STORE_PASSWORD=*****
  export ANDROID_RELEASE_KEY_PASSWORD=*****
  ```

## 项目结构

```
.
├── android/              # Android 原生项目（React Native CLI）
├── assets/               # 图标、启动屏等静态资源
├── src/
│   ├── app/              # 根组件、会话管理
│   ├── components/       # 共享组件
│   ├── constants/        # 常量配置
│   ├── navigation/       # 导航配置
│   ├── screens/          # 页面组件
│   ├── services/         # API 请求、存储
│   ├── theme/            # 样式、主题 Token
│   └── types/            # TypeScript 类型
├── tests/                # Legacy 测试文件
├── App.tsx               # 入口组件
├── index.js              # JS 入口（AppRegistry）
├── metro.config.js       # Metro 配置（支持 monorepo）
├── babel.config.js       # Babel 配置
├── jest.config.js        # Jest 配置
├── tsconfig.json         # TypeScript 配置
└── package.json
```

## Monorepo 集成

本项目位于 `apps/mobile`，属于 pnpm workspace 的一部分。

- `metro.config.js` 已配置支持解析 workspace 根目录的 `node_modules`
- 如需引用 workspace 内其他包（如共享类型/工具库），请在 `package.json` 中添加依赖，Metro 会自动解析

## CI/CD

GitHub Actions 已配置：

- **Lint & Typecheck & Test**：每次 PR / Push 到 main 时自动运行
- **Build APK**：检查通过后自动构建 Release APK 并上传 Artifact

工作流文件：`.github/workflows/mobile-ci.yml`

## 注意事项

1. Android 原生目录 `android/` 已纳入版本控制，便于团队协作和本地 APK 构建。
2. iOS 目录 `ios/` 被 `.gitignore` 忽略，如需 iOS 开发请运行 `npx react-native@0.76.5 init-ios` 或手动生成。
3. 在 pnpm monorepo 中，React Native CLI 的某些依赖需要显式安装到 mobile 包中（如 `@react-native/gradle-plugin`、`@react-native-community/cli-platform-android` 等），已在 `package.json` 中配置好。
