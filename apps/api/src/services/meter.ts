import { prisma } from '../config/prisma.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { HttpError } from '../utils/http.js';

dayjs.extend(utc);

export const createMeter = async (data: {
  organizationId: string;
  apartmentId: string;
  roomId?: string;
  name: string;
  meterType: 'WATER' | 'POWER' | 'GAS';
  meterNo?: string;
  parentId?: string;
}) => {
  return prisma.meter.create({ data });
};

export const replaceMeter = async (
  oldMeterId: string,
  newData: {
    name?: string;
    meterNo?: string;
  }
) => {
  const oldMeter = await prisma.meter.findUnique({
    where: { id: oldMeterId },
  });
  if (!oldMeter) throw new HttpError(404, '表具不存在');
  if (oldMeter.status !== 'ACTIVE')
    throw new HttpError(400, '仅活跃表具可以更换');

  const now = new Date();
  await prisma.meter.update({
    where: { id: oldMeterId },
    data: { status: 'REMOVED', removeDate: now },
  });

  return prisma.meter.create({
    data: {
      organizationId: oldMeter.organizationId,
      apartmentId: oldMeter.apartmentId,
      roomId: oldMeter.roomId,
      name: newData.name ?? oldMeter.name,
      meterType: oldMeter.meterType,
      meterNo: newData.meterNo ?? undefined,
      parentId: oldMeter.parentId,
    },
  });
};

export const getLatestReading = async (meterId: string, asOfDate: Date) => {
  return prisma.meterReading.findFirst({
    where: {
      meterId,
      readingDate: { lte: dayjs.utc(asOfDate).endOf('day').toDate() },
      status: { not: 'VOID' },
    },
    orderBy: { readingDate: 'desc' },
  });
};

export const getActiveMeterForRoom = async (
  roomId: string,
  meterType: string
) => {
  return prisma.meter.findFirst({
    where: {
      roomId,
      meterType: meterType as 'WATER' | 'POWER' | 'GAS',
      status: 'ACTIVE',
      deletedAt: null,
    },
  });
};
