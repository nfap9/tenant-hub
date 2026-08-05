import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireOrg } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/aiRateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import { prisma } from '../config/prisma.js';
import { isAiEnabled, listEnabledModels } from '../ai/models/registry.js';
import { runGraphChat, runGraphResume } from '../ai/graph/stream.js';
import { getConversationState } from '../ai/graph/state.js';
import type { AgentContext, AgentEvent } from '../ai/graph/events.js';
import {
  archiveConversation,
  createConversation,
  ensureConversationOwnership,
  listConversations,
} from '../ai/storage/conversations.js';

export const aiRouter = Router();

aiRouter.use(
  asyncHandler(async (_req, _res, next) => {
    if (!(await isAiEnabled())) throw new HttpError(503, 'AI 功能未启用');
    next();
  })
);

aiRouter.use(requireAuth, requireOrg, asyncHandler(aiRateLimiter));

/** 组装 agent 运行上下文（组织/用户/权限/系统提示用的展示信息） */
const buildAgentContext = async (req: Request): Promise<AgentContext> => {
  const membership = await prisma.orgMember.findFirst({
    where: { organizationId: req.organizationId!, userId: req.user!.id },
    include: { role: true, organization: true },
  });
  return {
    organizationId: req.organizationId!,
    userId: req.user!.id,
    permissions: req.permissions ?? [],
    orgName: membership?.organization.name ?? '',
    username: req.user!.username,
    roleName: membership?.role.name ?? '',
  };
};

/** 初始化 SSE 响应；返回事件发送函数，连接关闭时自动 abort */
const initSse = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const send = (event: AgentEvent) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  return { send, signal: controller.signal };
};

/**
 * GET /api/ai/models
 * 返回已启用的模型列表，供前端选择器使用
 */
aiRouter.get(
  '/models',
  asyncHandler(async (_req, res) => {
    const models = await listEnabledModels();
    ok(
      res,
      models.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        tags: m.tags,
      }))
    );
  })
);

/**
 * POST /api/ai/conversations
 * 创建新会话
 */
aiRouter.post(
  '/conversations',
  asyncHandler(async (req, res) => {
    const input = z
      .object({ modelId: z.string().optional() })
      .parse(req.body ?? {});
    const conv = await createConversation({
      organizationId: req.organizationId!,
      userId: req.user!.id,
      modelId: input.modelId,
    });
    ok(res, conv);
  })
);

/**
 * GET /api/ai/conversations
 * 列出我的会话
 */
aiRouter.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const list = await listConversations(req.organizationId!, req.user!.id);
    ok(res, list);
  })
);

/**
 * GET /api/ai/conversations/:id/state
 * 取会话完整状态：消息历史 + 待处理 interrupt + 待确认操作审计记录
 */
aiRouter.get(
  '/conversations/:id/state',
  asyncHandler(async (req, res) => {
    await ensureConversationOwnership(
      req.params.id,
      req.organizationId!,
      req.user!.id
    );
    ok(res, await getConversationState(req.params.id));
  })
);

/**
 * POST /api/ai/conversations/:id/chat
 * 发送消息并以 SSE 流式返回 Agent 输出
 */
aiRouter.post(
  '/conversations/:id/chat',
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        message: z.string().min(1),
        modelId: z.string().optional(),
      })
      .parse(req.body ?? {});

    const ctx = await buildAgentContext(req);
    const { send, signal } = initSse(req, res);

    await runGraphChat({
      conversationId: req.params.id,
      userMessage: input.message,
      modelId: input.modelId,
      ctx,
      onEvent: send,
      signal,
    });

    res.end();
  })
);

/**
 * POST /api/ai/conversations/:id/resume
 * 用户对待确认操作 approve / reject 后恢复 graph 执行，SSE 流式返回
 */
aiRouter.post(
  '/conversations/:id/resume',
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        actionId: z.string().min(1),
        decision: z.enum(['approve', 'reject']),
      })
      .parse(req.body ?? {});

    const ctx = await buildAgentContext(req);
    const { send, signal } = initSse(req, res);

    await runGraphResume({
      conversationId: req.params.id,
      actionId: input.actionId,
      decision: input.decision,
      ctx,
      onEvent: send,
      signal,
    });

    res.end();
  })
);

/**
 * DELETE /api/ai/conversations/:id
 * 归档会话
 */
aiRouter.delete(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    await archiveConversation(req.params.id, req.organizationId!, req.user!.id);
    ok(res, { archived: true });
  })
);
