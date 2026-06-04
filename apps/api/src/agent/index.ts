import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  AIMessageChunk,
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
import { PERMISSIONS } from '../services/roles.js';
import type { AgentContext, ChatMessage } from './types.js';

const MAX_ITERATIONS = 5;

const TOOL_PERMISSIONS: Record<string, string> = {
  query_apartments: PERMISSIONS.APARTMENT_VIEW,
  query_rooms: PERMISSIONS.ROOM_VIEW,
  query_leases: PERMISSIONS.LEASE_VIEW,
  query_bills: PERMISSIONS.BILL_VIEW,
  query_deposits: PERMISSIONS.DEPOSIT_VIEW,
  query_transactions: PERMISSIONS.BILL_VIEW,
  query_transaction_summary: PERMISSIONS.BILL_VIEW,
  query_meter_readings: PERMISSIONS.BILL_VIEW,
  query_reservation: PERMISSIONS.ROOM_VIEW,
  query_settlements: PERMISSIONS.LEASE_VIEW,
  query_room_detail: PERMISSIONS.ROOM_VIEW,
  query_apartment_contract: PERMISSIONS.APARTMENT_VIEW,
  analytics_summary: PERMISSIONS.APARTMENT_VIEW,
  generate_chart: PERMISSIONS.APARTMENT_VIEW,
};

const TOOL_LABELS: Record<string, string> = {
  query_apartments: '公寓列表',
  query_rooms: '房间列表',
  query_leases: '租约列表',
  query_bills: '账单列表',
  analytics_summary: '经营汇总',
  query_room_detail: '房间详情',
  query_apartment_contract: '公寓合同',
  query_deposits: '押金列表',
  query_deposit_summary: '押金汇总',
  query_transactions: '收支记录',
  query_transaction_summary: '收支汇总',
  query_meter_readings: '抄表记录',
  query_reservation: '预留信息',
  query_settlements: '退租结算',
  generate_chart: '生成图表',
};

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

  yield {
    type: 'status',
    content: '正在分析您的问题...',
  };

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const stream = await modelWithTools.stream(messages);
    let accumulated: AIMessageChunk | null = null;
    let fullContent = '';

    for await (const chunk of stream) {
      accumulated = accumulated ? accumulated.concat(chunk) : chunk;

      const chunkContent =
        typeof chunk.content === 'string'
          ? chunk.content
          : Array.isArray(chunk.content)
            ? chunk.content
                .filter(
                  (c) => typeof c === 'object' && c !== null && 'text' in c
                )
                .map((c) => (c as { text: string }).text)
                .join('')
            : '';

      if (chunkContent) {
        fullContent += chunkContent;
        yield { type: 'message', content: chunkContent };
      }
    }

    const response = accumulated;

    if (!response) {
      yield { type: 'error', content: '模型未返回有效响应' };
      return;
    }

    // 检查是否有工具调用（流式模式下检查 tool_calls 或 tool_call_chunks）
    const hasToolCalls =
      (response.tool_calls &&
        response.tool_calls.length > 0 &&
        response.tool_calls[0].name) ||
      (response.tool_call_chunks &&
        response.tool_call_chunks.length > 0 &&
        response.tool_call_chunks[0].name);

    if (hasToolCalls) {
      // 将 AIMessageChunk 转为 AIMessage 以便存到消息历史
      const aiMsg = new AIMessage(fullContent || '');
      if (response.tool_calls) {
        aiMsg.tool_calls = response.tool_calls;
      }
      messages.push(aiMsg);

      // 从 tool_call_chunks 提取工具调用信息
      const toolCalls =
        response.tool_call_chunks?.filter((tc) => tc.name) ??
        response.tool_calls ??
        [];

      for (const toolCall of toolCalls) {
        const toolName = toolCall.name;
        let toolArgs: Record<string, unknown>;
        if (typeof toolCall.args === 'string') {
          try {
            toolArgs = JSON.parse(toolCall.args);
          } catch {
            toolArgs = {};
          }
        } else {
          toolArgs = (toolCall.args || {}) as Record<string, unknown>;
        }

        const isChartTool = toolName === 'generate_chart';

        yield {
          type: isChartTool ? 'chart' : 'status',
          content: isChartTool
            ? '正在生成图表...'
            : `正在查询${TOOL_LABELS[toolName as string] || toolName}...`,
        };

        const tool = tools.find((t) => t.name === toolName);
        if (!tool) {
          messages.push(
            new ToolMessage({
              content: JSON.stringify({ error: `工具 ${toolName} 不存在` }),
              tool_call_id: (toolCall.id || toolName) as string,
            })
          );
          continue;
        }

        // 权限检查
        const requiredPermission = TOOL_PERMISSIONS[toolName as string];
        if (
          requiredPermission &&
          !ctx.permissions.includes('*') &&
          !ctx.permissions.includes(requiredPermission)
        ) {
          messages.push(
            new ToolMessage({
              content: JSON.stringify({
                error: `无权限使用${TOOL_LABELS[toolName as string] || toolName}功能`,
              }),
              tool_call_id: (toolCall.id || toolName) as string,
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
              tool_call_id: (toolCall.id || toolName) as string,
            })
          );
        } catch (error) {
          messages.push(
            new ToolMessage({
              content: JSON.stringify({
                error: error instanceof Error ? error.message : '工具执行失败',
              }),
              tool_call_id: (toolCall.id || toolName) as string,
            })
          );
        }
      }

      continue;
    }

    // 没有工具调用，流式输出已完成
    yield { type: 'done', content: '' };
    return;
  }

  yield {
    type: 'error',
    content: '思考次数过多，请简化您的问题后重试。',
  };
}
