import {
  trimMessages,
  type AIMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { ModelConfig } from '../models/types.js';

/** 历史消息预算下限：模型上下文配置过小时保底，避免整段历史被裁光 */
const MIN_HISTORY_BUDGET = 4096;
/** 结构开销等无法精确估算的安全余量（token） */
const SAFETY_MARGIN = 1024;

const CJK_RE = /[⺀-鿿豈-﫿＀-￯]/;

/**
 * 粗略 token 估算：CJK 字符约 1 token/字，其余约 4 字符/token。
 * 不调用模型 getNumTokens（部分实现会走远端 API），只做本地估算。
 */
export const estimateTokens = (text: string): number => {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (CJK_RE.test(ch)) cjk += 1;
    else other += 1;
  }
  return cjk + Math.ceil(other / 4);
};

const messageText = (m: BaseMessage): string =>
  typeof m.content === 'string' ? m.content : JSON.stringify(m.content);

/** 估算一组消息的 token 数：正文 + 工具调用参数 + 每条 4 token 的结构开销 */
export const estimateMessageTokens = (messages: BaseMessage[]): number =>
  messages.reduce((sum, m) => {
    const toolCalls = (m as AIMessage).tool_calls;
    const toolText = toolCalls?.length ? JSON.stringify(toolCalls) : '';
    return sum + estimateTokens(messageText(m) + toolText) + 4;
  }, 0);

/**
 * 将历史消息裁剪到模型上下文预算内（只影响本次模型调用的输入，不改 checkpoint）。
 * 预算 = contextWindowTokens - maxTokens（输出预留）- 系统提示 - 安全余量。
 * strategy 'last' + startOn 'human'：保留最近对话，且保证裁剪后从用户消息开始
 * （不出现孤立的 ToolMessage，也满足 Anthropic 首条必须是 user 的要求）。
 */
export const trimHistoryToFit = async (
  messages: BaseMessage[],
  model: ModelConfig,
  systemPrompt: string
): Promise<BaseMessage[]> => {
  const budget = Math.max(
    model.contextWindowTokens -
      model.maxTokens -
      estimateTokens(systemPrompt) -
      SAFETY_MARGIN,
    MIN_HISTORY_BUDGET
  );
  if (messages.length <= 1 || estimateMessageTokens(messages) <= budget) {
    return messages;
  }
  const trimmed = await trimMessages(messages, {
    maxTokens: budget,
    tokenCounter: estimateMessageTokens,
    strategy: 'last',
    startOn: 'human',
  });
  // 极端情况（最后一条消息本身就超预算）trim 结果为空时，退回只带最后一条，
  // 由模型返回上下文超限错误，而不是静默丢失用户当前输入
  return trimmed.length > 0 ? trimmed : messages.slice(-1);
};
