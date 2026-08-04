import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BindToolsInput } from '@langchain/core/language_models/chat_models';
import type { Runnable } from '@langchain/core/runnables';
import type { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { HttpError } from '../../utils/http.js';
import type { ModelConfig } from '../models/types.js';
import { findEnabledModel, resolveDefaultModel } from '../models/registry.js';

const cache = new Map<string, BaseChatModel>();

const resolveApiKey = (cfg: ModelConfig): string => {
  if (!cfg.apiKey) {
    throw new HttpError(
      500,
      `模型 ${cfg.id} 缺少 API 密钥：请在模型管理页面为该模型配置 apiKey`
    );
  }
  return cfg.apiKey;
};

/** 按模型配置构建 LangChain ChatModel，按 id + 更新时间缓存（模型更新后旧实例自然失效） */
export const buildChatModel = (cfg: ModelConfig): BaseChatModel => {
  const cacheKey = `${cfg.id}:${cfg.updatedAt ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = resolveApiKey(cfg);
  const authHeader =
    cfg.authHeader ??
    (cfg.provider === 'anthropic' ? 'x-api-key' : 'Authorization');

  let model: BaseChatModel;
  switch (cfg.provider) {
    case 'anthropic':
      model = new ChatAnthropic({
        model: cfg.providerModel,
        apiKey,
        anthropicApiUrl: cfg.baseURL,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        // 非默认认证头（默认 x-api-key）通过 clientOptions 透传
        clientOptions:
          authHeader !== 'x-api-key'
            ? { defaultHeaders: { [authHeader]: apiKey } }
            : undefined,
      });
      break;
    case 'openai':
    case 'openai-compat':
      model = new ChatOpenAI({
        model: cfg.providerModel,
        apiKey,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        configuration: {
          baseURL: cfg.baseURL,
          // 非默认认证头（默认 Authorization）通过 configuration 透传
          defaultHeaders:
            authHeader !== 'Authorization'
              ? { [authHeader]: apiKey }
              : undefined,
        },
        // openai-compat 供应商普遍未实现 Responses API，强制走 Chat Completions
        useResponsesApi: cfg.provider === 'openai' ? undefined : false,
      });
      break;
    default:
      throw new HttpError(500, `未知 Provider：${cfg.provider}`);
  }
  cache.set(cacheKey, model);
  return model;
};

/**
 * 解析主模型 + fallback 链（只在已启用模型中解析）。
 */
export const resolveModelChain = async (
  modelId?: string
): Promise<ModelConfig[]> => {
  const requested = modelId ? await findEnabledModel(modelId) : undefined;
  const primary = requested ?? (await resolveDefaultModel());
  const chain = [primary];
  for (const id of primary.fallbackTo ?? []) {
    const m = await findEnabledModel(id);
    if (m && !chain.includes(m)) chain.push(m);
  }
  return chain;
};

export interface ModelChain {
  runnable: Runnable<BaseMessage[], AIMessageChunk>;
  /** 主模型配置；fallback 生效时的实际模型记账简化为按 primary 记 */
  primary: ModelConfig;
}

/**
 * 构建模型 fallback 链：先对各模型 bindTools，再用 withFallbacks 串联。
 * （withFallbacks 返回的 Runnable 没有 bindTools，必须在串联前绑定。）
 */
export const buildModelChain = async (
  modelId: string | undefined,
  tools: BindToolsInput[]
): Promise<ModelChain> => {
  const chain = await resolveModelChain(modelId);
  const primary = chain[0];
  const bound = chain.map((cfg) => {
    const model = buildChatModel(cfg);
    if (!model.bindTools) {
      throw new HttpError(500, `模型 ${cfg.id} 不支持工具调用`);
    }
    return model.bindTools(tools);
  });
  const runnable =
    bound.length > 1
      ? bound[0].withFallbacks({ fallbacks: bound.slice(1) })
      : bound[0];
  return { runnable, primary };
};
