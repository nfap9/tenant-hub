import { createLlmClient } from './llm-client.js';
import { mapChatMessagesToBaseMessages } from './message-mapper.js';
import { z } from 'zod';
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from '@langchain/core/messages';
import {
  statusChunk,
  messageChunk,
  chartChunk,
  formChunk,
  actionChunk,
  doneChunk,
  errorChunk,
} from './stream-formatter.js';
import {
  listApiManifestItems,
  getApiManifestItem,
  type ApiManifestItem,
} from '../api-manifest.js';
import { schemaToFormFields } from '../schema-to-form.js';
import { executeApiAction } from '../api-executor.js';
import type { AgentContext, ChatMessage, StreamChunk } from '../types.js';

export interface ManifestAgentDecision {
  intent: string;
  selectedApi?: {
    name: string;
    method: string;
    path: string;
  };
  ready: boolean;
  requiresConfirmation?: boolean;
  reason?: string;
  missingFields?: Array<{
    name: string;
    reason: string;
  }>;
  params?: Record<string, unknown>;
  reply?: string;
}

const MAX_ITERATIONS = 5;

function buildManifestPrompt(
  manifest: ApiManifestItem[],
  userMessage: string
): string {
  const items = manifest
    .map((item) => {
      const params = item.bodySchema
        ? describeSchema(item.bodySchema)
        : '无参数';
      return `- ${item.name}: [${item.method}] ${item.path} - ${item.description}（参数：${params}）`;
    })
    .join('\n');

  return `你是 Tenant Hub（租务通）的智能助手，能够通过调用业务 API 帮助用户完成公寓租赁管理业务。

## 可用业务接口
${items}

## 工作规则
1. 分析用户意图，从上方接口中选择最合适的一个。
2. 查询类接口（category=query）不需要用户确认，系统会自动执行并把结果返回给你，你可以基于结果继续选择下一个查询或给出最终回复。
3. 写操作类接口（POST/PUT/PATCH/DELETE）默认需要用户确认，返回 selectedApi、params、requiresConfirmation=true。
4. 仔细从用户消息中提取已经提供的字段值，放入 params。只把仍然缺失的必要字段放入 missingFields，不要编造数据。
5. 字段名必须严格使用接口参数中列出的 name（英文），missingFields 中的 name 也要与参数名完全一致。
6. 如果用户意图与任何接口无关，直接友好回复，selectedApi 为空。
7. 不要执行删除、退款等高风险操作，除非用户明确请求。
8. 如果用户请求生成图表，请使用 generate_chart 接口。

## 输出格式（严格 JSON）
{
  "intent": "用户意图简述",
  "selectedApi": { "name": "接口名称", "method": "GET", "path": "/api/xxx" },
  "ready": true | false,
  "requiresConfirmation": true | false,
  "reason": "选择/缺失参数的原因",
  "missingFields": [{ "name": "字段名", "reason": "为什么需要" }],
  "params": { "字段名": "值" },
  "reply": "给用户看的自然语言回复"
}

用户消息："""${userMessage}"""`;
}

function describeSchema(schema: z.ZodTypeAny): string {
  try {
    const fields = schemaToFormFields(schema);
    if (fields.length === 0) return '无参数';
    return fields
      .map((f) => {
        const extras: string[] = [];
        if (f.type) extras.push(`类型:${f.type}`);
        if (f.required) extras.push('必填');
        if (f.options?.length) {
          extras.push(`可选值:${f.options.map((o) => o.value).join('|')}`);
        }
        return `${f.label}(${f.name}${extras.length ? `, ${extras.join(', ')}` : ''})`;
      })
      .join('; ');
  } catch {
    return '未知';
  }
}

function parseDecision(text: string): ManifestAgentDecision | undefined {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return undefined;
  try {
    return JSON.parse(jsonMatch[0]) as ManifestAgentDecision;
  } catch {
    return undefined;
  }
}

function isChartResult(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'chartType' in result &&
    'labels' in result &&
    'datasets' in result
  );
}

function buildActionSummary(
  item: ApiManifestItem,
  params: Record<string, unknown>
): string {
  return `${item.description}：${JSON.stringify(params, null, 2)}`;
}

