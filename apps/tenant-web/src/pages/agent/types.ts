import type { SavedMessage, ChartConfig } from '@/api/agent';

export interface DisplayMessage extends SavedMessage {
  loading?: boolean;
  /** 处理过程中的状态文本，仅 assistant 消息使用 */
  statusText?: string;
}

export interface LocalConversation {
  id: string;
  serverId?: string;
  title: string;
  updatedAt: number;
  messages: DisplayMessage[];
  loading?: boolean;
}

export type { ChartConfig };
