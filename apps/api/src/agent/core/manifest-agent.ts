import { createLlmClient } from './llm-client.js';
import { mapChatMessagesToBaseMessages } from './message-mapper.js';
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
} from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import {
  statusChunk,
  messageChunk,
  chartChunk,
  toolCallChunk,
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
import { z } from 'zod';

const MAX_ITERATIONS = 5;

// --- Build LangChain tool definitions from manifest items ---

interface ToolDef {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
}

function buildTools(manifest: ApiManifestItem[]): ToolDef[] {
  return manifest.map((item) => ({
    name: item.name,
    description: item.description,
    schema: mergeToolSchema(item),
  }));
}

/** Merge pathParamsSchema + bodySchema so LLM knows about all required params */
function mergeToolSchema(item: ApiManifestItem): z.ZodTypeAny {
  const bodyShape =
    item.bodySchema instanceof z.ZodObject
      ? (item.bodySchema.shape as Record<string, z.ZodTypeAny>)
      : {};
  const pathShape =
    item.pathParamsSchema instanceof z.ZodObject
      ? (item.pathParamsSchema.shape as Record<string, z.ZodTypeAny>)
      : {};
  const merged = { ...bodyShape, ...pathShape };
  if (Object.keys(merged).length === 0) return z.object({});
  return z.object(merged);
}

/** Substitute path params (e.g. :id, :roomId) with values from LLM args */
function buildActualPath(
  item: ApiManifestItem,
  args: Record<string, unknown>
): string {
  let path = item.path;
  if (item.pathParamsSchema instanceof z.ZodObject) {
    for (const key of Object.keys(item.pathParamsSchema.shape)) {
      const value = args[key];
      if (value !== undefined && value !== null) {
        path = path.replace(`:${key}`, encodeURIComponent(String(value)));
      }
    }
  }
  return path;
}

function buildSystemPrompt(manifest: ApiManifestItem[]): string {
  const items = manifest
    .map(
      (item) =>
        `- ${item.name}: ${item.description}（${item.category === 'query' ? '查询类，自动执行' : '写操作类，需确认'}）`
    )
    .join('\n');

  return `你是 Tenant Hub（租务通）的智能助手。你的唯一职责是调用工具来响应用户请求。系统会自动处理参数验证和操作确认。

## Available Tools
${items}

## Fundamental Rules（最高优先级）
- **始终直接调用工具**：只要用户表达了操作意图，立即调用对应工具并传入已知参数。系统会自动弹出表单让用户补齐缺失信息，或弹出确认框请用户确认。
- **禁止预先查询验证**：不要先调用查询工具验证数据是否存在。直接调用用户意图对应的操作工具即可。
- **每个请求必须至少调用一个工具**：用户说"改"就调 update 工具，用户说"退租"就调 terminate 工具，用户说"创建"就调 create 工具。
- 查询类工具会自动执行并返回结果，写操作类工具会触发表单或确认弹窗。
- 如果用户请求生成图表，请使用 generate_chart 工具。
- 如果用户意图与任何工具无关，直接友好回复。
- 不要执行删除、退款等高风险操作，除非用户明确请求。
- 当用户消息提示"已补充参数"或"已确认操作"时，继续执行操作。`;
}

// --- Parameter validation ---

function getRequiredFields(schema: z.ZodTypeAny): string[] {
  try {
    const fields = schemaToFormFields(schema);
    return fields.filter((f) => f.required).map((f) => f.name);
  } catch {
    return [];
  }
}

function getMissingRequiredFields(
  schema: z.ZodTypeAny,
  params: Record<string, unknown>
): string[] {
  return getRequiredFields(schema).filter(
    (name) =>
      params[name] === undefined || params[name] === null || params[name] === ''
  );
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
  // Build a human-readable operation description with parameter table
  const fieldDefs = schemaToFormFields(mergeToolSchema(item));
  const fieldMap = new Map(fieldDefs.map((f) => [f.name, f]));
  const paramLines = Object.entries(params).map(([key, value]) => {
    const label = fieldMap.get(key)?.label || key;
    const displayValue =
      typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    return `| ${label} | ${displayValue} |`;
  });

  const header = `| 参数 | 值 |\n|------|-----|`;
  const body = paramLines.length > 0 ? paramLines.join('\n') : '（无参数）';
  return `${item.description}\n\n${header}\n${body}`;
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

  const tools = buildTools(manifest);
  const llmWithTools = client.bindTools(tools) as unknown as Runnable<
    BaseMessage[],
    AIMessage
  >;

  const messages: BaseMessage[] = [
    new SystemMessage(buildSystemPrompt(manifest)),
    ...mapChatMessagesToBaseMessages(history),
    new HumanMessage(userMessage),
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const response = await llmWithTools.invoke(messages);

      // Native tool call from LLM
      if (response.tool_calls && response.tool_calls.length > 0) {
        messages.push(response);

        const toolCall = response.tool_calls[0];
        const toolName = toolCall.name;
        const toolArgs = (toolCall.args ?? {}) as Record<string, unknown>;

        const item = getApiManifestItem(toolName);
        if (!item) {
          messages.push(
            new ToolMessage({
              content: `错误：未找到工具 ${toolName}`,
              tool_call_id: toolCall.id ?? '',
            })
          );
          continue;
        }

        // Query tools: execute immediately, feed result back
        if (item.category === 'query') {
          yield statusChunk(`正在查询${item.description}...`);

          try {
            const result = await executeApiAction(
              item,
              buildActualPath(item, toolArgs),
              toolArgs,
              { organizationId: ctx.organizationId, userId: ctx.userId }
            );

            if (item.name === 'generate_chart' && isChartResult(result)) {
              messages.push(
                new ToolMessage({
                  content: JSON.stringify(result),
                  tool_call_id: toolCall.id ?? '',
                })
              );
              yield chartChunk(JSON.stringify(result));
              yield doneChunk();
              return;
            }

            messages.push(
              new ToolMessage({
                content: JSON.stringify(result),
                tool_call_id: toolCall.id ?? '',
              })
            );
          } catch (error) {
            const errorText =
              error instanceof Error ? error.message : '查询执行失败';
            messages.push(
              new ToolMessage({
                content: `查询失败：${errorText}`,
                tool_call_id: toolCall.id ?? '',
              })
            );
          }
          continue;
        }

        // Action tools: check params completeness
        const mergedSchema = mergeToolSchema(item);
        const missing = getMissingRequiredFields(mergedSchema, toolArgs);

        if (missing.length > 0) {
          // Show form for missing required fields
          const fields = schemaToFormFields(mergedSchema);
          const missingNames = new Set(missing);
          const visibleFields = fields.filter(
            (f) => missingNames.has(f.name) || f.required
          );

          const fieldsWithDefaults = visibleFields.map((field) => ({
            ...field,
            defaultValue:
              toolArgs[field.name] !== undefined
                ? toolArgs[field.name]
                : field.defaultValue,
          }));

          yield toolCallChunk('请补充以下信息：', {
            tool: item.name,
            kind: 'form',
            reason: `缺少必要参数：${missing.join('、')}`,
            fields: fieldsWithDefaults,
          });
          return;
        }

        // All params present: show confirmation
        const summary = buildActionSummary(item, toolArgs);
        yield toolCallChunk('准备执行以下操作：', {
          tool: item.name,
          kind: 'confirmation',
          reason: '请确认操作',
          method: item.method,
          path: item.path,
          params: toolArgs,
          summary,
          impact: [item.description],
          requiresConfirmation: true,
        });
        return;
      }

      // Text reply (no tool call)
      const text =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      if (text.trim()) {
        yield messageChunk(text);
      }
      yield doneChunk();
      return;
    }

    yield errorChunk('思考次数过多，请简化您的问题后重试。');
  } catch (error) {
    yield errorChunk(
      error instanceof Error ? error.message : '智能助手分析失败'
    );
  }
}
