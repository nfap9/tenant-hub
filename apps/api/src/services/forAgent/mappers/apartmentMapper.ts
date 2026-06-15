import type { Prisma } from '@prisma/client';

type ApartmentWithRoomStats = Prisma.ApartmentGetPayload<{
  include: {
    _count: { select: { rooms: { where: { deletedAt: null } } } };
    rooms: { where: { deletedAt: null }; select: { status: true } };
  };
}>;

export function toAgentApartmentSummary(apartment: ApartmentWithRoomStats) {
  return {
    id: apartment.id,
    name: apartment.name,
    location: apartment.location,
    roomCount: apartment._count.rooms,
    occupiedCount: apartment.rooms.filter((r) => r.status === 'OCCUPIED')
      .length,
    vacantCount: apartment.rooms.filter((r) => r.status === 'VACANT').length,
  };
}
