import type { ToolMeta } from './types.js';
import { queryApartmentsTool } from './read/queryApartments.js';
import { queryRoomsTool } from './read/queryRooms.js';
import { queryLeasesTool } from './read/queryLeases.js';
import { queryBillsTool } from './read/queryBills.js';
import { queryMeterReadingsTool } from './read/queryMeterReadings.js';
import { getOverdueSummaryTool } from './read/getOverdueSummary.js';
import { getRoomStatusOverviewTool } from './read/getRoomStatusOverview.js';
import { recordMeterReadingTool } from './write/recordMeterReading.js';
import { generateBillsTool } from './write/generateBills.js';
import { voidBillTool } from './write/voidBill.js';
import { recordPaymentTool } from './write/recordPayment.js';
import { createLeaseTool } from './write/createLease.js';
import { updateLeaseStatusTool } from './write/updateLeaseStatus.js';
import { createApartmentTool } from './write/createApartment.js';

export type AnyTool = ToolMeta<any, any>;

/** 只读工具：直接执行并返回结果（read/） */
const READ_TOOLS: AnyTool[] = [
  queryApartmentsTool,
  queryRoomsTool,
  queryLeasesTool,
  queryBillsTool,
  queryMeterReadingsTool,
  getOverdueSummaryTool,
  getRoomStatusOverviewTool,
];

/** 写工具：生成待确认操作，用户确认后才真正执行（write/） */
const WRITE_TOOLS: AnyTool[] = [
  recordMeterReadingTool,
  generateBillsTool,
  voidBillTool,
  recordPaymentTool,
  createLeaseTool,
  updateLeaseStatusTool,
  createApartmentTool,
];

export const ALL_TOOLS: AnyTool[] = [...READ_TOOLS, ...WRITE_TOOLS];

const hasPermission = (permissions: string[], required?: string): boolean => {
  if (!required) return true;
  if (permissions.includes('*')) return true;
  return permissions.includes(required);
};

export const selectToolsForUser = (permissions: string[]): AnyTool[] =>
  ALL_TOOLS.filter((t) => hasPermission(permissions, t.permission));

export const findTool = (name: string): AnyTool | undefined =>
  ALL_TOOLS.find((t) => t.name === name);

export type {
  ToolContext,
  ToolMeta,
  ToolResult,
  ToolPreview,
} from './types.js';
