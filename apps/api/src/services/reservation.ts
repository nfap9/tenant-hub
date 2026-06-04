import { prisma } from '../config/prisma.js';

/**
 * 根据房间ID和组织ID查找可用于预订的房间信息
 * @param roomId - 房间唯一标识
 * @param organizationId - 组织唯一标识
 * @returns 包含房间基本信息及所属公寓名称的对象，若不存在则返回null
 */
export const findRoomForReservation = async (
  roomId: string,
  organizationId: string
) => {
  return prisma.room.findFirst({
    where: {
      id: roomId,
      apartment: { organizationId },
    },
    select: {
      id: true,
      status: true,
      apartmentId: true,
      roomNo: true,
      apartment: { select: { name: true } },
    },
  });
};

/**
 * 根据房间ID查找预订记录
 * @param roomId - 房间唯一标识
 * @returns 预订记录对象，若不存在则返回null
 */
export const findReservationByRoomId = async (roomId: string) => {
  return prisma.reservation.findUnique({
    where: { roomId },
  });
};

/**
 * 创建或更新预订记录
 * @param data - 预订数据对象
 * @param data.roomId - 房间唯一标识
 * @param data.name - 客户姓名
 * @param data.phone - 客户电话
 * @param data.deposit - 预订定金金额
 * @param data.paymentMethod - 支付方式（可选）
 * @param data.expectedMoveInDate - 预计入住日期
 * @param data.organizationId - 组织唯一标识
 * @param data.userId - 操作用户唯一标识
 * @param data.roomStatus - 当前房间状态
 * @param data.apartmentId - 公寓唯一标识
 * @param data.roomNo - 房间号
 * @param data.apartmentName - 公寓名称
 * @returns 包含关联房间信息的预订记录对象
 */
export const upsertReservation = async (data: {
  roomId: string;
  name: string;
  phone: string;
  deposit: number;
  paymentMethod?: string | null;
  expectedMoveInDate: Date;
  organizationId: string;
  userId: string;
  roomStatus: string;
  apartmentId: string;
  roomNo: string;
  apartmentName: string;
}) => {
  const {
    roomId,
    name,
    phone,
    deposit,
    paymentMethod,
    expectedMoveInDate,
    organizationId,
    userId,
    roomStatus,
    apartmentId,
    roomNo,
    apartmentName,
  } = data;

  const existing = await findReservationByRoomId(roomId);

  return prisma.$transaction(async (tx) => {
    const reservationData = {
      name,
      phone,
      deposit,
      paymentMethod: deposit > 0 ? paymentMethod || null : null,
      expectedMoveInDate,
    };

    let reservationRecord;
    if (existing) {
      reservationRecord = await tx.reservation.update({
        where: { roomId },
        data: reservationData,
      });
    } else {
      reservationRecord = await tx.reservation.create({
        data: { roomId, ...reservationData },
      });
    }

    if (roomStatus !== 'RESERVED') {
      await tx.room.update({
        where: { id: roomId },
        data: { status: 'RESERVED' },
      });
    }

    if (deposit > 0) {
      await tx.transaction.create({
        data: {
          organizationId,
          type: 'INCOME',
          category: 'RESERVATION_FEE',
          amount: deposit,
          method: paymentMethod || '现金',
          description: `${apartmentName} - ${roomNo} 预订定金`,
          operatorId: userId,
          sourceType: 'RESERVATION',
          sourceId: reservationRecord.id,
          apartmentId,
        },
      });
    }

    return tx.reservation.findUniqueOrThrow({
      where: { roomId },
      include: { room: true },
    });
  });
};

/**
 * 删除预订记录并将房间状态重置为空闲
 * @param roomId - 房间唯一标识
 * @returns 无返回值
 */
export const deleteReservation = async (roomId: string) => {
  await prisma.$transaction([
    prisma.reservation.delete({ where: { roomId } }),
    prisma.room.update({
      where: { id: roomId },
      data: { status: 'VACANT' },
    }),
  ]);
};

/**
 * 根据房间ID获取预订记录
 * @param roomId - 房间唯一标识
 * @returns 预订记录对象，若不存在则返回null
 */
export const getReservationByRoomId = async (roomId: string) => {
  return prisma.reservation.findUnique({
    where: { roomId },
  });
};
