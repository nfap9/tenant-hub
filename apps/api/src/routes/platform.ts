import { Router } from 'express';
import { prisma } from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';

export const platformRouter = Router();

platformRouter.get(
  '/info',
  asyncHandler(async (_req, res) => {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'platform_info' },
    });
    const defaults = { name: 'Tenant Hub', logoUrl: '', contactPhone: '' };
    const value = (setting?.value as Record<string, string> | undefined) ?? {};
    ok(res, {
      name: value.name || defaults.name,
      logoUrl: value.logoUrl || defaults.logoUrl,
      contactPhone: value.contactPhone || defaults.contactPhone,
    });
  })
);
