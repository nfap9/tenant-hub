import type { ToolMeta } from './types.js';
import { queryApartmentsTool } from './queryApartments.js';
import { queryRoomsTool } from './queryRooms.js';
import { queryLeasesTool } from './queryLeases.js';
import { queryBillsTool } from './queryBills.js';
import { getOverdueSummaryTool } from './getOverdueSummary.js';
import { queryMeterReadingsTool } from './queryMeterReadings.js';

export type AnyTool = ToolMeta<any, any>;

export const ALL_TOOLS: AnyTool[] = [
  queryApartmentsTool,
  queryRoomsTool,
  queryLeasesTool,
  queryBillsTool,
  getOverdueSummaryTool,
  queryMeterReadingsTool,
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
