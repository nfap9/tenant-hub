import { z } from 'zod';
import {
  chatInput,
  createConversationInput,
  resumeInput,
} from '../../routes/ai.js';
import {
  bearerSecurity,
  dataResponse,
  forbiddenResponse,
  notFoundResponse,
  organizationIdHeader,
  registry,
  unauthorizedResponse,
} from '../registry.js';

const tag = 'AI 助手';

const conversationIdParams = z.object({ id: z.string().describe('会话ID') });

const conversationSchema = z.object({
  id: z.string().describe('会话ID'),
  organizationId: z.string().describe('组织ID'),
  userId: z.string().describe('用户ID'),
  title: z.string().nullable().describe('会话标题'),
  modelId: z.string().describe('使用的模型ID'),
  status: z.enum(['ACTIVE', 'ARCHIVED']).describe('会话状态'),
  createdAt: z.string().describe('创建时间（ISO 8601）'),
  updatedAt: z.string().describe('更新时间（ISO 8601）'),
});

/** SSE 事件协议说明（chat / resume 两个流式端点共用） */
const sseProtocolDescription = `以 SSE（Server-Sent Events）流式返回，Content-Type 为 \`text/event-stream\`。事件协议（chat 与 resume 共用）：

| 事件 | 说明 |
| --- | --- |
| \`text_delta\` | 模型输出的增量文本（真流式） |
| \`message\` | 完整消息快照 |
| \`tool_call\` | 工具调用记录 |
| \`interrupt\` | 写操作待人工确认，需调用 resume 接口继续 |
| \`error\` | 执行错误 |
| \`done\` | 本次流结束 |

每个事件以 \`event: <类型>\` + \`data: <JSON>\` 的 SSE 帧格式推送。`;

registry.registerPath({
  method: 'get',
  path: '/api/ai/models',
  tags: [tag],
  summary: '获取可用模型列表',
  description: '返回已启用的模型列表，供前端选择器使用',
  security: bearerSecurity,
  request: { headers: organizationIdHeader },
  responses: {
    200: {
      description: '模型列表',
      content: {
        'application/json': {
          schema: dataResponse(
            z.array(
              z.object({
                id: z.string().describe('模型ID'),
                displayName: z.string().describe('显示名称'),
                tags: z.array(z.string()).describe('模型标签'),
              })
            )
          ),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/ai/conversations',
  tags: [tag],
  summary: '创建会话',
  description: '创建新会话',
  security: bearerSecurity,
  request: {
    headers: organizationIdHeader,
    body: {
      content: { 'application/json': { schema: createConversationInput } },
    },
  },
  responses: {
    200: {
      description: '创建成功',
      content: {
        'application/json': { schema: dataResponse(conversationSchema) },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/ai/conversations',
  tags: [tag],
  summary: '获取我的会话列表',
  description: '列出我的会话',
  security: bearerSecurity,
  request: { headers: organizationIdHeader },
  responses: {
    200: {
      description: '会话列表',
      content: {
        'application/json': {
          schema: dataResponse(z.array(conversationSchema)),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/ai/conversations/{id}/state',
  tags: [tag],
  summary: '获取会话完整状态',
  description:
    '取会话完整状态：消息历史 + 待处理 interrupt + 待确认操作审计记录，用于历史回放',
  security: bearerSecurity,
  request: { params: conversationIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '会话状态',
      content: {
        'application/json': {
          schema: dataResponse(
            z.unknown().describe('图状态消息 + 待处理 interrupts + 审计记录')
          ),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/ai/conversations/{id}/chat',
  tags: [tag],
  summary: '发送消息（SSE 流式）',
  description: `发送消息并以 SSE 流式返回 Agent 输出。\n\n${sseProtocolDescription}`,
  security: bearerSecurity,
  request: {
    params: conversationIdParams,
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: chatInput } } },
  },
  responses: {
    200: {
      description: 'SSE 事件流',
      content: {
        'text/event-stream': {
          schema: z.string().describe('SSE 事件流（见接口描述中的事件协议）'),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/ai/conversations/{id}/resume',
  tags: [tag],
  summary: '确认待处理操作（SSE 流式）',
  description: `用户对待确认操作 approve / reject 后恢复 graph 执行，SSE 流式返回后续执行过程。\n\n${sseProtocolDescription}`,
  security: bearerSecurity,
  request: {
    params: conversationIdParams,
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: resumeInput } } },
  },
  responses: {
    200: {
      description: 'SSE 事件流',
      content: {
        'text/event-stream': {
          schema: z.string().describe('SSE 事件流（见接口描述中的事件协议）'),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/ai/conversations/{id}/archive',
  tags: [tag],
  summary: '归档会话',
  description: '归档会话',
  security: bearerSecurity,
  request: { params: conversationIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '归档成功',
      content: {
        'application/json': {
          schema: dataResponse(
            z.object({ archived: z.boolean().describe('是否归档成功') })
          ),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});
