import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireOrg } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/aiRateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import { prisma } from '../config/prisma.js';
import { isAiEnabled } from '../ai/providers/index.js';
import { listEnabledModels } from '../ai/models.config.js';
import { runAgent, type AgentEvent } from '../ai/agent.js';
import {
  confirmPendingAction,
  rejectPendingAction,
} from '../ai/pendingAction.js';
import {
  archiveConversation,
  createConversation,
  ensureConversationOwnership,
  listConversations,
  listMessages,
} from '../ai/storage.js';

export const aiRouter = Router();

aiRouter.use((req, _res, next) => {
  if (!isAiEnabled()) throw new HttpError(503, 'AI 功能未启用');
  next();
});

aiRouter.use(requireAuth, requireOrg, asyncHandler(aiRateLimiter));

/**
 * GET /api/ai/models
 * 返回已启用的模型列表，供前端选择器使用
 */
aiRouter.get('/models', (_req, res) => {
  ok(
    res,
    listEnabledModels().map((m) => ({
      id: m.id,
      displayName: m.displayName,
      tags: m.tags,
    }))
  );
});

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
 * GET /api/ai/conversations/:id/messages
 * 取会话历史消息
 */
aiRouter.get(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    await ensureConversationOwnership(
      req.params.id,
      req.organizationId!,
      req.user!.id
    );
    const messages = await listMessages(req.params.id);
    ok(res, messages);
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

    const conv = await ensureConversationOwnership(
      req.params.id,
      req.organizationId!,
      req.user!.id
    );

    const membership = await prisma.orgMember.findFirst({
      where: { organizationId: req.organizationId!, userId: req.user!.id },
      include: { role: true, organization: true },
    });

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

    await runAgent({
      conversationId: conv.id,
      organizationId: req.organizationId!,
      userId: req.user!.id,
      userMessage: input.message,
      modelId: input.modelId ?? conv.modelId,
      ctx: {
        organizationId: req.organizationId!,
        userId: req.user!.id,
        permissions: req.permissions ?? [],
        orgName: membership?.organization.name ?? '',
        username: req.user!.username,
        roleName: membership?.role.name ?? '',
      },
      onEvent: send,
      signal: controller.signal,
    });

    res.end();
  })
);

/**
 * POST /api/ai/action/confirm
 * 确认并执行一个待确认操作
 */
aiRouter.post(
  '/action/confirm',
  asyncHandler(async (req, res) => {
    const input = z
      .object({ actionId: z.string().min(1) })
      .parse(req.body ?? {});
    const result = await confirmPendingAction({
      actionId: input.actionId,
      organizationId: req.organizationId!,
      userId: req.user!.id,
      permissions: req.permissions ?? [],
    });
    ok(res, result);
  })
);

/**
 * POST /api/ai/action/reject
 * 拒绝一个待确认操作
 */
aiRouter.post(
  '/action/reject',
  asyncHandler(async (req, res) => {
    const input = z
      .object({ actionId: z.string().min(1) })
      .parse(req.body ?? {});
    await rejectPendingAction({
      actionId: input.actionId,
      organizationId: req.organizationId!,
      userId: req.user!.id,
    });
    ok(res, { rejected: true });
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
