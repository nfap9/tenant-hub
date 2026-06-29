import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, signToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import {
  findUserByPhone,
  createUser,
  verifyPassword,
  updateUserPassword,
  getUserWithMemberships,
} from '../services/auth.js';

export const authRouter = Router();

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确');
const passwordSchema = z.string().min(8, '密码至少 8 位');

/**
 * POST /api/auth/register
 * 用户注册：校验手机号、用户名和密码，创建用户并返回登录 token
 */
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        phone: phoneSchema,
        username: z.string().min(1).max(24),
        password: passwordSchema,
        confirmPassword: passwordSchema,
      })
      .refine(
        (value) => value.password === value.confirmPassword,
        '两次密码不一致'
      )
      .parse(req.body);

    const existed = await findUserByPhone(input.phone);
    if (existed) throw new HttpError(409, '手机号已注册');

    const user = await createUser({
      phone: input.phone,
      username: input.username,
      password: input.password,
    });
    ok(res, { user, token: signToken(user) });
  })
);

/**
 * POST /api/auth/login
 * 用户登录：校验手机号和密码，返回用户信息及 JWT
 */
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = z
      .object({ phone: phoneSchema, password: z.string().min(1) })
      .parse(req.body);
    const user = await findUserByPhone(input.phone);
    if (!user) throw new HttpError(401, '手机号或密码不正确');
    const { matched } = await verifyPassword(user.id, input.password);
    if (!matched) throw new HttpError(401, '手机号或密码不正确');
    const payload = { id: user.id, phone: user.phone, username: user.username };
    ok(res, { user: payload, token: signToken(payload) });
  })
);

/**
 * GET /api/auth/me
 * 获取当前登录用户信息及其所属组织列表
 */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, await getUserWithMemberships(req.user!.id));
  })
);

/**
 * PUT /api/auth/password
 * 修改当前登录用户密码
 */
authRouter.put(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        currentPassword: z.string().min(1, '请输入当前密码'),
        newPassword: passwordSchema,
        confirmPassword: passwordSchema,
      })
      .refine(
        (value) => value.newPassword === value.confirmPassword,
        '两次密码不一致'
      )
      .parse(req.body);

    if (input.currentPassword === input.newPassword) {
      throw new HttpError(400, '新密码不能与当前密码相同');
    }

    const { matched } = await verifyPassword(
      req.user!.id,
      input.currentPassword
    );
    if (!matched) throw new HttpError(400, '当前密码不正确');

    await updateUserPassword(req.user!.id, input.newPassword);

    ok(res, { message: '密码已更新' });
  })
);
