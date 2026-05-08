import { customAlphabet } from "nanoid";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";

const inviteCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);

type JoinableInvite = {
  expiresAt: Date;
  usedCount: number;
  maxUses: number;
  organization: { status: string };
};

export const normalizeInviteCode = (value: string) => value.trim().replace(/[\s-]+/g, "").toUpperCase();

export const generateInviteCode = () => inviteCode();

export const buildInviteExpiry = (now = new Date(), expiresInHours = env.INVITE_EXPIRES_IN_HOURS) =>
  new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

export const assertInviteJoinable = ({ invite, now = new Date() }: { invite: JoinableInvite; now?: Date }) => {
  if (invite.organization.status !== "ACTIVE") throw new HttpError(403, "组织不可加入");
  if (invite.expiresAt <= now) throw new HttpError(400, "邀请码已过期");
  if (invite.usedCount >= invite.maxUses) throw new HttpError(400, "邀请码已被使用");
};