export async function* runManifestAgent(
  userMessage: string,
  history: ChatMessage[],
  ctx: AgentContext
): AsyncGenerator<StreamChunk> {
  let client;
  try {
    client = createLlmClient();
  } catch {
    yield errorChunk(
      '智能助手尚未配置，请联系管理员配置 LLM_API_KEY 环境变量。'
    );
    return;
  }

  const manifest = listApiManifestItems(ctx.permissions);
  if (manifest.length === 0) {
    yield errorChunk('当前用户没有可用的业务操作权限。');
    return;
  }

  yield statusChunk('正在分析您的需求...');

  const messages = [
    new SystemMessage(buildManifestPrompt(manifest, userMessage)),
    ...mapChatMessagesToBaseMessages(history),
    new HumanMessage(userMessage),
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const response = await client.invoke(messages);
      const text =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      const decision = parseDecision(text);
      if (!decision) {
        yield messageChunk(text);
        yield doneChunk();
        return;
      }

      // 记录模型本轮思考，用于多轮查询上下文
      messages.push(new AIMessage(text));

      if (!decision.selectedApi) {
        if (decision.reply) {
          yield messageChunk(decision.reply);
        }
        yield doneChunk();
        return;
      }

      const item = getApiManifestItem(decision.selectedApi.name);
      if (!item) {
        yield errorChunk(`未找到接口：${decision.selectedApi.name}`);
        return;
      }

      const needsForm =
        !decision.ready ||
        (decision.missingFields && decision.missingFields.length > 0);
      const requiresConfirmation =
        (decision.requiresConfirmation ?? item.category === 'action') &&
        !needsForm;

      // 需要展示表单或确认卡片时，不额外输出文本回复，避免重复
      if (decision.reply && !needsForm && !requiresConfirmation) {
        yield messageChunk(decision.reply);
      }

      if (needsForm) {
        const fields = item.bodySchema
          ? schemaToFormFields(item.bodySchema)
          : [];
        const missingNames = new Set(
          (decision.missingFields ?? []).map((f) => f.name)
        );
        const visibleFields = fields.filter(
          (f) => missingNames.has(f.name) || f.required
        );

        const providedParams = decision.params ?? {};
        const fieldsWithDefaults = visibleFields.map((field) => ({
          ...field,
          defaultValue:
            providedParams[field.name] !== undefined
              ? providedParams[field.name]
              : field.defaultValue,
        }));

        yield formChunk(decision.reason || '请补充以下信息：', {
          tool: item.name,
          reason: decision.reason || '缺少必要参数',
          fields: fieldsWithDefaults,
        });
        yield doneChunk();
        return;
      }

      if (requiresConfirmation) {
        const summary = buildActionSummary(item, decision.params ?? {});
        yield actionChunk(decision.reason || '准备执行以下操作：', {
          tool: item.name,
          method: item.method,
          path: item.path,
          params: decision.params ?? {},
          summary,
          impact: [item.description],
          requiresConfirmation: true,
        });
        yield doneChunk();
        return;
      }

      // 查询类接口：自动执行，把结果喂给模型继续下一轮
      yield statusChunk(`正在查询${item.description}...`);

      try {
        const result = await executeApiAction(
          item,
          item.path,
          decision.params ?? {},
          { organizationId: ctx.organizationId, userId: ctx.userId }
        );

        if (item.name === 'generate_chart' && isChartResult(result)) {
          yield chartChunk(JSON.stringify(result));
          yield doneChunk();
          return;
        }

        const observation = `查询结果：${JSON.stringify(result, null, 2)}`;
        messages.push(new HumanMessage(observation));
      } catch (error) {
        const errorText =
          error instanceof Error ? error.message : '查询执行失败';
        messages.push(
          new HumanMessage(`查询执行失败：${errorText}，请尝试其他方式。`)
        );
      }
    }

    yield errorChunk('思考次数过多，请简化您的问题后重试。');
  } catch (error) {
    yield errorChunk(
      error instanceof Error ? error.message : '智能助手分析失败'
    );
  }
}
