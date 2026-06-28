export type Membership = {
  organization: {
    id: string;
    name: string;
    code: string;
    inviteCode?: string;
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

export type RoomStatus =
  | 'VACANT'
  | 'RESERVED'
  | 'OCCUPIED'
  | 'MAINTENANCE'
  | 'SELF_USE';
export type RentCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type LeaseStatus = 'DRAFT' | 'ACTIVE' | 'TERMINATED' | 'EXPIRED';
export type TerminationType = 'EXPIRED' | 'NEGOTIATED' | 'BREACH';
export type BillStatus = 'BILLING' | 'UNPAID' | 'PAID' | 'VOID' | 'REFUNDED';
export type BillMode = 'PREPAID' | 'POSTPAID' | 'DEPOSIT';
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

export type ApartmentExpense = {
  id: string;
  apartmentId: string;
  name: string;
  amount: string | number;
  spentAt: string;
  note?: string;
};

export type ApartmentContract = {
  id: string;
  organizationId: string;
  apartmentId: string;
  landlordName?: string;
  landlordPhone?: string;
  contractStart?: string;
  contractEnd?: string;
  rentAmount?: string | number;
  floors?: number;
  landArea?: string | number;
  totalArea?: string | number;
  createdAt?: string;
  updatedAt?: string;
};

export type Apartment = {
  id: string;
  organizationId: string;
  name: string;
  location: string;
  contract?: ApartmentContract;
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
  tenantName?: string;
  tenantPhone?: string;
  startDate: string;
  endDate: string;
  cycle: RentCycle;
  rentAmount: string | number;
  depositAmount: string | number;
  roomDepositAmount: string | number;
  keyQuantity: number;
  keyUnitPrice: string | number;
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
  deposits?: Deposit[];
  bills?: Bill[];
  settlement?: LeaseSettlement;
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
  reservation?: Reservation;
};

export type Reservation = {
  id: string;
  roomId: string;
  name: string;
  phone: string;
  deposit: string | number;
  paymentMethod?: string;
  expectedMoveInDate: string;
  createdAt: string;
  updatedAt: string;
  room?: Room;
};

export type BillItem = {
  id: string;
  billId: string;
  type: BillItemType;
  name: string;
  amount: string | number;
  status: BillStatus;
  periodStart: string;
  periodEnd: string;
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
  mode: BillMode;
  billingDate: string;
  dueDate: string;
  status: BillStatus;
  totalAmount: string | number;
  paidAmount: string | number;
  failureReason?: string;
  lease?: Lease;
  items?: BillItem[];
  payments?: Payment[];
};

export type Payment = {
  id: string;
  billId: string;
  type: 'RECEIVE' | 'REFUND' | 'DEDUCT';
  amount: string | number;
  paidAt: string;
  method: string;
  note?: string;
  user?: { id: string; username: string; phone: string };
};

export type DepositStatus =
  | 'UNPAID'
  | 'PAID'
  | 'PARTIAL_REFUNDED'
  | 'FULLY_REFUNDED'
  | 'DEDUCTED';
export type DepositType = 'ROOM' | 'KEY';

export type Deposit = {
  id: string;
  organizationId: string;
  leaseId: string;
  type: DepositType;
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

export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'CANCELLED';
export type TransactionSourceType =
  | 'BILL_PAYMENT'
  | 'DEPOSIT_PAYMENT'
  | 'SETTLEMENT_PAYMENT'
  | 'APARTMENT_EXPENSE'
  | 'RESERVATION'
  | 'MANUAL';

export type TransactionCategory = {
  key: string;
  label: string;
  type: TransactionType;
};

export type Transaction = {
  id: string;
  organizationId: string;
  type: TransactionType;
  category: string;
  amount: string | number;
  method: string;
  status: TransactionStatus;
  occurredAt: string;
  description?: string;
  note?: string;
  operatorId: string;
  operator?: { id: string; username: string };
  sourceType: TransactionSourceType;
  sourceId: string;
  billId?: string;
  depositId?: string;
  leaseId?: string;
  apartmentId?: string;
  bill?: { id: string; mode: string };
  lease?: {
    id: string;
    tenantName?: string;
    room?: { roomNo: string; apartment?: { name: string } };
  };
  apartment?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type LeaseSettlement = {
  id: string;
  organizationId: string;
  leaseId: string;
  roomId: string;
  type: TerminationType;
  reason?: string;
  terminatedAt: string;
  depositAmount: string | number;
  roomDepositAmount: string | number;
  keyDepositAmount: string | number;
  roomDepositRefundAmount: string | number;
  keyDepositRefundAmount: string | number;
  roomDepositDeductionAmount: string | number;
  keyDepositDeductionAmount: string | number;
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
  createdAt?: string;
};
