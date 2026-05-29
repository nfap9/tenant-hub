export type Membership = {
  organization: {
    id: string;
    name: string;
    code: string;
    description?: string;
    ownerId: string;
  };
  role: { id: string; code: string; name: string; permissions: string[] };
};

export type OrgRole = {
  id: string;
  code: string;
  name: string;
  permissions: string[];
};

export type OrgMember = {
  id: string;
  userId: string;
  roleId: string;
  user: { id: string; phone: string; username: string };
  role: OrgRole;
};

export type OrgInvite = {
  id: string;
  organizationId: string;
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
  createdBy?: { id: string; username: string; phone: string };
  usedBy?: { id: string; username: string; phone: string };
};

export type Plan = {
  id: string;
  name: string;
  apartmentLimit: number;
  roomLimit: number;
  memberLimit: number;
  price: string | number;
  enabled: boolean;
};

export type Subscription = {
  id: string;
  organizationId: string;
  planId: string;
  startsAt: string;
  endsAt?: string;
  active: boolean;
  plan: Plan;
};

export type SubscriptionOverview = {
  subscription?: Subscription;
  usage: { apartments: number; members: number };
  extraQuota: {
    apartmentQuota: number;
    roomQuota: number;
    memberQuota: number;
  };
};

export type RoomStatus = 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';
export type RentCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type LeaseStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'TERMINATING'
  | 'TERMINATED'
  | 'EXPIRED'
  | 'ENDED';
export type TerminationType = 'EXPIRED' | 'NEGOTIATED' | 'BREACH';
export type BillStatus =
  | 'DRAFT'
  | 'BILLING'
  | 'UNPAID'
  | 'PARTIAL_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'WRITTEN_OFF'
  | 'REFUNDED'
  | 'FAILED'
  | 'VOID';
export type BillMode = 'PREPAID' | 'POSTPAID' | 'DEPOSIT';
export type BillType = 'MONTHLY' | 'SETTLEMENT' | 'DEPOSIT';
export type BillItemType =
  | 'RENT'
  | 'SERVICE_FEE'
  | 'UTILITY'
  | 'ELECTRICITY'
  | 'WATER'
  | 'POWER'
  | 'GAS'
  | 'CARRY_OVER'
  | 'LATE_FEE'
  | 'DEPOSIT'
  | 'MANAGEMENT'
  | 'SANITATION'
  | 'ELEVATOR'
  | 'PROPERTY'
  | 'NETWORK'
  | 'PENALTY'
  | 'COMPENSATION'
  | 'CLEANING_FEE'
  | 'PREPAID_DEDUCTION'
  | 'DISCOUNT'
  | 'OTHER';
export type MeterType = 'WATER' | 'POWER' | 'GAS';
export type MeterStatus = 'ACTIVE' | 'REMOVED';
export type MeterReadingStatus = 'NORMAL' | 'SUSPECTED' | 'CONFIRMED' | 'VOID';
export type SettlementItemType =
  | 'RENT_ADJUSTMENT'
  | 'UTILITY'
  | 'DEPOSIT_REFUND'
  | 'DEPOSIT_DEDUCTION'
  | 'PENALTY'
  | 'COMPENSATION'
  | 'OTHER';
export type CheckoutType = 'NORMAL' | 'EARLY' | 'FORCED' | 'ROOM_CHANGE';
export type DepositLedgerType = 'COLLECT' | 'DEDUCT' | 'REFUND';
export type AccountTransactionType =
  | 'PAYMENT'
  | 'CHARGE'
  | 'REFUND'
  | 'ADJUSTMENT';
export type AccountReferenceType = 'BILL' | 'DEPOSIT' | 'SETTLEMENT';
export type BillQueueStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'DONE'
  | 'FAILED'
  | 'SKIPPED'
  | 'PAUSED';

export type ApartmentExpense = {
  id: string;
  apartmentId: string;
  name: string;
  amount: string | number;
  spentAt: string;
  note?: string;
};

export type Apartment = {
  id: string;
  organizationId: string;
  name: string;
  location: string;
  floors: number;
  landArea?: string | number;
  totalArea?: string | number;
  landlordName?: string;
  landlordPhone?: string;
  contractStart?: string;
  contractEnd?: string;
  rentAmount?: string | number;
  costElectricityPrice?: string | number;
  costWaterPrice?: string | number;
  reminderDay?: number;
  rooms?: Room[];
  expenses?: ApartmentExpense[];
  meters?: Meter[];
};

