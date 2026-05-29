import { apiClient } from './client';

export async function getReceivablesReport(organizationId: string) {
  return apiClient<{
    bills: unknown[];
    summary: {
      totalReceivable: number;
      totalReceived: number;
      totalUnpaid: number;
    };
  }>('/reports/receivables', { organizationId });
}

export async function getIncomeExpenseReport(
  organizationId: string,
  year: number,
  month?: number
) {
  const query = month ? `?year=${year}&month=${month}` : `?year=${year}`;
  return apiClient<{
    income: { total: number; byCategory: Record<string, number> };
    expense: { total: number; byCategory: Record<string, number> };
    grossProfit: number;
  }>(`/reports/income-expense${query}`, { organizationId });
}

export async function getCollectionRateReport(
  organizationId: string,
  year: number,
  month: number
) {
  return apiClient<{
    collectionRate: number;
    overdueTenants: unknown[];
  }>(`/reports/collection-rate?year=${year}&month=${month}`, {
    organizationId,
  });
}

export async function getOccupancyReport(organizationId: string) {
  return apiClient<{
    totalRooms: number;
    occupiedRooms: number;
    vacantRooms: number;
    overallOccupancyRate: number;
    byApartment: unknown[];
  }>('/reports/occupancy', { organizationId });
}

export async function getOccupancyTrend(organizationId: string) {
  return apiClient<{
    months: { month: string; occupancyRate: number }[];
  }>('/reports/occupancy-trend', { organizationId });
}

export async function getIncomeExpenseTrend(organizationId: string) {
  return apiClient<{
    months: { month: string; income: number; expense: number }[];
  }>('/reports/income-expense-trend', { organizationId });
}

export async function getCollectionRateTrend(organizationId: string) {
  return apiClient<{
    months: { month: string; collectionRate: number }[];
  }>('/reports/collection-rate-trend', { organizationId });
}
