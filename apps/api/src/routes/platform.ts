import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';

export const platformRouter = Router();

platformRouter.get(
  '/info',
  asyncHandler(async (_req, res) => {
    const [platformSetting, smsSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'platform_info' } }),
      prisma.systemSetting.findUnique({ where: { key: 'sms_config' } }),
    ]);
    const defaults = { name: 'Tenant Hub', logoUrl: '', contactPhone: '' };
    const value =
      (platformSetting?.value as Record<string, string> | undefined) ?? {};
    const smsValue = smsSetting?.value as Record<string, unknown> | undefined;
    ok(res, {
      name: value.name || defaults.name,
      logoUrl: value.logoUrl || defaults.logoUrl,
      contactPhone: value.contactPhone || defaults.contactPhone,
      smsConfigured: Boolean(smsValue?.enabled && smsValue?.url),
    });
  })
);
