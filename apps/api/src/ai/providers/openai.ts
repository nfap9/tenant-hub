import OpenAI from 'openai';
import type {
  ChatMessage,
  ChatRequest,
  ChatResult,
  ModelProvider,
  ToolCall,
} from '../types.js';

export class OpenAIProvider implements ModelProvider {
  readonly name: string = 'openai';
  readonly capabilities = {
    streaming: true,
    toolUse: true,
    promptCache: false,
  };

  protected client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const completion = await this.client.chat.completions.create(
      {
        model: req.model,
        temperature: req.temperature ?? 0.3,
        max_tokens: req.maxTokens ?? 2048,
        messages: this.toOpenAIMessages(req.messages),
        tools: req.tools.length
          ? (req.tools.map((t) => ({
              type: 'function' as const,
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              },
            })) as OpenAI.Chat.Completions.ChatCompletionTool[])
          : undefined,
      },
      { signal: req.signal }
    );

    const choice = completion.choices[0];
    const msg = choice?.message;
    const toolCalls: ToolCall[] = [];
    for (const tc of msg?.tool_calls ?? []) {
      if (tc.type !== 'function') continue;
      let args: Record<string, unknown> = {};
      try {
        args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        args = {};
      }
      toolCalls.push({ id: tc.id, name: tc.function.name, arguments: args });
    }

    const finishReason =
      choice?.finish_reason === 'tool_calls'
        ? 'tool_use'
        : choice?.finish_reason === 'length'
          ? 'length'
          : 'stop';

    return {
      content: msg?.content ?? '',
      toolCalls,
      finishReason,
      usage: {
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      },
      raw: completion,
    };
  }

  protected toOpenAIMessages(
    messages: ChatMessage[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId ?? '',
          content: m.content,
        } satisfies OpenAI.Chat.Completions.ChatCompletionToolMessageParam;
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        } satisfies OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
      }
      return {
        role: m.role,
        content: m.content,
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam;
    });
  }
}

export class OpenAICompatProvider extends OpenAIProvider {
  override readonly name = 'openai-compat';
}
