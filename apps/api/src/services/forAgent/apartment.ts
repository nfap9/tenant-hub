import {
  listApartmentsRaw,
  listRoomsRaw,
  getRoomByIdRaw,
} from '../apartment.js';
import { prisma } from '../../config/prisma.js';
import {
  toAgentApartmentSummary,
  toAgentRoomSummary,
  toAgentRoomDetail,
} from './mappers/index.js';

/**
 * 为 AI Agent 查询公寓列表，返回基础信息与房间统计
 * @param organizationId - 组织 ID
 * @param keyword - 搜索关键词（名称或地址）
 * @param limit - 返回数量上限，默认 20
 * @returns 精简后的公寓列表
 */
export const queryApartmentsForAgent = async ({
  organizationId,
  keyword,
  limit = 20,
}: {
  organizationId: string;
  keyword?: string;
  limit?: number;
}) => {
  const apartments = await listApartmentsRaw(organizationId, {
    keyword,
    limit,
    includeRoomStats: true,
  });

  return apartments.map(toAgentApartmentSummary);
};

/**
 * 为 AI Agent 查询房间列表，支持按公寓、状态、关键词筛选
 * @param organizationId - 组织 ID
 * @param apartmentId - 所属公寓 ID（可选）
 * @param status - 房间状态（可选）
 * @param keyword - 搜索关键词（房号或户型）
 * @param limit - 返回数量上限，默认 30
 * @returns 精简后的房间列表
 */
export const queryRoomsForAgent = async ({
  organizationId,
  apartmentId,
  status,
  keyword,
  limit = 30,
}: {
  organizationId: string;
  apartmentId?: string;
  status?: 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';
  keyword?: string;
  limit?: number;
}) => {
  const rooms = await listRoomsRaw(organizationId, {
    apartmentId,
    status,
    keyword,
    limit,
  });

  return rooms.map(toAgentRoomSummary);
};

/**
 * 为 AI Agent 查询房间详情，包含租约、账单与最近抄表记录
 * @param organizationId - 组织 ID
 * @param roomId - 房间 ID
 * @returns 房间详情对象，不存在返回 null
 */
export const queryRoomDetailForAgent = async ({
  organizationId,
  roomId,
}: {
  organizationId: string;
  roomId: string;
}) => {
  const room = await getRoomByIdRaw(roomId, organizationId);

  if (!room) {
    return null;
  }

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const bills = await prisma.bill.findMany({
    where: {
      lease: { roomId, organizationId },
      deletedAt: null,
      billingDate: {
        gte: monthStart,
        lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
      },
    },
    select: { id: true, status: true, totalAmount: true, mode: true },
  });

  return toAgentRoomDetail(room, bills);
};

/**
 * 为 AI Agent 查询公寓合同信息
 * @param organizationId - 组织 ID
 * @param apartmentId - 公寓 ID
 * @returns 公寓合同信息，不存在返回 null
 */
export const queryApartmentContractForAgent = async ({
  organizationId,
  apartmentId,
}: {
  organizationId: string;
  apartmentId: string;
}) => {
  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, organizationId },
    select: { id: true, name: true },
  });
  if (!apartment) {
    return null;
  }

  const contract = await prisma.apartmentContract.findUnique({
    where: { apartmentId },
  });

  return {
    apartmentId: apartment.id,
    apartmentName: apartment.name,
    contract: contract
      ? {
          landlordName: contract.landlordName,
          landlordPhone: contract.landlordPhone,
          contractStart: contract.contractStart
            ? contract.contractStart.toISOString().split('T')[0]
            : null,
          contractEnd: contract.contractEnd
            ? contract.contractEnd.toISOString().split('T')[0]
            : null,
          rentAmount: contract.rentAmount ? Number(contract.rentAmount) : null,
          floors: contract.floors,
          landArea: contract.landArea ? Number(contract.landArea) : null,
          totalArea: contract.totalArea ? Number(contract.totalArea) : null,
        }
      : null,
  };
};
