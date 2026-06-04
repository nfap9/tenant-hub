import type { Prisma } from '@prisma/client';

export interface AgentContext {
  organizationId: string;
  userId: string;
  userName: string;
  permissions: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export type ToolResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

export interface ApartmentSummary {
  id: string;
  name: string;
  location: string;
  roomCount: number;
  occupiedCount: number;
  vacantCount: number;
}

export interface RoomSummary {
  id: string;
  roomNo: string;
  apartmentName: string;
  layout: string;
  status: string;
  area: number | null;
}

export interface LeaseSummary {
  id: string;
  tenantName: string;
  tenantPhone: string;
  roomNo: string;
  apartmentName: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  status: string;
  cycle: string;
}

export interface BillSummary {
  id: string;
  tenantName: string;
  roomNo: string;
  billingDate: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  mode: string;
}

export interface AnalyticsSummary {
  totalApartments: number;
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  occupancyRate: number;
  activeLeases: number;
  monthlyRentIncome: number;
  unpaidBillsAmount: number;
  paidBillsAmount: number;
  collectionRate: number;
}

export type DecimalToNumber<T> = {
  [K in keyof T]: T[K] extends Prisma.Decimal
    ? number
    : T[K] extends Date
      ? string
      : T[K] extends object
        ? DecimalToNumber<T[K]>
        : T[K];
};
