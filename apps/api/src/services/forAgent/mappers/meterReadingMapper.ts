import type { Prisma } from '@prisma/client';

type MeterReadingWithRelations = Prisma.MeterReadingGetPayload<{
  include: {
    room: {
      select: {
        roomNo: true;
        apartment: { select: { name: true } };
      };
    };
    createdBy: { select: { username: true } };
  };
}>;

export function toAgentMeterReading(reading: MeterReadingWithRelations) {
  return {
    id: reading.id,
    roomNo: reading.room.roomNo,
    apartmentName: reading.room.apartment.name,
    meterType: reading.meterType,
    readingDate: reading.readingDate.toISOString().split('T')[0],
    value: Number(reading.value),
    source: reading.source,
    status: reading.status,
    note: reading.note,
    createdBy: reading.createdBy?.username ?? null,
  };
}
