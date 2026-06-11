import { Router } from 'express';
import { z } from 'zod';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { runAgent, type StreamChunk } from '../agent/index.js';
import type { ChatMessage } from '../agent/types.js';
import {
  listConversations,
  getConversationWithMessages,
  createConversation,
  updateConversation,
  deleteConversation,
  saveMessages,
} from '../services/conversation.js';

export const agentRouter = Router();
agentRouter.use(requireAuth, requireOrg);

// Agent 需要至少具备一个查看权限才能使用
agentRouter.use(requirePermission(PERMISSIONS.APARTMENT_VIEW));

const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant', 'tool']),
        content: z.string(),
        name: z.string().optional(),
        tool_call_id: z.string().optional(),
      })
    )
    .max(20)
    .default([]),
  conversationId: z.string().optional(),
});

agentRouter.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const input = chatRequestSchema.parse(req.body);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const ctx = {
      organizationId: req.organizationId!,
      userId: req.user!.id,
      userName: req.user!.username,
      permissions: req.permissions ?? [],
    };

    function sendChunk(chunk: StreamChunk) {
      res.write(`event: ${chunk.type}\n`);
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    try {
      const stream = runAgent(
        input.message,
        input.history as ChatMessage[],
        ctx
      );

      for await (const chunk of stream) {
        sendChunk(chunk);
        if (chunk.type === 'done' || chunk.type === 'error') {
          break;
        }
      }
    } catch (error) {
      sendChunk({
        type: 'error',
        content:
          error instanceof Error ? error.message : '智能助手发生内部错误',
      });
    } finally {
      res.end();
    }
  })
);

// --- 会话管理 RESTful API ---

const listQuerySchema = z.object({
  archived: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  limit: z
    .string()
    .transform((v) => {
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? 20 : Math.min(Math.max(n, 1), 50);
    })
    .optional(),
  cursor: z.string().optional(),
});

// GET /api/agent/conversations
agentRouter.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const result = await listConversations(req.user!.id, req.organizationId!, {
      archived: query.archived,
      limit: query.limit,
      cursor: query.cursor,
    });
    res.json({ data: result });
  })
);

// GET /api/agent/conversations/:id
agentRouter.get(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const conversation = await getConversationWithMessages(
      req.params.id,
      req.user!.id,
      req.organizationId!
    );
    res.json({ data: conversation });
  })
);

const createSchema = z.object({
  title: z.string().min(1).max(200),
});

// POST /api/agent/conversations
agentRouter.post(
  '/conversations',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const conversation = await createConversation({
      userId: req.user!.id,
      organizationId: req.organizationId!,
      title: input.title,
    });
    res.status(201).json({ data: conversation });
  })
);

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  archived: z.boolean().optional(),
});

// PATCH /api/agent/conversations/:id
agentRouter.patch(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const conversation = await updateConversation(
      req.params.id,
      req.user!.id,
      req.organizationId!,
      input
    );
    res.json({ data: conversation });
  })
);

// DELETE /api/agent/conversations/:id
agentRouter.delete(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    await deleteConversation(req.params.id, req.user!.id, req.organizationId!);
    res.status(204).send();
  })
);

const saveMessagesSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.string(),
      content: z.string(),
      chartData: z.any().optional(),
      thinking: z.array(z.string()).optional(),
    })
  ),
});

// POST /api/agent/conversations/:id/messages
agentRouter.post(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const input = saveMessagesSchema.parse(req.body);
    await saveMessages(
      req.params.id,
      req.user!.id,
      req.organizationId!,
      input.messages
    );
    res.status(204).send();
  })
);
