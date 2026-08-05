import type { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { Permission } from '../../services/roles.js';

export interface ToolContext {
  organizationId: string;
  userId: string;
  permissions: string[];
  prisma: PrismaClient;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  summary: string;
}

export interface ToolPreview {
  title: string;
  riskLevel: 'low' | 'medium' | 'high';
  diff: Array<{ field: string; oldValue?: unknown; newValue?: unknown }>;
  description: string;
}

export interface ToolMeta<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  permission?: Permission;
  isWrite: boolean;
  execute: (input: TInput, ctx: ToolContext) => Promise<ToolResult<TOutput>>;
  preview?: (input: TInput, ctx: ToolContext) => Promise<ToolPreview>;
}
