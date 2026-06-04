import { Router } from 'express';
import { z } from 'zod';
import { sendSms, type SmsConfig } from '../services/smsService.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import {
  getSmsConfigured,
  getSmsConfig,
  createOtpCode,
  verifyOtpCode,
  findUserByPhone,
  isFirstUser,
  createUser,
  verifyPassword,
  updateUserPassword,
  getUserWithMemberships,
} from '../services/auth.js';

export const authRouter = Router();

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确');
const passwordSchema = z.string().min(8, '密码至少 8 位');

authRouter.post(
  '/otp',
  asyncHandler(async (req, res) => {
    const smsConfigured = await getSmsConfigured();
    if (!smsConfigured) {
      throw new HttpError(400, '短信服务未配置，暂不支持验证码功能');
    }
    const input = z
      .object({ phone: phoneSchema, purpose: z.enum(['REGISTER', 'LOGIN']) })
      .parse(req.body);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await createOtpCode({ phone: input.phone, purpose: input.purpose, code });

    const config = await getSmsConfig();
    if (config?.url) {
      await sendSms({
        phoneNumber: input.phone,
        code,
        expireMinutes: 5,
        config: config as SmsConfig,
      }).catch((err) => {
        console.error(`[SmsService] 发送验证码失败: ${err.message}`);
      });
    }
    ok(res, { message: '验证码已发送' });
  })
);

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const smsConfigured = await getSmsConfigured();
    const input = z
      .object({
        phone: phoneSchema,
        username: z.string().min(1).max(24),
        password: passwordSchema,
        confirmPassword: passwordSchema,
        code: smsConfigured ? z.string().length(6) : z.string().optional(),
      })
      .refine(
        (value) => value.password === value.confirmPassword,
        '两次密码不一致'
      )
      .parse(req.body);

    const existed = await findUserByPhone(input.phone);
    if (existed) throw new HttpError(409, '手机号已注册');
    if (smsConfigured) {
      await verifyOtpCode(input.phone, input.code!, 'REGISTER');
    }

    const firstUser = await isFirstUser();
    const user = await createUser({
      phone: input.phone,
      username: input.username,
      password: input.password,
      platformRole: firstUser ? 'SUPER_ADMIN' : 'USER',
    });
    ok(res, { user, token: signToken(user) });
  })
);

authRouter.post(
  '/login/password',
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

authRouter.post(
  '/login/otp',
  asyncHandler(async (req, res) => {
    const smsConfigured = await getSmsConfigured();
    if (!smsConfigured) {
      throw new HttpError(400, '短信服务未配置，暂不支持验证码登录');
    }
    const input = z
      .object({ phone: phoneSchema, code: z.string().length(6) })
      .parse(req.body);
    const user = await findUserByPhone(input.phone);
    if (!user) throw new HttpError(404, '用户不存在');
    await verifyOtpCode(input.phone, input.code, 'LOGIN');
    const payload = { id: user.id, phone: user.phone, username: user.username };
    ok(res, { user: payload, token: signToken(payload) });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, await getUserWithMemberships(req.user!.id));
  })
);

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
