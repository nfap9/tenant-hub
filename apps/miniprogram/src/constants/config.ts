import Taro from '@tarojs/taro';

const normalizeLocalApiUrl = (url: string) => url.replace('http://localhost:', 'http://127.0.0.1:');

/**
 * 获取 API 基础 URL
 * - 生产环境（release）：使用真实域名（需在部署前修改）
 * - 开发/体验版：默认使用 localhost 代理，也可通过 storage 动态配置
 */
export function getApiBaseUrl(): string {
  try {
    // 正式版小程序返回生产域名
    const info = Taro.getAccountInfoSync?.();
    if (info?.miniProgram?.envVersion === 'release') {
      return 'https://api.tenanthub.example.com/api'; // 部署前替换为真实域名
    }
  } catch {
    // 非小程序环境（如 H5 预览）忽略
  }

  // 开发环境允许通过 storage 覆盖（方便切换测试环境）
  try {
    const devUrl = Taro.getStorageSync('tenantHubDevApiUrl');
    if (devUrl) return normalizeLocalApiUrl(devUrl);
  } catch {}

  return 'http://127.0.0.1:4000/api';
}

/**
 * 动态设置开发环境 API URL（仅开发版有效）
 */
export function setDevApiBaseUrl(url: string): void {
  Taro.setStorageSync('tenantHubDevApiUrl', url);
}
