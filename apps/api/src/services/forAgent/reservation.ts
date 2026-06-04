import { prisma } from '../../config/prisma.js';

/**
 * 为代理查询指定房间的预订信息
 * @param params - 查询参数对象
 * @param params.organizationId - 组织唯一标识
 * @param params.roomId - 房间唯一标识
 * @returns 格式化的预订详情对象，包含存在标识、客户信息、定金及日期等
 */
export const queryReservationForAgent = async ({
  organizationId,
  roomId,
}: {
  organizationId: string;
  roomId: string;
}) => {
  const reservation = await prisma.reservation.findUnique({
    where: {
      roomId,
      room: {
        apartment: { organizationId },
      },
    },
    include: {
      room: {
        select: {
          roomNo: true,
          status: true,
          apartment: { select: { name: true } },
        },
      },
    },
  });

  if (!reservation) {
    return { exists: false };
  }

  return {
    exists: true,
    id: reservation.id,
    roomNo: reservation.room.roomNo,
    apartmentName: reservation.room.apartment.name,
    roomStatus: reservation.room.status,
    customerName: reservation.name,
    customerPhone: reservation.phone,
    deposit: Number(reservation.deposit),
    paymentMethod: reservation.paymentMethod,
    expectedMoveInDate: reservation.expectedMoveInDate
      .toISOString()
      .split('T')[0],
    createdAt: reservation.createdAt.toISOString().split('T')[0],
  };
};
