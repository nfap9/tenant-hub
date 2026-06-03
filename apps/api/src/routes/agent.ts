import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireOrg } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { runAgent, type StreamChunk } from '../agent/index.js';
import type { ChatMessage } from '../agent/types.js';

export const agentRouter = Router();
agentRouter.use(requireAuth, requireOrg);

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
