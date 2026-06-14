import type { StructuredTool } from '@langchain/core/tools';
import { PERMISSIONS } from '../../services/roles.js';
import { queryApartmentsTool } from '../tools/apartments.js';
import { queryRoomsTool } from '../tools/rooms.js';
import { queryLeasesTool } from '../tools/leases.js';
import { queryBillsTool } from '../tools/bills.js';
import { analyticsSummaryTool } from '../tools/analytics.js';
import { queryRoomDetailTool } from '../tools/room-detail.js';
import { queryApartmentContractTool } from '../tools/apartment-contract.js';
import {
  queryDepositsTool,
  queryDepositSummaryTool,
} from '../tools/deposits.js';
import {
  queryTransactionsTool,
  queryTransactionSummaryTool,
} from '../tools/transactions.js';
import { queryMeterReadingsTool } from '../tools/meter-readings.js';
import { queryReservationTool } from '../tools/reservations.js';
import { querySettlementsTool } from '../tools/settlements.js';
import { generateChartTool } from '../tools/chart.js';
import type { AgentContext } from '../types.js';

export interface ToolDefinition {
  name: string;
  label: string;
  permission: string;
  factory: (ctx: AgentContext) => StructuredTool;
}

const registry: ToolDefinition[] = [
  {
    name: 'query_apartments',
    label: '公寓列表',
    permission: PERMISSIONS.APARTMENT_VIEW,
    factory: queryApartmentsTool,
  },
  {
    name: 'query_rooms',
    label: '房间列表',
    permission: PERMISSIONS.ROOM_VIEW,
    factory: queryRoomsTool,
  },
  {
    name: 'query_leases',
    label: '租约列表',
    permission: PERMISSIONS.LEASE_VIEW,
    factory: queryLeasesTool,
  },
  {
    name: 'query_bills',
    label: '账单列表',
    permission: PERMISSIONS.BILL_VIEW,
    factory: queryBillsTool,
  },
  {
    name: 'query_deposits',
    label: '押金列表',
    permission: PERMISSIONS.DEPOSIT_VIEW,
    factory: queryDepositsTool,
  },
  {
    name: 'query_deposit_summary',
    label: '押金汇总',
    permission: PERMISSIONS.DEPOSIT_VIEW,
    factory: queryDepositSummaryTool,
  },
  {
    name: 'query_transactions',
    label: '收支记录',
    permission: PERMISSIONS.BILL_VIEW,
    factory: queryTransactionsTool,
  },
  {
    name: 'query_transaction_summary',
    label: '收支汇总',
    permission: PERMISSIONS.BILL_VIEW,
    factory: queryTransactionSummaryTool,
  },
  {
    name: 'query_meter_readings',
    label: '抄表记录',
    permission: PERMISSIONS.BILL_VIEW,
    factory: queryMeterReadingsTool,
  },
  {
    name: 'query_reservation',
    label: '预留信息',
    permission: PERMISSIONS.ROOM_VIEW,
    factory: queryReservationTool,
  },
  {
    name: 'query_settlements',
    label: '退租结算',
    permission: PERMISSIONS.LEASE_VIEW,
    factory: querySettlementsTool,
  },
  {
    name: 'query_room_detail',
    label: '房间详情',
    permission: PERMISSIONS.ROOM_VIEW,
    factory: queryRoomDetailTool,
  },
  {
    name: 'query_apartment_contract',
    label: '公寓合同',
    permission: PERMISSIONS.APARTMENT_VIEW,
    factory: queryApartmentContractTool,
  },
  {
    name: 'analytics_summary',
    label: '经营汇总',
    permission: PERMISSIONS.APARTMENT_VIEW,
    factory: analyticsSummaryTool,
  },
  {
    name: 'generate_chart',
    label: '生成图表',
    permission: PERMISSIONS.APARTMENT_VIEW,
    factory: () => generateChartTool,
  },
];

const registryByName = new Map(registry.map((item) => [item.name, item]));

export function createTools(ctx: AgentContext): StructuredTool[] {
  return registry.map((item) => item.factory(ctx));
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return registryByName.get(name);
}

export function getToolLabel(name: string): string {
  return getToolDefinition(name)?.label || name;
}

export function getToolPermission(name: string): string | undefined {
  return getToolDefinition(name)?.permission;
}

export function listToolMetadata(): Array<{
  name: string;
  label: string;
  permission: string;
}> {
  return registry.map(({ name, label, permission }) => ({
    name,
    label,
    permission,
  }));
}
