import type { ModelConfig } from '../models/types.js';
import { findEnabledModel, resolveDefaultModel } from '../models/registry.js';
import { getProvider } from '../llm/providers/index.js';
import type { ChatRequest, ChatResult } from '../llm/types.js';

/**
 * 解析主模型 + fallback 链。
 * 主模型与 fallback 链都只在已启用模型中解析。
 */
export const resolveModelChain = (modelId?: string): ModelConfig[] => {
  const requested = modelId ? findEnabledModel(modelId) : undefined;
  const primary = requested ?? resolveDefaultModel();
  const chain = [primary];
  for (const id of primary.fallbackTo ?? []) {
    const m = findEnabledModel(id);
    if (m && !chain.includes(m)) chain.push(m);
  }
  return chain;
};

const chatOnce = async (
  model: ModelConfig,
  req: ChatRequest
): Promise<ChatResult> => {
  const provider = getProvider(model);
  return provider.chat({
    ...req,
    model: model.providerModel,
    temperature: req.temperature ?? model.temperature,
    maxTokens: req.maxTokens ?? model.maxTokens,
  });
};

/** 按链依次尝试模型，全部失败时抛出最后一个错误 */
export const chatWithFallback = async (
  chain: ModelConfig[],
  req: ChatRequest
): Promise<{ result: ChatResult; model: ModelConfig }> => {
  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    try {
      const result = await chatOnce(model, req);
      return { result, model };
    } catch (err) {
      lastError = err;
      if (i === chain.length - 1) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('模型调用失败');
};
