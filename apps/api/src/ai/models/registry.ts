import { prisma } from '../../config/prisma.js';
import { aiModelRowToConfig, type ModelConfig } from './types.js';

/** 进程内全量模型缓存（数据库为准；CRUD 后失效） */
let modelCache: ModelConfig[] | null = null;

/** 使模型缓存失效，下次读取时重新从数据库加载 */
export const invalidateModelCache = (): void => {
  modelCache = null;
};

const loadModels = async (): Promise<ModelConfig[]> => {
  if (!modelCache) {
    const rows = await prisma.aiModel.findMany({
      orderBy: { createdAt: 'asc' },
    });
    modelCache = rows.map(aiModelRowToConfig);
  }
  return modelCache;
};

/** 全部模型（含禁用），供管理接口使用 */
export const listModels = (): Promise<ModelConfig[]> => loadModels();

export const findModel = async (id: string): Promise<ModelConfig | undefined> =>
  (await loadModels()).find((m) => m.id === id);

/** 仅在模型存在且已启用时返回，fallback 链与组织默认模型都应使用它 */
export const findEnabledModel = async (
  id: string
): Promise<ModelConfig | undefined> => {
  const model = await findModel(id);
  return model?.enabled ? model : undefined;
};

export const listEnabledModels = async (): Promise<ModelConfig[]> =>
  (await loadModels()).filter((m) => m.enabled);

export const resolveDefaultModel = async (): Promise<ModelConfig> => {
  const enabled = await listEnabledModels();
  if (enabled.length === 0) {
    throw new Error('AI 未配置：请先在模型管理中配置至少一个已启用模型');
  }
  return enabled[0];
};

/** 是否启用了 AI（至少存在一个已启用模型） */
export const isAiEnabled = async (): Promise<boolean> =>
  (await listEnabledModels()).length > 0;
