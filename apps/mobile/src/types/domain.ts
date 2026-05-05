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

export type RoomStatus = "VACANT" | "RESERVED" | "OCCUPIED" | "MAINTENANCE";
export type RentCycle = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type LeaseStatus = "ACTIVE" | "TERMINATED" | "EXPIRED";
export type TerminationType = "EXPIRED" | "NEGOTIATED" | "BREACH";

export type ApartmentExpense = {
  id: string;
  apartmentId: string;
  name: string;
  amount: string | number;
  spentAt: string;
  note?: string;
};

export type ApartmentFeeItem = {
  id: string;
  apartmentId: string;
  name: string;
  spec?: string;
  amount: string | number;
  enabled: boolean;
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
  feeItems?: ApartmentFeeItem[];
};

export type LeaseFee = {
  id: string;
  leaseId: string;
  feeItemId?: string;
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
  status: LeaseStatus;
  terminationType?: TerminationType;
  terminationReason?: string;
  terminatedAt?: string;
  fees?: LeaseFee[];
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
