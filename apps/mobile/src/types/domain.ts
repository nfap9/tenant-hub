export type Membership = {
  organization: { id: string; name: string; code: string; description?: string; ownerId: string };
  role: { id: string; code: string; name: string; permissions: string[] };
};

export type OrgRole = { id: string; code: string; name: string; permissions: string[] };

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
  extraQuota: { apartmentQuota: number; roomQuota: number; memberQuota: number };
};

export type RoomStatus = 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';
export type RentCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type LeaseStatus = 'ACTIVE' | 'TERMINATED' | 'EXPIRED';
export type TerminationType = 'EXPIRED' | 'NEGOTIATED' | 'BREACH';
export type BillStatus =
  | 'DRAFT'
  | 'BILLING'
  | 'UNPAID'
  | 'PARTIAL_PAID'
  | 'PAID'
  | 'FAILED'
  | 'VOID';
export type BillMode = 'PREPAID' | 'POSTPAID';
export type BillItemType =
  | 'RENT'
  | 'UTILITY'
  | 'WATER'
  | 'POWER'
  | 'DEPOSIT'
  | 'MANAGEMENT'
  | 'SANITATION'
  | 'ELEVATOR'
  | 'PROPERTY'
  | 'NETWORK'
  | 'OTHER';
export type MeterType = 'WATER' | 'POWER';
export type MeterReadingStatus = 'NORMAL' | 'SUSPECTED' | 'CONFIRMED' | 'VOID';

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
  waterUnitPrice: string | number;
  powerUnitPrice: string | number;
  rooms?: Room[];
  expenses?: ApartmentExpense[];
};

export type LeaseFee = {
  id: string;
  leaseId: string;
  type: BillItemType;
  name: string;
  amount: string | number;
};

export type Lease = {
  id: string;
  organizationId: string;
  roomId: string;
  tenantName: string;
  tenantPhone: string;
  startDate: string;
  endDate: string;
  graceDays: number;
  cycle: RentCycle;
  rentAmount: string | number;
  depositAmount: string | number;
  waterUnitPrice: string | number;
  powerUnitPrice: string | number;
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
};

export type BillItem = {
  id: string;
  billId: string;
  type: BillItemType;
  name: string;
  amount: string | number;
  status: BillStatus;
  previousWater?: string | number;
  currentWater?: string | number;
  previousPower?: string | number;
  currentPower?: string | number;
  waterUnitPrice?: string | number;
  powerUnitPrice?: string | number;
  note?: string;
};

export type Bill = {
  id: string;
  organizationId: string;
  leaseId: string;
  monthlyBillId?: string;
  mode: BillMode;
  billingDate: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: BillStatus;
  totalAmount: string | number;
  paidAmount: string | number;
  failureReason?: string;
  lease?: Lease;
  items?: BillItem[];
};

export type Payment = {
  id: string;
  billId?: string;
  monthlyBillId?: string;
  amount: string | number;
  paidAt: string;
  method: string;
  note?: string;
  user?: { id: string; username: string; phone: string };
};

export type SettlementStatus = 'PENDING' | 'SETTLED';
export type SettlementPaymentDirection = 'RECEIVE' | 'REFUND';

export type LeaseSettlement = {
  id: string;
  organizationId: string;
  leaseId: string;
  roomId: string;
  type: TerminationType;
  reason?: string;
  terminatedAt: string;
  depositAmount: string | number;
  depositDeductionAmount: string | number;
  depositDeductionReason?: string;
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
  receivableAmount: string | number;
  refundableAmount: string | number;
  netAmount: string | number;
  status: SettlementStatus;
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

export type MeterReading = {
  id: string;
  organizationId: string;
  apartmentId: string;
  roomId: string;
  leaseId?: string;
  meterType: MeterType;
  readingDate: string;
  value: string | number;
  status: MeterReadingStatus;
  note?: string;
  room?: Room;
  lease?: Lease;
};
