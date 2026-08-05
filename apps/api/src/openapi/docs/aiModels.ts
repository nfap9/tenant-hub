import { z } from 'zod';
import { modelConfigSchema } from '../../ai/models/types.js';
import {
  badRequestResponse,
  bearerSecurity,
  conflictResponse,
  dataResponse,
  forbiddenResponse,
  notFoundResponse,
  organizationIdHeader,
  registry,
  unauthorizedResponse,
} from '../registry.js';

const tag = 'AI 模型管理';

const permissionNote = '（需要权限 `aiModel:manage`）';

const modelIdParams = z.object({ id: z.string().describe('模型ID') });

/** 出参模型（apiKey 永不回传，以 hasApiKey 标记替代） */
const publicModelSchema = z.object({
  id: z.string().describe('模型ID'),
  displayName: z.string().describe('显示名称'),
  provider: z
    .enum(['anthropic', 'openai', 'openai-compat'])
    .describe('API 协议类型'),
  providerModel: z.string().describe('供应商侧模型名'),
  baseURL: z.string().nullable().describe('自定义 API 地址'),
  maxTokens: z.number().describe('单次请求最大输出 token 数'),
  contextWindowTokens: z.number().describe('上下文窗口大小（token）'),
  temperature: z.number().describe('采样温度'),
  tags: z.array(z.string()).describe('模型标签'),
  fallbackTo: z.array(z.string()).describe('失败降级模型ID链'),
  enabled: z.boolean().describe('是否启用'),
  hasApiKey: z.boolean().describe('是否已配置 API 密钥'),
});

registry.registerPath({
  method: 'get',
  path: '/api/ai-models',
  tags: [tag],
  summary: '获取全部模型',
  description: `返回全部模型（含禁用），apiKey 永不回传${permissionNote}`,
  security: bearerSecurity,
  request: { headers: organizationIdHeader },
  responses: {
    200: {
      description: '模型列表',
      content: {
        'application/json': {
          schema: dataResponse(z.array(publicModelSchema)),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/ai-models',
  tags: [tag],
  summary: '创建模型',
  description: `创建模型（id 由用户定义，创建后不可改）${permissionNote}`,
  security: bearerSecurity,
  request: {
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: modelConfigSchema } } },
  },
  responses: {
    200: {
      description: '创建成功',
      content: {
        'application/json': { schema: dataResponse(publicModelSchema) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: conflictResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/ai-models/{id}/update',
  tags: [tag],
  summary: '更新模型',
  description: `更新模型（不允许改 id；apiKey 不传或为空字符串时保持原值不变）${permissionNote}`,
  security: bearerSecurity,
  request: {
    params: modelIdParams,
    headers: organizationIdHeader,
    body: {
      content: {
        'application/json': {
          schema: modelConfigSchema
            .omit({ id: true, updatedAt: true })
            .partial(),
        },
      },
    },
  },
  responses: {
    200: {
      description: '更新成功',
      content: {
        'application/json': { schema: dataResponse(publicModelSchema) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/ai-models/{id}/delete',
  tags: [tag],
  summary: '删除模型',
  description: `删除模型；仍被会话或组织默认配置引用时拒绝删除${permissionNote}`,
  security: bearerSecurity,
  request: { params: modelIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '删除成功',
      content: {
        'application/json': {
          schema: dataResponse(
            z.object({ deleted: z.boolean().describe('是否删除成功') })
          ),
        },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});