export type LeaseFee = {
  id: string;
  leaseId: string;
  type: BillItemType;
  name: string;
  amount: string | number;
};

export type Tenant = {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  idCard?: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  workUnit?: string;
  jobTitle?: string;
  sourceChannel?: string;
  creditScore?: number;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  account?: TenantAccount;
  leases?: Lease[];
  _count?: { leases: number };
};

export type Lease = {
  id: string;
  organizationId: string;
  roomId: string;
  tenantId?: string;
  tenantName: string;
  tenantPhone: string;
  startDate: string;
  endDate: string;
  billDay?: number;
  utilityBillDay?: number;
  paymentDueDays?: number;
  graceDays: number;
  cycle: RentCycle;
  rentAmount: string | number;
  monthlyServiceFee?: string | number;
  depositMonths?: number;
  depositAmount: string | number;
  waterUnitPrice: string | number;
  powerUnitPrice: string | number;
  lateFeeRate?: string | number;
  autoRenew: boolean;
  isAutoRenewalPeriod?: boolean;
  currentMonthBillGenerated?: boolean;
  currentMonthBillSettled?: boolean;
  currentMonthBillLabel?: string;
  status: LeaseStatus;
  terminationType?: TerminationType;
  terminationReason?: string;
  terminatedAt?: string;
  fees?: LeaseFee[];
  room?: Room;
  deposit?: Deposit;
  tenant?: Tenant;
  billQueue?: BillQueue;
};

export type Room = {
  id: string;
  apartmentId: string;
  roomNo: string;
  layout: string;
  area?: string | number;
  facilities: string[];
  status: RoomStatus;
  apartment?: Apartment;
  leases?: Lease[];
  meters?: Meter[];
};

export type BillItemReading = {
  id: string;
  billItemId: string;
  meterType: MeterType;
  previousValue: string | number;
  currentValue: string | number;
  unitPrice: string | number;
  usage: string | number;
  amount: string | number;
  meterId?: string;
  meterReadingId?: string;
};

export type BillItem = {
  id: string;
  billId: string;
  type: BillItemType;
  name: string;
  description?: string;
  quantity?: string | number;
  unitPrice?: string | number;
  amount: string | number;
  status: BillStatus;
  previousWater?: string | number;
  currentWater?: string | number;
  previousPower?: string | number;
  currentPower?: string | number;
  waterUnitPrice?: string | number;
  powerUnitPrice?: string | number;
  meterReadingId?: string;
  note?: string;
  readings?: BillItemReading[];
};

export type Bill = {
  id: string;
  organizationId: string;
  leaseId: string;
  mode: BillMode;
  type: BillType;
  billingDate: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: BillStatus;
  totalAmount: string | number;
  discountAmount?: string | number;
  netAmount?: string | number;
  paidAmount: string | number;
  failureReason?: string;
  lease?: Lease;
  items?: BillItem[];
  payments?: Payment[];
  paymentAllocations?: PaymentAllocation[];
};

export type Payment = {
  id: string;
  billId?: string;
  tenantId?: string;
  userId: string;
  type: 'RECEIVE' | 'REFUND' | 'DEDUCT';
  amount: string | number;
  paidAt: string;
  method: string;
  transactionNo?: string;
  note?: string;
  status: string;
  user?: { id: string; username: string; phone: string };
  allocations?: PaymentAllocation[];
};

export type PaymentAllocation = {
  id: string;
  paymentId: string;
  billId: string;
  allocatedAmount: string | number;
};

export type DepositStatus =
  | 'UNPAID'
  | 'PAID'
  | 'PARTIAL_REFUNDED'
  | 'FULLY_REFUNDED'
  | 'DEDUCTED';
export type DepositPaymentType = 'COLLECT' | 'REFUND' | 'DEDUCT';

export type Deposit = {
  id: string;
  organizationId: string;
  leaseId: string;
  amount: string | number;
  paidAmount: string | number;
  refundedAmount: string | number;
  deductedAmount: string | number;
  status: DepositStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
  lease?: Lease & { room?: Room; bills?: Bill[] };
  bill?: Bill & { payments?: Payment[] };
  depositLedgers?: DepositLedger[];
};

