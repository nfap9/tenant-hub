export const getApiBaseUrl = () => {
  // 小程序无法使用环境变量，这里通过条件编译或固定值处理
  // 开发环境默认使用 localhost 代理，生产环境需配置真实域名
  return "http://localhost:4000/api";
};
