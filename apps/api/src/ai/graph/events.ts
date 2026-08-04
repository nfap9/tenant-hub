import {
  AIMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { ToolPreview } from '../tools/index.js';

export interface AgentContext {
  organizationId: string;
  userId: string;
  permissions: string[];
  orgName: string;
  username: string;
  roleName: string;
}

/** 序列化后的会话消息，供 SSE message 事件与会话状态接口使用 */
export type SerializedMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  /** role=tool 时对应的工具调用 id */
  toolCallId?: string;
  /** role=tool 时的工具名 */
  name?: string;
};

/** 写操作待确认载荷（interrupt 事件与 graph state 中的 interrupt value） */
export type PendingActionPayload = {
  id: string;
  conversationId: string;
  toolCallId: string;
  toolName: string;
  summary: ToolPreview;
  expiresAt: string;
};

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'message'; message: SerializedMessage }
  | { type: 'tool_call'; name: string; summary: string }
  | { type: 'interrupt'; action: PendingActionPayload }
  | { type: 'error'; message: string }
  | { type: 'done' };

/** 提取消息文本内容（AIMessage 的 content 可能是数组，取 text 部分拼接） */
export const messageContentToText = (
  content: BaseMessage['content']
): string => {
  if (typeof content === 'string') return content;
  return content
    .map((block) =>
      typeof block === 'string'
        ? block
        : block.type === 'text'
          ? (block.text ?? '')
          : ''
    )
    .join('');
};

export const serializeMessage = (m: BaseMessage): SerializedMessage => {
  const base: SerializedMessage = {
    id: m.id ?? '',
    role: 'assistant',
    content: messageContentToText(m.content),
  };
  if (m instanceof AIMessage) {
    base.role = 'assistant';
    if (m.tool_calls?.length) {
      base.toolCalls = m.tool_calls.map((c) => ({
        id: c.id ?? '',
        name: c.name,
        args: c.args as Record<string, unknown>,
      }));
    }
    return base;
  }
  if (m instanceof ToolMessage) {
    base.role = 'tool';
    base.toolCallId = m.tool_call_id;
    base.name = m.name;
    return base;
  }
  base.role = 'user';
  return base;
};
