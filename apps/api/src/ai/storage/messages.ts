import type { AiMessage, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type { ChatMessage, ChatRole, ToolCall } from '../llm/types.js';

const HISTORY_MAX_TURNS = 20;

export const listMessages = async (
  conversationId: string
): Promise<AiMessage[]> => {
  // 取最新的 N 条（避免长会话丢掉最近对话），再反转为时间正序
  const messages = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_MAX_TURNS * 2,
  });
  return messages.reverse();
};

export const appendUserMessage = async (
  conversationId: string,
  content: string
): Promise<AiMessage> => {
  const [message] = await prisma.$transaction([
    prisma.aiMessage.create({
      data: { conversationId, role: 'USER', content: content },
    }),
    prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);
  return message;
};

export const appendAssistantMessage = async (
  conversationId: string,
  params: {
    content: string;
    toolCalls?: ToolCall[];
    modelId: string;
    tokensInput?: number;
    tokensOutput?: number;
  }
): Promise<AiMessage> => {
  return prisma.aiMessage.create({
    data: {
      conversationId,
      role: 'ASSISTANT',
      content: params.toolCalls?.length
        ? ({
            text: params.content,
            toolCalls: params.toolCalls,
          } as unknown as Prisma.InputJsonValue)
        : params.content,
      modelId: params.modelId,
      tokensInput: params.tokensInput,
      tokensOutput: params.tokensOutput,
    },
  });
};

export const appendToolMessage = async (
  conversationId: string,
  toolCallId: string,
  content: string
): Promise<AiMessage> => {
  return prisma.aiMessage.create({
    data: {
      conversationId,
      role: 'TOOL',
      content: { toolCallId, content },
    },
  });
};

export const historyToChatMessages = (messages: AiMessage[]): ChatMessage[] => {
  return messages
    .filter((m) => m.role !== 'SYSTEM')
    .map((m): ChatMessage => {
      if (m.role === 'ASSISTANT' && typeof m.content === 'object') {
        const obj = m.content as { text?: string; toolCalls?: ToolCall[] };
        return {
          role: 'assistant',
          content: obj.text ?? '',
          toolCalls: obj.toolCalls,
        };
      }
      if (m.role === 'TOOL' && typeof m.content === 'object') {
        const obj = m.content as { toolCallId?: string; content?: string };
        return {
          role: 'tool',
          content: obj.content ?? '',
          toolCallId: obj.toolCallId,
        };
      }
      const content =
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return {
        role: m.role.toLowerCase() as ChatRole,
        content,
      };
    });
};
