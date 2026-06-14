import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import type { AIMessageChunk } from '@langchain/core/messages';
import type { StructuredTool } from '@langchain/core/tools';
import { createLlmClient } from './llm-client.js';
import { mapChatMessagesToBaseMessages } from './message-mapper.js';
import { createTools, getToolLabel } from './tool-registry.js';
import { executeToolCall, type ToolCallLike } from './tool-executor.js';
import {
  statusChunk,
  messageChunk,
  chartChunk,
  doneChunk,
  errorChunk,
} from './stream-formatter.js';
import { SYSTEM_PROMPT } from '../prompts.js';
import type { AgentContext, ChatMessage, StreamChunk } from '../types.js';

const MAX_ITERATIONS = 5;

function extractTextFromChunk(chunk: AIMessageChunk): string {
  if (typeof chunk.content === 'string') {
    return chunk.content;
  }
  if (Array.isArray(chunk.content)) {
    return chunk.content
      .map((item) => {
        if (typeof item === 'object' && item !== null && 'text' in item) {
          return (item as { text: string }).text;
        }
        return '';
      })
      .join('');
  }
  return '';
}

function hasToolCalls(response: AIMessageChunk): boolean {
  return Boolean(
    (response.tool_calls?.length && response.tool_calls[0].name) ||
    (response.tool_call_chunks?.length && response.tool_call_chunks[0].name)
  );
}

function extractToolCalls(response: AIMessageChunk): ToolCallLike[] {
  if (response.tool_call_chunks && response.tool_call_chunks.length > 0) {
    return response.tool_call_chunks.filter((tc) => Boolean(tc.name));
  }
  return response.tool_calls || [];
}

export interface AgentRunnerDeps {
  createClient: () => ReturnType<typeof createLlmClient>;
  createToolSet: (ctx: AgentContext) => StructuredTool[];
}

export class AgentRunner {
  private createClient: () => ReturnType<typeof createLlmClient>;
  private createToolSet: (ctx: AgentContext) => StructuredTool[];

  constructor(deps?: Partial<AgentRunnerDeps>) {
    this.createClient = deps?.createClient ?? createLlmClient;
    this.createToolSet = deps?.createToolSet ?? createTools;
  }

  async *run(
    userMessage: string,
    history: ChatMessage[],
    ctx: AgentContext
  ): AsyncGenerator<StreamChunk> {
    let client: ReturnType<typeof createLlmClient>;
    try {
      client = this.createClient();
    } catch {
      yield errorChunk(
        '智能助手尚未配置，请联系管理员配置 LLM_API_KEY 环境变量。'
      );
      return;
    }

    const tools = this.createToolSet(ctx);
    const modelWithTools = client.bindTools(tools);

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      ...mapChatMessagesToBaseMessages(history),
      new HumanMessage(userMessage),
    ];

    yield statusChunk('正在分析您的问题...');

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const stream = await modelWithTools.stream(messages);
      let accumulated: AIMessageChunk | null = null;
      let fullContent = '';

      for await (const chunk of stream) {
        accumulated = accumulated ? accumulated.concat(chunk) : chunk;
        const text = extractTextFromChunk(chunk);
        if (text) {
          fullContent += text;
          yield messageChunk(text);
        }
      }

      const response = accumulated;
      if (!response) {
        yield errorChunk('模型未返回有效响应');
        return;
      }

      if (!hasToolCalls(response)) {
        yield doneChunk();
        return;
      }

      // 将模型响应（含工具调用）加入消息历史
      const aiMsg = new AIMessage(fullContent || '');
      if (response.tool_calls) {
        aiMsg.tool_calls = response.tool_calls;
      }
      messages.push(aiMsg);

      const toolCalls = extractToolCalls(response);
      for (const toolCall of toolCalls) {
        const toolName = toolCall.name || '';
        const isChartTool = toolName === 'generate_chart';

        yield statusChunk(
          isChartTool
            ? '正在生成图表...'
            : `正在查询${getToolLabel(toolName)}...`
        );

        const { toolMessage, resultText } = await executeToolCall(
          toolCall,
          tools,
          ctx
        );

        if (isChartTool) {
          try {
            JSON.parse(resultText);
            yield chartChunk(resultText);
          } catch {
            // 图表数据解析失败，按普通文本处理
          }
        }

        messages.push(toolMessage);
      }
    }

    yield errorChunk('思考次数过多，请简化您的问题后重试。');
  }
}

export async function* runAgent(
  userMessage: string,
  history: ChatMessage[],
  ctx: AgentContext
): AsyncGenerator<StreamChunk> {
  const runner = new AgentRunner();
  yield* runner.run(userMessage, history, ctx);
}
