import { createRequire } from 'node:module';
import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';
// 注册所有端点（副作用导入）
import './docs/auth.js';
import './docs/organizations.js';
import './docs/apartments.js';
import './docs/leases.js';
import './docs/bills.js';
import './docs/ai.js';
import './docs/aiModels.js';

// 从 package.json 读取版本号（dev 与构建产物下路径一致）
const { version } = createRequire(import.meta.url)('../../package.json') as {
  version: string;
};

export const openApiDocument = new OpenApiGeneratorV31(
  registry.definitions
).generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'Tenant Hub API',
    version,
    description:
      'Tenant Hub（租务通）后端 API 文档。除注册/登录外所有接口需携带 `Authorization: Bearer <jwt>`；组织级接口还需携带 `x-organization-id` 请求头。',
  },
  servers: [{ url: 'http://localhost:4000' }],
});
