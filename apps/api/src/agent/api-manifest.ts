import { z } from 'zod';
import { PERMISSIONS } from '../services/roles.js';
import {
  apartmentInput,
  batchCreateRoomsInput,
  apartmentExpenseInput,
  updateRoomInput,
} from '../routes/apartments.js';
import {
  generateBillsInput,
  meterReadingInput,
  utilityReadingInput,
  billPaymentInput,
  billRefundInput,
  utilityImportInput,
} from '../routes/bills.js';
import {
  createLeaseInput,
  terminateLeaseInput,
  settlementPaymentInput,
} from '../routes/leases.js';
import { createTransactionInput } from '../routes/transactions.js';
import { reservationInput } from '../routes/reservations.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiOperationCategory = 'query' | 'action';

export interface ApiManifestItem {
  /** 工具/操作名称，用于 LLM 识别 */
  name: string;
  /** HTTP 方法 */
  method: HttpMethod;
  /** 路由路径，可包含 :id 等路径参数 */
  path: string;
  /** 人类可读的描述 */
  description: string;
  /** 需要的权限 */
  permission: string;
  /** 操作类型：query 直接执行，action 需要确认 */
  category: ApiOperationCategory;
  /** 路径参数 schema */
  pathParamsSchema?: z.ZodObject<z.ZodRawShape>;
  /** 查询参数 schema */
  querySchema?: z.ZodObject<z.ZodRawShape>;
  /** 请求体 schema */
  bodySchema?: z.ZodTypeAny;
  /** 是否需要用户确认（action 默认 true） */
  requiresConfirmation?: boolean;
}

// --- 查询 schema（由旧工具版迁移而来） ---

