import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../prisma/client.js';
import { sendSms, type SmsConfig } from '../services/smsService.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';

export const authRouter = Router();

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确');
const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .regex(/[a-zA-Z]/, '密码必须包含字母')
  .regex(/\d/, '密码必须包含数字');

const verifyOtp = async (
  phone: string,
  code: string,
  purpose: 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD'
) => {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new HttpError(400, '验证码已失效');
  const matched = await bcrypt.compare(code, otp.codeHash);
  if (!matched) throw new HttpError(400, '验证码不正确');
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });
};

authRouter.post(
  '/otp',
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        phone: phoneSchema,
        purpose: z.enum(['REGISTER', 'LOGIN', 'RESET_PASSWORD']),
      })
      .parse(req.body);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.otpCode.create({
      data: {
        phone: input.phone,
        purpose: input.purpose,
        codeHash: await bcrypt.hash(code, env.BCRYPT_OTP_SALT_ROUNDS),
        expiresAt: new Date(
          Date.now() + env.OTP_EXPIRES_IN_MINUTES * 60 * 1000
        ),
      },
    });
    const smsConfig = await prisma.systemSetting.findUnique({
      where: { key: 'sms_config' },
    });
    const parsedConfig = smsConfig?.value
      ? (smsConfig.value as Record<string, unknown>)
      : null;

    if (parsedConfig?.url) {
      const config = {
        url: String(parsedConfig.url),
        method: (parsedConfig.method === 'GET' ||
        parsedConfig.method === 'POST' ||
        parsedConfig.method === 'PUT'
          ? parsedConfig.method
          : 'POST') as SmsConfig['method'],
        headers:
          typeof parsedConfig.headers === 'object' &&
          parsedConfig.headers !== null
            ? (parsedConfig.headers as Record<string, string>)
            : undefined,
        params:
          typeof parsedConfig.params === 'object' &&
          parsedConfig.params !== null
            ? (parsedConfig.params as Record<string, string>)
            : undefined,
      };

      await sendSms({
        targets: input.phone,
        code,
        number: env.OTP_EXPIRES_IN_MINUTES,
        config,
      }).catch((err) => {
        console.error(`[SmsService] 发送验证码失败: ${err.message}`);
      });
    }
    if (env.NODE_ENV !== 'production') {
      console.info(
        `[TenantHub] ${input.phone} ${input.purpose} 验证码：${code}`
      );
    }
    ok(res, { message: '验证码已发送' });
  })
);

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        phone: phoneSchema,
        username: z.string().min(1).max(24),
        password: passwordSchema,
        confirmPassword: passwordSchema,
        code: z.string().length(6),
      })
      .refine(
        (value) => value.password === value.confirmPassword,
        '两次密码不一致'
      )
      .parse(req.body);

    const existed = await prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (existed) throw new HttpError(409, '手机号已注册');
    await verifyOtp(input.phone, input.code, 'REGISTER');

    const isFirstUser = (await prisma.user.count()) === 0;
    const user = await prisma.user.create({
      data: {
        phone: input.phone,
        username: input.username,
        passwordHash: await bcrypt.hash(
          input.password,
          env.BCRYPT_PASSWORD_SALT_ROUNDS
        ),
        platformRole: isFirstUser ? 'SUPER_ADMIN' : 'USER',
      },
      select: { id: true, phone: true, username: true, platformRole: true },
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
    const user = await prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new HttpError(401, '手机号或密码不正确');
    }
    const payload = { id: user.id, phone: user.phone, username: user.username };
    ok(res, { user: payload, token: signToken(payload) });
  })
);

authRouter.post(
  '/login/otp',
  asyncHandler(async (req, res) => {
    const input = z
      .object({ phone: phoneSchema, code: z.string().length(6) })
      .parse(req.body);
    const user = await prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (!user) throw new HttpError(404, '用户不存在');
    await verifyOtp(input.phone, input.code, 'LOGIN');
    const payload = { id: user.id, phone: user.phone, username: user.username };
    ok(res, { user: payload, token: signToken(payload) });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { id: true, phone: true, username: true, platformRole: true },
    });
    const memberships = await prisma.orgMember.findMany({
      where: { userId: req.user!.id, status: 'ACTIVE' },
      include: { organization: true, role: true },
    });
    ok(res, { user, memberships });
  })
);

authRouter.put(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = z
      .object({ username: z.string().min(1).max(24) })
      .parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { username: input.username },
      select: { id: true, phone: true, username: true, platformRole: true },
    });
    ok(res, user);
  })
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (_req, res) => {
    ok(res, { message: '已退出登录' });
  })
);

authRouter.post(
  '/refresh',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { id: true, phone: true, username: true },
    });
    ok(res, {
      user,
      token: signToken(user),
    });
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

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
    });
    const matched = await bcrypt.compare(
      input.currentPassword,
      user.passwordHash
    );
    if (!matched) throw new HttpError(400, '当前密码不正确');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(
          input.newPassword,
          env.BCRYPT_PASSWORD_SALT_ROUNDS
        ),
        passwordChangedAt: new Date(),
      },
    });

    ok(res, { message: '密码已更新' });
  })
);

authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        phone: phoneSchema,
        code: z.string().length(6),
        password: passwordSchema,
        confirmPassword: passwordSchema,
      })
      .refine(
        (value) => value.password === value.confirmPassword,
        '两次密码不一致'
      )
      .parse(req.body);

    const user = await prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (!user) throw new HttpError(404, '用户不存在');

    await verifyOtp(input.phone, input.code, 'RESET_PASSWORD');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(
          input.password,
          env.BCRYPT_PASSWORD_SALT_ROUNDS
        ),
        passwordChangedAt: new Date(),
      },
    });

    ok(res, { message: '密码重置成功' });
  })
);
