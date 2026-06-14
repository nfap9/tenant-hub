import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ChatMessage } from '../types.js';

export function mapChatMessagesToBaseMessages(
  history: ChatMessage[]
): BaseMessage[] {
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
