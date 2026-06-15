import { findReservationByRoomIdRaw } from '../reservation.js';
import { toAgentReservation } from './mappers/index.js';

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
  const reservation = await findReservationByRoomIdRaw(roomId, organizationId);

  if (!reservation) {
    return { exists: false };
  }

  return toAgentReservation(reservation);
};
