import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';
import {
  getSystemPermissions,
  isSystemAdmin,
} from '../services/systemRoles.js';

export type AuthUser = {
  id: string;
  phone: string;
  username: string;
  systemRole: import('@prisma/client').SystemRole | null;
};

/**
 * 为用户信息签发 JWT
 * @param user - 用户信息（id、phone、username、systemRole）
 * @returns JWT 字符串
 */
export const signToken = (user: AuthUser) =>
  jwt.sign(user, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as StringValue,
  });

/**
 * 判断 JWT 签发时间是否早于密码修改时间
 * @param issuedAt - JWT 签发时间
 * @param passwordChangedAt - 密码最后修改时间
 * @returns 若 token 在改密前签发则返回 true
 */
export const isTokenStaleForPasswordChange = (
  issuedAt: Date | undefined,
  passwordChangedAt: Date | null
) => {
  if (!issuedAt || !passwordChangedAt) return false;
  return issuedAt.getTime() + 1000 < passwordChangedAt.getTime();
};

const isJwtError = (error: unknown) =>
  error instanceof Error &&
  ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(
    error.name
  );

/**
 * 校验请求头中的 JWT，将当前用户（含系统角色）挂载到 req.user，
 * 并将系统权限挂载到 req.systemPermissions
 * @param req - Express 请求对象
 * @param _res - Express 响应对象
 * @param next - Express 下一个中间件函数
 */
export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, '请先登录');

  Promise.resolve()
    .then(async () => {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser &
        JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          phone: true,
          username: true,
          passwordChangedAt: true,
          systemRole: true,
        },
      });
      if (!user) throw new HttpError(401, '登录已过期');
      const issuedAt = payload.iat ? new Date(payload.iat * 1000) : undefined;
      if (isTokenStaleForPasswordChange(issuedAt, user.passwordChangedAt))
        throw new HttpError(401, '登录已过期');
      req.user = {
        id: user.id,
        phone: user.phone,
        username: user.username,
        systemRole: user.systemRole,
      };
      req.systemPermissions = getSystemPermissions(user.systemRole);
      next();
    })
    .catch((error) => {
      if (error instanceof HttpError || isJwtError(error)) {
        next(new HttpError(401, '登录已过期'));
        return;
      }
      next(error);
    });
};

/**
 * 校验当前用户是否属于指定组织，并将 organizationId 和权限挂载到请求对象。
 * 系统管理员（system:*）可跳过成员检查，自动获得全部组织权限。
 * @param req - Express 请求对象
 * @param _res - Express 响应对象
 * @param next - Express 下一个中间件函数
 */
export const requireOrg = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  Promise.resolve()
    .then(async () => {
      if (!req.user) throw new HttpError(401, '请先登录');
      const organizationId =
        req.header('x-organization-id') || req.params.organizationId;
      if (!organizationId) throw new HttpError(400, '缺少组织');

      // 系统管理员跳过成员检查，拥有全部组织权限
      if (isSystemAdmin(req.user.systemRole)) {
        req.organizationId = organizationId;
        req.permissions = ['*'];
        next();
        return;
      }

      const member = await prisma.orgMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: req.user.id },
        },
        include: { role: true },
      });
      if (!member || member.status !== 'ACTIVE')
        throw new HttpError(403, '无组织访问权限');

      req.organizationId = organizationId;
      req.permissions = member.role.permissions;
      next();
    })
    .catch(next);
};

/**
 * 校验当前用户是否拥有指定组织权限。
 * 系统管理员（system:*）自动通过所有组织权限检查。
 * @param permission - 需要校验的权限字符串
 * @returns Express 中间件函数
 */
export const requirePermission =
  (permission: string) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (isSystemAdmin(req.user?.systemRole)) {
      next();
      return;
    }
    if (
      !req.permissions?.includes('*') &&
      !req.permissions?.includes(permission)
    ) {
      throw new HttpError(403, '无操作权限');
    }
    next();
  };

/**
 * 校验当前用户是否拥有指定系统权限。
 * @param permission - 需要校验的系统权限字符串
 * @returns Express 中间件函数
 */
export const requireSystemPermission =
  (permission: string) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (
      !req.systemPermissions?.includes('system:*') &&
      !req.systemPermissions?.includes(permission)
    ) {
      throw new HttpError(403, '无系统操作权限');
    }
    next();
  };
