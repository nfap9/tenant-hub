import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatMessage,
  ChatRequest,
  ChatResult,
  ModelProvider,
  ToolCall,
} from '../types.js';

const SYSTEM_CACHE_THRESHOLD = 1024;

export class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic';
  readonly capabilities = {
    streaming: true,
    toolUse: true,
    promptCache: true,
  };

  private client: Anthropic;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const systemMessage = req.messages.find((m) => m.role === 'system');
    const turns = req.messages.filter((m) => m.role !== 'system');

    const systemParts: Anthropic.TextBlockParam[] = [];
    if (systemMessage) {
      systemParts.push({
        type: 'text',
        text: systemMessage.content,
        ...(systemMessage.content.length > SYSTEM_CACHE_THRESHOLD
          ? { cache_control: { type: 'ephemeral' } }
          : {}),
      });
    }

    const response = await this.client.messages.create(
      {
        model: req.model,
        max_tokens: req.maxTokens ?? 2048,
        temperature: req.temperature ?? 0.3,
        system: systemParts.length ? systemParts : undefined,
        messages: this.toAnthropicMessages(turns),
        tools: req.tools.length
          ? req.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.parameters as Anthropic.Tool.InputSchema,
            }))
          : undefined,
      },
      { signal: req.signal }
    );

    let text = '';
    const toolCalls: ToolCall[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input ?? {}) as Record<string, unknown>,
        });
      }
    }

    const finishReason =
      response.stop_reason === 'tool_use'
        ? 'tool_use'
        : response.stop_reason === 'max_tokens'
          ? 'length'
          : 'stop';

    return {
      content: text,
      toolCalls,
      finishReason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: (
          response.usage as Anthropic.Messages.Usage & {
            cache_read_input_tokens?: number;
          }
        ).cache_read_input_tokens,
        cacheWriteTokens: (
          response.usage as Anthropic.Messages.Usage & {
            cache_creation_input_tokens?: number;
          }
        ).cache_creation_input_tokens,
      },
      raw: response,
    };
  }

  private toAnthropicMessages(turns: ChatMessage[]): Anthropic.MessageParam[] {
    return turns.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId ?? '',
              content: m.content,
            },
          ],
        };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant',
          content: [
            ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
            ...m.toolCalls.map((tc) => ({
              type: 'tool_use' as const,
              id: tc.id,
              name: tc.name,
              input: tc.arguments as unknown as Record<string, unknown>,
            })),
          ],
        };
      }
      return { role: m.role, content: m.content };
    });
  }
}
