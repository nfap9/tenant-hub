import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';

export const roleRouter = Router();
roleRouter.use(requireAuth);

roleRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    ok(
      res,
      await prisma.role.findMany({
        orderBy: [{ system: 'desc' }, { createdAt: 'asc' }],
      })
    );
  })
);

roleRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        code: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        permissions: z.array(z.string()).default([]),
      })
      .parse(req.body);

    const existing = await prisma.role.findUnique({
      where: { code: input.code },
    });
    if (existing) throw new HttpError(409, '角色编码已存在');

    ok(
      res,
      await prisma.role.create({
        data: { ...input, system: false },
      })
    );
  })
);
