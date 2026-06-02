import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';

export const permissionRouter = Router();
permissionRouter.use(requireAuth);

permissionRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    ok(res, PERMISSIONS);
  })
);
