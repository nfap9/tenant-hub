import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { env } from '../config/env.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { queryApartmentsTool } from './tools/apartments.js';
import { queryRoomsTool } from './tools/rooms.js';
import { queryLeasesTool } from './tools/leases.js';
import { queryBillsTool } from './tools/bills.js';
import { analyticsSummaryTool } from './tools/analytics.js';
import { queryRoomDetailTool } from './tools/room-detail.js';
import { queryApartmentContractTool } from './tools/apartment-contract.js';
import {
  queryDepositsTool,
  queryDepositSummaryTool,
} from './tools/deposits.js';
import {
  queryTransactionsTool,
  queryTransactionSummaryTool,
} from './tools/transactions.js';
import { queryMeterReadingsTool } from './tools/meter-readings.js';
import { queryReservationTool } from './tools/reservations.js';
import { querySettlementsTool } from './tools/settlements.js';
import { generateChartTool } from './tools/chart.js';
import type { AgentContext, ChatMessage } from './types.js';

const MAX_ITERATIONS = 5;

function createTools(ctx: AgentContext) {
  return [
    queryApartmentsTool(ctx),
    queryRoomsTool(ctx),
    queryLeasesTool(ctx),
    queryBillsTool(ctx),
    analyticsSummaryTool(ctx),
    queryRoomDetailTool(ctx),
    queryApartmentContractTool(ctx),
    queryDepositsTool(ctx),
    queryDepositSummaryTool(ctx),
    queryTransactionsTool(ctx),
    queryTransactionSummaryTool(ctx),
    queryMeterReadingsTool(ctx),
    queryReservationTool(ctx),
    querySettlementsTool(ctx),
    generateChartTool,
  ];
}

function mapMessages(history: ChatMessage[]): BaseMessage[] {
  return history.map((msg) => {
    switch (msg.role) {
      case 'system':
        return new SystemMessage(msg.content);
      case 'user':
        return new HumanMessage(msg.content);
      case 'assistant':
        return new AIMessage(msg.content);
      case 'tool':
        return new ToolMessage({
          content: msg.content,
          tool_call_id: msg.tool_call_id || '',
        });
      default:
        return new HumanMessage(msg.content);
    }
  });
}

export interface StreamChunk {
  type: 'status' | 'message' | 'done' | 'error' | 'chart';
  content: string;
}

export async function* runAgent(
  userMessage: string,
  history: ChatMessage[],
  ctx: AgentContext
): AsyncGenerator<StreamChunk> {
  if (!env.LLM_API_KEY) {
    yield {
      type: 'error',
      content: '智能助手尚未配置，请联系管理员配置 LLM_API_KEY 环境变量。',
    };
    return;
  }

  const tools = createTools(ctx);

  const model = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    temperature: env.LLM_TEMPERATURE,
    maxTokens: env.LLM_MAX_TOKENS,
    apiKey: env.LLM_API_KEY,
    ...(env.LLM_BASE_URL
      ? { configuration: { baseURL: env.LLM_BASE_URL } }
      : {}),
  });

  const modelWithTools = model.bindTools(tools);

  const messages: BaseMessage[] = [
    new SystemMessage(SYSTEM_PROMPT),
    ...mapMessages(history),
    new HumanMessage(userMessage),
  ];

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await modelWithTools.invoke(messages);

    // 处理工具调用
    if (response.tool_calls && response.tool_calls.length > 0) {
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        const toolName = toolCall.name;
        const toolArgs = toolCall.args as Record<string, unknown>;

        const isChartTool = toolName === 'generate_chart';

        yield {
          type: isChartTool ? 'chart' : 'status',
          content: isChartTool
            ? '正在生成图表...'
            : `正在调用工具：${toolName}...`,
        };

        const tool = tools.find((t) => t.name === toolName);
        if (!tool) {
          messages.push(
            new ToolMessage({
              content: JSON.stringify({ error: `工具 ${toolName} 不存在` }),
              tool_call_id: toolCall.id || toolName,
            })
          );
          continue;
        }

        try {
          const result = await (
            tool as {
              invoke: (args: Record<string, unknown>) => Promise<unknown>;
            }
          ).invoke(toolArgs);

          const resultStr = String(result);

          if (isChartTool) {
            try {
              const chartData = JSON.parse(resultStr);
              yield {
                type: 'chart',
                content: JSON.stringify(chartData),
              };
            } catch {
              // 解析失败，继续正常流程
            }
          }

          messages.push(
            new ToolMessage({
              content: resultStr,
              tool_call_id: toolCall.id || toolName,
            })
          );
        } catch (error) {
          messages.push(
            new ToolMessage({
              content: JSON.stringify({
                error: error instanceof Error ? error.message : '工具执行失败',
              }),
              tool_call_id: toolCall.id || toolName,
            })
          );
        }
      }

      continue;
    }

    // 没有工具调用，返回最终回复
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    yield { type: 'message', content };
    yield { type: 'done', content: '' };
    return;
  }

  yield {
    type: 'error',
    content: '思考次数过多，请简化您的问题后重试。',
  };
}
