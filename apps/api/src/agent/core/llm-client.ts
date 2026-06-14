import { ChatOpenAI } from '@langchain/openai';
import { env } from '../../config/env.js';

export function createLlmClient(): ChatOpenAI {
  if (!env.LLM_API_KEY) {
    throw new Error('LLM_API_KEY is not configured');
  }

  return new ChatOpenAI({
    modelName: env.LLM_MODEL,
    temperature: env.LLM_TEMPERATURE,
    maxTokens: env.LLM_MAX_TOKENS,
    apiKey: env.LLM_API_KEY,
    ...(env.LLM_BASE_URL
      ? { configuration: { baseURL: env.LLM_BASE_URL } }
      : {}),
  });
}
