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
  description?: string;
  system?: boolean;
  organizationId?: string;
  permissions: string[];
};

export type OrgMember = {
  id: string;
  userId: string;
  roleId: string;
  user: { id: string; phone: string; username: string };
  role: OrgRole;
};

export type RoomStatus =
  | 'VACANT'
  | 'RESERVED'
  | 'OCCUPIED'
  | 'MAINTENANCE'
  | 'SELF_USE';
export type RentCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type LeaseStatus = 'DRAFT' | 'ACTIVE' | 'TERMINATED' | 'EXPIRED';
export type BillStatus = 'UNPAID' | 'PAID' | 'VOID';
export type BillCategory = 'RENT' | 'UTILITY' | 'DEPOSIT' | 'FEE' | 'OTHER';
export type BillBillingMethod = 'AUTO' | 'MANUAL';
export type BillItemType = BillCategory;

export type Apartment = {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  rentAmount?: string | number;
  landlordName?: string;
  landlordPhone?: string;
  contractStart?: string;
  contractEnd?: string;
  floors?: number;
  rooms?: Room[];
};

export type LeaseFee = {
  id: string;
  leaseId: string;
  type: string;
  name: string;
  amount: string | number;
  period?: string;
};

export type Lease = {
  id: string;
  organizationId: string;
  roomId: string;
  tenantName?: string;
  tenantPhone?: string;
  startDate: string;
  endDate: string;
  rentCycle: RentCycle;
  rentAmount: string | number;
  depositAmount: string | number;
  keyDepositAmount: string | number;
  waterUnitPrice?: string | number;
  powerUnitPrice?: string | number;
  currentMonthBillGenerated?: boolean;
  currentMonthBillSettled?: boolean;
  currentMonthBillLabel?: string;
  status: LeaseStatus;
  fees?: LeaseFee[];
  room?: Room;
  deposits?: Deposit[];
  bills?: Bill[];
  meterReadings?: MeterReading[];
};

export type Room = {
  id: string;
  apartmentId: string;
  roomNo: string;
  floor?: number;
  layout: string;
  area?: string | number;
  furnishings: string[];
  status: RoomStatus;
  apartment?: Apartment;
  leases?: Lease[];
};

export type BillItem = {
  id: string;
  billId: string;
  category: BillItemType;
  name: string;
  amount: string | number;
  periodStart: string;
  periodEnd: string;
  note?: string;
};

export type Bill = {
  id: string;
  organizationId: string;
  leaseId: string;
  billingMethod: BillBillingMethod;
  billingDate: string;
  dueDate: string;
  status: BillStatus;
  totalAmount: string | number;
  paidAmount: string | number;
  lease?: Lease;
  items?: BillItem[];
  payments?: Payment[];
};

export type Payment = {
  id: string;
  billId: string;
  amount: string | number;
  waiverAmount?: string | number;
  paidAt: string;
  method: string;
  note?: string;
  user?: { id: string; username: string; phone: string };
};

export type DepositStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'DEDUCTED';
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

export type MeterReading = {
  id: string;
  organizationId: string;
  apartmentId: string;
  roomId: string;
  leaseId?: string;
  meterType: 'WATER' | 'POWER';
  readingDate: string;
  value: string | number;
  note?: string;
  createdAt: string;
  apartment?: Apartment;
  room?: Room;
  lease?: Lease;
};

export type MeterReadingRoom = {
  leaseId: string;
  tenantName: string;
  roomId: string;
  roomNo: string;
  apartmentId: string;
  apartmentName: string;
  lastWaterReadingDate: string | null;
  lastWaterValue: number | null;
  lastPowerReadingDate: string | null;
  lastPowerValue: number | null;
};