const queryApartmentsInput = z.object({
  keyword: z.string().optional().describe('按名称或位置关键词筛选（可选）'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('返回数量限制，默认20'),
});

const queryRoomsInput = z.object({
  apartmentId: z.string().optional().describe('按公寓ID筛选（可选）'),
  status: z
    .enum(['VACANT', 'RESERVED', 'OCCUPIED', 'MAINTENANCE', 'SELF_USE'])
    .optional()
    .describe('按状态筛选'),
  keyword: z.string().optional().describe('按房号或户型关键词筛选（可选）'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('返回数量限制，默认30'),
});

const queryRoomDetailInput = z.object({});

const queryLeasesInput = z.object({
  tenantName: z.string().optional().describe('按租户姓名关键词筛选（可选）'),
  roomId: z.string().optional().describe('按房间ID筛选（可选）'),
  status: z
    .enum(['ACTIVE', 'TERMINATED', 'EXPIRED', 'DRAFT'])
    .optional()
    .describe('按状态筛选'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('返回数量限制，默认30'),
});

const querySettlementsInput = z.object({
  leaseId: z.string().optional().describe('按租约ID筛选（可选）'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('返回数量限制，默认30'),
});

const queryBillsInput = z.object({
  status: z
    .enum([
      'DRAFT',
      'BILLING',
      'UNPAID',
      'PARTIAL_PAID',
      'PAID',
      'REFUNDED',
      'FAILED',
      'VOID',
    ])
    .optional()
    .describe('按账单状态筛选'),
  tenantName: z.string().optional().describe('按租户姓名关键词筛选（可选）'),
  mode: z
    .enum(['PREPAID', 'POSTPAID', 'DEPOSIT'])
    .optional()
    .describe('按账单类型筛选'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('返回数量限制，默认30'),
});

const queryMeterReadingsInput = z.object({
  roomId: z.string().optional().describe('按房间ID筛选（可选）'),
  meterType: z
    .enum(['WATER', 'POWER'])
    .optional()
    .describe('类型：WATER水表/POWER电表'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('返回数量限制，默认30'),
});

const queryTransactionsInput = z.object({
  type: z.enum(['INCOME', 'EXPENSE']).optional().describe('收支类型'),
  category: z.string().optional().describe('科目代码'),
  startDate: z.coerce.date().optional().describe('开始日期'),
  endDate: z.coerce.date().optional().describe('结束日期'),
  sourceType: z
    .enum([
      'BILL_PAYMENT',
      'DEPOSIT_PAYMENT',
      'SETTLEMENT_PAYMENT',
      'APARTMENT_EXPENSE',
      'RESERVATION',
      'MANUAL',
    ])
    .optional()
    .describe('来源类型'),
  keyword: z.string().optional().describe('描述或备注关键词搜索'),
  page: z.number().int().min(1).optional().describe('页码，默认1'),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('每页条数，默认20'),
});

const queryTransactionSummaryInput = z.object({
  startDate: z.coerce.date().optional().describe('开始日期（可选）'),
  endDate: z.coerce.date().optional().describe('结束日期（可选）'),
});

const queryDepositsInput = z.object({
  status: z
    .enum(['UNPAID', 'PAID', 'PARTIAL_REFUNDED', 'FULLY_REFUNDED', 'DEDUCTED'])
    .optional()
    .describe('按押金状态筛选'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('返回数量限制，默认30'),
});

const queryDepositSummaryInput = z.object({});

const queryReservationInput = z.object({});

const queryApartmentContractInput = z.object({});

const analyticsSummaryInput = z.object({});

const generateChartInput = z.object({
  chartType: z
    .enum(['bar', 'line', 'pie', 'area', 'radar'])
    .describe('图表类型'),
  title: z.string().describe('图表标题'),
  labels: z.array(z.string()).describe('数据标签'),
  datasets: z
    .array(
      z.object({
        label: z.string().describe('数据系列名称'),
        data: z.array(z.number()).describe('数值数组'),
      })
    )
    .describe('数据系列'),
  unit: z.string().optional().describe('数据单位'),
});

export const apiManifest: ApiManifestItem[] = [
  // --- 查询类（由旧工具版迁移） ---
  {
    name: 'query_apartments',
    method: 'GET',
    path: '/api/apartments',
    description:
      '查询公寓列表。返回公寓ID、名称、位置、房间总数、已租数量、空置数量。',
    permission: PERMISSIONS.APARTMENT_VIEW,
    category: 'query',
    querySchema: queryApartmentsInput,
    bodySchema: queryApartmentsInput,
  },
  {
    name: 'query_apartment_contract',
    method: 'GET',
    path: '/api/apartments/:id/contract',
    description:
      '查询公寓的上游租赁合同信息，包括房东信息、合同日期、租金、楼层和面积等。',
    permission: PERMISSIONS.APARTMENT_VIEW,
    category: 'query',
    pathParamsSchema: z.object({ id: z.string() }),
    bodySchema: queryApartmentContractInput,
  },
  {
    name: 'query_rooms',
    method: 'GET',
    path: '/api/apartments/rooms',
    description:
      '查询房间列表。返回房间ID、房号、所属公寓、户型、状态、面积、配套设施。',
    permission: PERMISSIONS.ROOM_VIEW,
    category: 'query',
    querySchema: queryRoomsInput,
    bodySchema: queryRoomsInput,
  },
  {
    name: 'query_room_detail',
    method: 'GET',
    path: '/api/apartments/rooms/:roomId/detail',
    description:
      '查询单个房间的详细信息，包括公寓信息、预留记录、活跃租约（费用、押金）、当月账单、最近抄表读数。',
    permission: PERMISSIONS.ROOM_VIEW,
    category: 'query',
    pathParamsSchema: z.object({ roomId: z.string() }),
    bodySchema: queryRoomDetailInput,
  },
  {
    name: 'query_leases',
    method: 'GET',
    path: '/api/leases',
    description:
      '查询租约列表。返回租约ID、租户姓名、手机号、房间号、公寓名、起止日期、月租金、押金、状态、周期。',
    permission: PERMISSIONS.LEASE_VIEW,
    category: 'query',
    querySchema: queryLeasesInput,
    bodySchema: queryLeasesInput,
  },
  {
    name: 'query_settlements',
    method: 'GET',
    path: '/api/leases/settlements',
    description:
      '查询退租结算记录，包括结算类型、各项费用（租金调整、其他费用、违约金、赔偿金）、押金退还和实收金额。',
    permission: PERMISSIONS.LEASE_VIEW,
    category: 'query',
    querySchema: querySettlementsInput,
    bodySchema: querySettlementsInput,
  },
  {
    name: 'query_bills',
    method: 'GET',
    path: '/api/bills',
    description:
      '查询账单列表。返回账单ID、租户姓名、房间号、账单日期、账期、总金额、已付金额、状态、类型。',
    permission: PERMISSIONS.BILL_VIEW,
    category: 'query',
    querySchema: queryBillsInput,
    bodySchema: queryBillsInput,
  },
  {
    name: 'query_meter_readings',
    method: 'GET',
    path: '/api/bills/meter-readings',
    description:
      '查询水电抄表记录。返回房间、类型（水/电）、抄表日期、读数、来源、状态。',
    permission: PERMISSIONS.BILL_VIEW,
    category: 'query',
    querySchema: queryMeterReadingsInput,
    bodySchema: queryMeterReadingsInput,
  },
  {
    name: 'query_transactions',
    method: 'GET',
    path: '/api/transactions',
    description:
      '查询收支交易记录，支持按类型、科目、日期范围、来源类型、关键词筛选，返回分页结果。',
    permission: PERMISSIONS.BILL_VIEW,
    category: 'query',
    querySchema: queryTransactionsInput,
    bodySchema: queryTransactionsInput,
  },
  {
    name: 'query_transaction_summary',
    method: 'GET',
    path: '/api/transactions/summary',
    description:
      '获取收支汇总统计，包括总收入、总支出、净收入，以及按科目分类的明细。可按日期范围筛选。',
    permission: PERMISSIONS.BILL_VIEW,
    category: 'query',
    querySchema: queryTransactionSummaryInput,
    bodySchema: queryTransactionSummaryInput,
  },
  {
    name: 'query_deposits',
    method: 'GET',
    path: '/api/deposits',
    description:
      '查询押金列表，返回押金ID、租户、房间、金额、已收/已退/已扣、状态。',
    permission: PERMISSIONS.DEPOSIT_VIEW,
    category: 'query',
    querySchema: queryDepositsInput,
    bodySchema: queryDepositsInput,
  },
  {
    name: 'query_deposit_summary',
    method: 'GET',
    path: '/api/deposits/summary',
    description:
      '获取押金汇总统计，包括总金额、已收、已退、已扣、持有金额，以及按状态分布的数量。',
    permission: PERMISSIONS.DEPOSIT_VIEW,
    category: 'query',
    bodySchema: queryDepositSummaryInput,
  },
  {
    name: 'query_reservation',
    method: 'GET',
    path: '/api/reservations/room/:roomId',
    description: '查询房间的预留信息。返回预留客户、预期入住日期、定金等。',
    permission: PERMISSIONS.ROOM_VIEW,
    category: 'query',
    pathParamsSchema: z.object({ roomId: z.string() }),
    bodySchema: queryReservationInput,
  },
  {
    name: 'analytics_summary',
    method: 'GET',
    path: '/api/analytics/summary',
    description:
      '获取当前组织的经营数据汇总，包括：公寓数、房间数、空置率、活跃租约数、本月租金收入、未收金额、总收缴率。',
    permission: PERMISSIONS.APARTMENT_VIEW,
    category: 'query',
    bodySchema: analyticsSummaryInput,
  },
  {
    name: 'generate_chart',
    method: 'GET',
    path: '/api/agent/chart',
    description:
      '生成可视化图表数据。当用户想看趋势对比、比例分布等需要图形化展示的数据时使用。返回结构化的图表配置数据供前端渲染。',
    permission: PERMISSIONS.APARTMENT_VIEW,
    category: 'query',
    bodySchema: generateChartInput,
  },

  // --- 公寓管理（写操作） ---
  {
    name: 'create_apartment',
    method: 'POST',
    path: '/api/apartments',
    description: '创建新的公寓房源，需要填写公寓名称和地址',
    permission: PERMISSIONS.APARTMENT_MANAGE,
    category: 'action',
    bodySchema: apartmentInput,
  },
  {
    name: 'batch_create_rooms',
    method: 'POST',
    path: '/api/apartments/:id/rooms/batch',
    description: '为指定公寓批量创建房间',
    permission: PERMISSIONS.ROOM_MANAGE,
    category: 'action',
    bodySchema: batchCreateRoomsInput,
  },
  {
    name: 'create_apartment_expense',
    method: 'POST',
    path: '/api/apartments/:id/expenses',
    description: '记录公寓的某项支出（如维修、保洁等）',
    permission: PERMISSIONS.APARTMENT_MANAGE,
    category: 'action',
    bodySchema: apartmentExpenseInput,
  },
  {
    name: 'update_room',
    method: 'PUT',
    path: '/api/apartments/rooms/:roomId',
    description: '更新房间信息（房号、户型、面积、设施、状态）',
    permission: PERMISSIONS.ROOM_MANAGE,
    category: 'action',
    bodySchema: updateRoomInput,
  },

  // --- 账单与抄表（写操作） ---
  {
    name: 'generate_bills',
    method: 'POST',
    path: '/api/bills/generate',
    description: '为租约生成账单；不指定租约 ID 则为所有到期租约生成',
    permission: PERMISSIONS.BILL_MANAGE,
    category: 'action',
    bodySchema: generateBillsInput,
    requiresConfirmation: true,
  },
  {
    name: 'create_meter_reading',
    method: 'POST',
    path: '/api/bills/meter-readings',
    description: '为指定房间录入一次水表或电表抄表记录',
    permission: PERMISSIONS.BILL_MANAGE,
    category: 'action',
    bodySchema: meterReadingInput,
  },
  {
    name: 'apply_utility_reading',
    method: 'POST',
    path: '/api/bills/:id/utility-reading',
    description: '对指定后付费账单应用本期水电读数',
    permission: PERMISSIONS.BILL_MANAGE,
    category: 'action',
    bodySchema: utilityReadingInput,
  },
  {
    name: 'import_utility_readings',
    method: 'POST',
    path: '/api/bills/utility/import',
    description: '批量导入水电读数（CSV 或多条读数记录）',
    permission: PERMISSIONS.BILL_MANAGE,
    category: 'action',
    bodySchema: utilityImportInput,
  },
  {
    name: 'record_bill_payment',
    method: 'POST',
    path: '/api/bills/:id/payments',
    description: '为账单记录一笔收款',
    permission: PERMISSIONS.BILL_MANAGE,
    category: 'action',
    bodySchema: billPaymentInput,
  },
  {
    name: 'refund_bill',
    method: 'POST',
    path: '/api/bills/:id/refund',
    description: '对账单进行退款',
    permission: PERMISSIONS.BILL_MANAGE,
    category: 'action',
    bodySchema: billRefundInput,
  },

  // --- 租约管理（写操作） ---
  {
    name: 'create_lease',
    method: 'POST',
    path: '/api/leases',
    description: '为指定房间创建新租约',
    permission: PERMISSIONS.LEASE_MANAGE,
    category: 'action',
    bodySchema: createLeaseInput,
  },
  {
    name: 'terminate_lease',
    method: 'POST',
    path: '/api/leases/:id/terminate',
    description: '办理租约退租结算',
    permission: PERMISSIONS.LEASE_MANAGE,
    category: 'action',
    bodySchema: terminateLeaseInput,
  },
  {
    name: 'record_settlement_payment',
    method: 'POST',
    path: '/api/leases/settlements/:id/payments',
    description: '对退租结算记录进行收款或退款',
    permission: PERMISSIONS.LEASE_MANAGE,
    category: 'action',
    bodySchema: settlementPaymentInput,
  },

  // --- 收支管理（写操作） ---
  {
    name: 'create_transaction',
    method: 'POST',
    path: '/api/transactions',
    description: '手动创建一笔收入或支出记录',
    permission: PERMISSIONS.BILL_MANAGE,
    category: 'action',
    bodySchema: createTransactionInput,
  },

  // --- 预留管理（写操作） ---
  {
    name: 'create_reservation',
    method: 'POST',
    path: '/api/reservations',
    description: '为房间创建预留信息（客户、定金、预计入住日期）',
    permission: PERMISSIONS.ROOM_MANAGE,
    category: 'action',
    bodySchema: reservationInput,
  },
];

const manifestByName = new Map(apiManifest.map((item) => [item.name, item]));

export function getApiManifestItem(name: string): ApiManifestItem | undefined {
  return manifestByName.get(name);
}

export function listApiManifestItems(permissions: string[]): ApiManifestItem[] {
  return apiManifest.filter(
    (item) => permissions.includes('*') || permissions.includes(item.permission)
  );
}
