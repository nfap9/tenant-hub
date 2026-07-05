import type { ToolMeta } from './types.js';
import { queryApartmentsTool } from './queryApartments.js';
import { queryRoomsTool } from './queryRooms.js';
import { queryLeasesTool } from './queryLeases.js';
import { queryBillsTool } from './queryBills.js';
import { getOverdueSummaryTool } from './getOverdueSummary.js';
import { getRoomStatusOverviewTool } from './getRoomStatusOverview.js';
import { queryMeterReadingsTool } from './queryMeterReadings.js';
import { recordMeterReadingTool } from './recordMeterReading.js';
import { generateBillsTool } from './generateBills.js';
import { voidBillTool } from './voidBill.js';
import { recordPaymentTool } from './recordPayment.js';

export type AnyTool = ToolMeta<any, any>;

export const ALL_TOOLS: AnyTool[] = [
  queryApartmentsTool,
  queryRoomsTool,
  queryLeasesTool,
  queryBillsTool,
  getOverdueSummaryTool,
  getRoomStatusOverviewTool,
  queryMeterReadingsTool,
  recordMeterReadingTool,
  generateBillsTool,
  voidBillTool,
  recordPaymentTool,
];

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
export { toToolDefinition } from './types.js';
