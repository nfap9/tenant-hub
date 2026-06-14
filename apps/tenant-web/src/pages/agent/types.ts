import type { SavedMessage, ChartConfig } from '@/api/agent';

export interface DisplayMessage extends SavedMessage {
  loading?: boolean;
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