export type DepositLedger = {
  id: string;
  depositId: string;
  leaseId: string;
  tenantId: string;
  amount: string | number;
  type: DepositLedgerType;
  relatedBillId?: string;
  balanceAfter: string | number;
  remark?: string;
  operatorId: string;
  createdAt: string;
  operator?: { id: string; username: string; phone: string };
};

export type DepositPayment = {
  id: string;
  depositId: string;
  userId: string;
  type: DepositPaymentType;
  amount: string | number;
  paidAt: string;
  method: string;
  note?: string;
  user?: { id: string; username: string; phone: string };
};

export type SettlementStatus = 'PENDING' | 'SETTLED';
export type SettlementPaymentDirection = 'RECEIVE' | 'REFUND';

export type SettlementPayment = {
  id: string;
  settlementId: string;
  userId: string;
  direction: SettlementPaymentDirection;
  amount: string | number;
  paidAt: string;
  method: string;
  note?: string;
  user?: { id: string; username: string; phone: string };
};

export type SettlementItem = {
  id: string;
  settlementId: string;
  type: SettlementItemType;
  name: string;
  amount: string | number;
  note?: string;
};

export type LeaseSettlement = {
  id: string;
  organizationId: string;
  leaseId: string;
  roomId: string;
  checkoutType?: CheckoutType;
  type: TerminationType;
  reason?: string;
  terminatedAt: string;
  depositAmount: string | number;
  depositRefundAmount: string | number;
  rentAdjustmentAmount: string | number;
  previousWater: string | number;
  currentWater: string | number;
  previousPower: string | number;
  currentPower: string | number;
  waterUnitPrice: string | number;
  powerUnitPrice: string | number;
  utilityAmount: string | number;
  otherFeeAmount: string | number;
  otherFeeReason?: string;
  penaltyAmount: string | number;
  penaltyReason?: string;
  compensationAmount: string | number;
  compensationReason?: string;
  receivableAmount: string | number;
  refundableAmount: string | number;
  netAmount: string | number;
  status: SettlementStatus;
  lease?: Lease & { room?: Room; fees?: LeaseFee[] };
  room?: Room;
  billId?: string;
  bill?: Bill;
  payments?: SettlementPayment[];
  items?: SettlementItem[];
  createdAt?: string;
};

export type MonthlyBill = {
  id: string;
  organizationId: string;
  leaseId: string;
  tenantName: string;
  tenantPhone: string;
  billingDate: string;
  dueDate: string;
  status: BillStatus;
  totalAmount: string | number;
  paidAmount: string | number;
  lease?: Lease;
  bills?: Bill[];
  payments?: Payment[];
};

export type Meter = {
  id: string;
  organizationId: string;
  apartmentId: string;
  roomId?: string;
  name: string;
  meterType: MeterType;
  meterNo?: string;
  installDate: string;
  removeDate?: string;
  status: MeterStatus;
  parentId?: string;
  room?: { id: string; roomNo: string };
  apartment?: { id: string; name: string };
  parent?: { id: string; name: string };
  subMeters?: { id: string; name: string }[];
  _count?: { readings: number };
};

export type MeterReading = {
  id: string;
  organizationId: string;
  apartmentId: string;
  roomId: string;
  leaseId?: string;
  meterId?: string;
  meterType: MeterType;
  readingDate: string;
  value: string | number;
  usage?: string | number;
  source: string;
  readType?: string;
  status: MeterReadingStatus;
  photoUrl?: string;
  note?: string;
  room?: Room;
  lease?: Lease;
  meter?: Meter;
};

export type BillQueue = {
  id: string;
  leaseId: string;
  nextBillDate: string;
  lastBillDate?: string;
  lastBillId?: string;
  status: BillQueueStatus;
  errorMsg?: string;
};

export type TenantAccount = {
  id: string;
  tenantId: string;
  prepaidBalance: string | number;
  depositBalance: string | number;
  totalUnpaid: string | number;
  netBalance: string | number;
};

export type AccountTransaction = {
  id: string;
  tenantAccountId: string;
  type: AccountTransactionType;
  amount: string | number;
  balanceAfter: string | number;
  referenceType?: AccountReferenceType;
  referenceId?: string;
  note?: string;
  createdById?: string;
  createdAt: string;
};
