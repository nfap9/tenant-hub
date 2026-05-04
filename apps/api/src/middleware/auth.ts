import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env, platformAdminPhones } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http.js";

export type AuthUser = {
  id: string;
  phone: string;
  username: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      organizationId?: string;
      permissions?: string[];
    }
  }
}

export const signToken = (user: AuthUser) =>
  jwt.sign(user, env.JWT_SECRET, { expiresIn: "7d" });

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "请先登录");

  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    next();
  } catch {
    throw new HttpError(401, "登录已过期");
  }
};

export const requireOrg = (req: Request, _res: Response, next: NextFunction) => {
  Promise.resolve()
    .then(async () => {
      if (!req.user) throw new HttpError(401, "请先登录");
      const organizationId = req.header("x-organization-id") || req.params.organizationId;
      if (!organizationId) throw new HttpError(400, "缺少组织");

      const member = await prisma.orgMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: req.user.id } },
        include: { role: true }
      });
      if (!member || member.status !== "ACTIVE") throw new HttpError(403, "无组织访问权限");

      req.organizationId = organizationId;
      req.permissions = member.role.permissions;
      next();
    })
    .catch(next);
};

export const requirePermission =
  (permission: string) => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.permissions?.includes("*") && !req.permissions?.includes(permission)) {
      throw new HttpError(403, "无操作权限");
    }
    next();
  };

export const requirePlatformAccess = (req: Request, _res: Response, next: NextFunction) => {
  Promise.resolve()
    .then(async () => {
      if (!req.user) throw new HttpError(401, "请先登录");
      if (platformAdminPhones.includes(req.user.phone)) return next();

      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { platformRole: true } });
      if (!user) throw new HttpError(403, "无运营平台权限");
      if (user.platformRole === "NONE") {
        const platformAdminCount = await prisma.user.count({ where: { platformRole: { not: "NONE" } } });
        if (platformAdminCount === 0) return next();
        throw new HttpError(403, "无运营平台权限");
      }
      next();
    })
    .catch(next);
};
