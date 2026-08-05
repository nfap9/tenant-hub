import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import type { AiModel } from '@prisma/client';
import { requireAuth, requireOrg } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import { prisma } from '../config/prisma.js';
import { PERMISSIONS } from '../services/roles.js';
import { modelConfigSchema } from '../ai/models/types.js';
import { invalidateModelCache } from '../ai/models/registry.js';

export const aiModelsRouter = Router();

/** 模型管理权限校验（* 或 aiModel:manage） */
const requireModelManage = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (
    !req.permissions?.includes('*') &&
    !req.permissions?.includes(PERMISSIONS.AI_MODEL_MANAGE)
  ) {
    throw new HttpError(403, '无模型管理权限');
  }
  next();
};

aiModelsRouter.use(requireAuth, requireOrg, requireModelManage);

/** 出参脱敏：剥离 apiKey，附加 hasApiKey 标记 */
const toPublicModel = (row: AiModel) => {
  const { apiKey, ...rest } = row;
  void apiKey;
  return { ...rest, hasApiKey: Boolean(row.apiKey) };
};

/**
 * GET /api/ai-models
 * 返回全部模型（含禁用），apiKey 永不回传
 */
aiModelsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.aiModel.findMany({
      orderBy: { createdAt: 'asc' },
    });
    ok(res, rows.map(toPublicModel));
  })
);

/**
 * POST /api/ai-models
 * 创建模型（id 由用户定义，创建后不可改；重复 id 由 P2002 → 409 处理）
 */
aiModelsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = modelConfigSchema.parse(req.body);
    const row = await prisma.aiModel.create({
      data: {
        id: input.id,
        displayName: input.displayName,
        provider: input.provider,
        providerModel: input.providerModel,
        baseURL: input.baseURL,
        apiKey: input.apiKey,
        maxTokens: input.maxTokens,
        contextWindowTokens: input.contextWindowTokens,
        temperature: input.temperature,
        tags: input.tags,
        costPerMtu: input.costPerMtu as Prisma.InputJsonValue | undefined,
        fallbackTo: input.fallbackTo ?? [],
        authHeader: input.authHeader,
        enabled: input.enabled,
      },
    });
    invalidateModelCache();
    ok(res, toPublicModel(row));
  })
);

/**
 * POST /api/ai-models/:id/update
 * 更新模型（不允许改 id；apiKey 不传或为空字符串时保持原值不变）
 */
aiModelsRouter.post(
  '/:id/update',
  asyncHandler(async (req, res) => {
    const input = modelConfigSchema
      .omit({ id: true, updatedAt: true })
      .partial()
      .parse(req.body);
    const data: Prisma.AiModelUpdateInput = {
      ...input,
      costPerMtu: input.costPerMtu as Prisma.InputJsonValue | undefined,
    };
    // apiKey 仅在明确传非空值时更新
    if (!input.apiKey) delete data.apiKey;
    const row = await prisma.aiModel.update({
      where: { id: req.params.id },
      data,
    });
    invalidateModelCache();
    ok(res, toPublicModel(row));
  })
);

/**
 * POST /api/ai-models/:id/delete
 * 删除模型；仍被会话或组织默认配置引用时拒绝删除
 */
aiModelsRouter.post(
  '/:id/delete',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const [orgCount, conversationCount] = await Promise.all([
      prisma.organization.count({ where: { aiModelDefault: id } }),
      prisma.aiConversation.count({ where: { modelId: id } }),
    ]);
    if (orgCount > 0 || conversationCount > 0) {
      throw new HttpError(400, '模型仍被会话或组织默认配置引用，无法删除');
    }
    await prisma.aiModel.delete({ where: { id } });
    invalidateModelCache();
    ok(res, { deleted: true });
  })
);
