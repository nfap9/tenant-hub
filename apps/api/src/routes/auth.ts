import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError, ok } from "../utils/http.js";

export const authRouter = Router();

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确");
const passwordSchema = z.string().min(8, "密码至少 8 位");

const verifyOtp = async (phone: string, code: string, purpose: "REGISTER" | "LOGIN") => {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" }
  });
  if (!otp) throw new HttpError(400, "验证码已失效");
  const matched = await bcrypt.compare(code, otp.codeHash);
  if (!matched) throw new HttpError(400, "验证码不正确");
  await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
};

authRouter.post(
  "/otp",
  asyncHandler(async (req, res) => {
    const input = z.object({ phone: phoneSchema, purpose: z.enum(["REGISTER", "LOGIN"]) }).parse(req.body);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.otpCode.create({
      data: {
        phone: input.phone,
        purpose: input.purpose,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    });
    console.info(`[TenantHub] ${input.phone} ${input.purpose} 验证码：${code}`);
    ok(res, { message: "验证码已发送" });
  })
);

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        phone: phoneSchema,
        username: z.string().min(1).max(24),
        password: passwordSchema,
        confirmPassword: passwordSchema,
        code: z.string().length(6)
      })
      .refine((value) => value.password === value.confirmPassword, "两次密码不一致")
      .parse(req.body);

    const existed = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existed) throw new HttpError(409, "手机号已注册");
    await verifyOtp(input.phone, input.code, "REGISTER");

    const user = await prisma.user.create({
      data: {
        phone: input.phone,
        username: input.username,
        passwordHash: await bcrypt.hash(input.password, 12)
      },
      select: { id: true, phone: true, username: true }
    });
    ok(res, { user, token: signToken(user) });
  })
);

authRouter.post(
  "/login/password",
  asyncHandler(async (req, res) => {
    const input = z.object({ phone: phoneSchema, password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new HttpError(401, "手机号或密码不正确");
    }
    const payload = { id: user.id, phone: user.phone, username: user.username };
    ok(res, { user: payload, token: signToken(payload) });
  })
);

authRouter.post(
  "/login/otp",
  asyncHandler(async (req, res) => {
    const input = z.object({ phone: phoneSchema, code: z.string().length(6) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (!user) throw new HttpError(404, "用户不存在");
    await verifyOtp(input.phone, input.code, "LOGIN");
    const payload = { id: user.id, phone: user.phone, username: user.username };
    ok(res, { user: payload, token: signToken(payload) });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const memberships = await prisma.orgMember.findMany({
      where: { userId: req.user!.id, status: "ACTIVE" },
      include: { organization: true, role: true }
    });
    ok(res, { user: req.user, memberships });
  })
);
