import { customAlphabet } from 'nanoid';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';

const inviteCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);

type JoinableInvite = {
  expiresAt: Date;
  usedCount: number;
  maxUses: number;
  organization: { status: string };
};

/**
 * 标准化邀请码，去除首尾空白、所有空格与连字符并转为大写
 * @param value - 原始邀请码字符串
 * @returns 标准化后的邀请码
 */
export const normalizeInviteCode = (value: string) =>
  value
    .trim()
    .replace(/[\s-]+/g, '')
    .toUpperCase();

/**
 * 生成随机邀请码
 * @returns 10 位随机邀请码字符串
 */
export const generateInviteCode = () => inviteCode();

/**
 * 计算邀请码过期时间
 * @param now - 基准时间，默认为当前时间
 * @param expiresInHours - 过期时长（小时），默认使用环境变量配置
 * @returns 过期时间点
 */
export const buildInviteExpiry = (
  now = new Date(),
  expiresInHours = env.INVITE_EXPIRES_IN_HOURS
) => new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

/**
 * 校验邀请是否可加入，校验不通过则抛出 HttpError
 * @param invite - 邀请码信息（含过期时间、使用次数、组织状态等）
 * @param now - 校验时间，默认为当前时间
 */
export const assertInviteJoinable = ({
  invite,
  now = new Date(),
}: {
  invite: JoinableInvite;
  now?: Date;
}) => {
  if (invite.organization.status !== 'ACTIVE')
    throw new HttpError(403, '组织不可加入');
  if (invite.expiresAt <= now) throw new HttpError(400, '邀请码已过期');
  if (invite.usedCount >= invite.maxUses)
    throw new HttpError(400, '邀请码已被使用');
};
