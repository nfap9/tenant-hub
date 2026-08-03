// Learn more: https://docs.expo.dev/guides/customizing-metro
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// expo 包未声明 exports 映射，ESM 下导入需带完整扩展名
import { getDefaultConfig } from 'expo/metro-config.js';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// pnpm monorepo：监听 workspace 根目录，并允许从应用与根两级 node_modules 解析依赖
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

export default config;
