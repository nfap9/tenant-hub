import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMeter = {
  id: 'meter-1',
  organizationId: 'org-1',
  apartmentId: 'apt-1',
  roomId: 'room-1',
  name: '水表-101',
  meterType: 'WATER',
  meterNo: 'WM-001',
  status: 'ACTIVE',
  parentId: null,
  removeDate: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockReading = {
  id: 'reading-1',
  meterId: 'meter-1',
  readingDate: new Date('2026-06-01'),
  value: 120,
  status: 'NORMAL',
};

vi.mock('../../src/prisma/client.js', () => ({
  prisma: {
    meter: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    meterReading: {
      findFirst: vi.fn(),
    },
  },
}));

import {
  createMeter,
  replaceMeter,
  getLatestReading,
  getActiveMeterForRoom,
} from '../../src/services/meter.js';
import { prisma } from '../../src/prisma/client.js';

describe('meter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMeter', () => {
    it('should create a meter record', async () => {
      (prisma.meter.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMeter
      );

      const result = await createMeter({
        organizationId: 'org-1',
        apartmentId: 'apt-1',
        roomId: 'room-1',
        name: '水表-101',
        meterType: 'WATER',
        meterNo: 'WM-001',
      });

      expect(result).toEqual(mockMeter);
      expect(prisma.meter.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          apartmentId: 'apt-1',
          roomId: 'room-1',
          name: '水表-101',
          meterType: 'WATER',
          meterNo: 'WM-001',
        },
      });
    });

    it('should create a meter without optional fields', async () => {
      (prisma.meter.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockMeter,
        roomId: undefined,
        meterNo: undefined,
      });

      const result = await createMeter({
        organizationId: 'org-1',
        apartmentId: 'apt-1',
        name: '总电表',
        meterType: 'POWER',
      });

      expect(result).toBeDefined();
      expect(prisma.meter.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          apartmentId: 'apt-1',
          name: '总电表',
          meterType: 'POWER',
        },
      });
    });
  });

  describe('replaceMeter', () => {
    it('should replace an active meter', async () => {
      (prisma.meter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMeter
      );
      (prisma.meter.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockMeter,
        status: 'REMOVED',
      });
      (prisma.meter.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockMeter,
        id: 'meter-2',
        name: '新水表-101',
      });

      const result = await replaceMeter('meter-1', { name: '新水表-101' });

      expect(result.id).toBe('meter-2');
      expect(prisma.meter.update).toHaveBeenCalledWith({
        where: { id: 'meter-1' },
        data: { status: 'REMOVED', removeDate: expect.any(Date) },
      });
      expect(prisma.meter.create).toHaveBeenCalled();
    });

    it('should throw 404 if old meter not found', async () => {
      (prisma.meter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(
        replaceMeter('meter-missing', { name: '新表' })
      ).rejects.toThrow('表具不存在');
    });

    it('should throw 400 if old meter is not ACTIVE', async () => {
      (prisma.meter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockMeter,
        status: 'REMOVED',
      });

      await expect(replaceMeter('meter-1', { name: '新表' })).rejects.toThrow(
        '仅活跃表具可以更换'
      );
    });

    it('should inherit common fields from old meter', async () => {
      (prisma.meter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMeter
      );
      (prisma.meter.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockMeter,
        status: 'REMOVED',
      });
      (prisma.meter.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockMeter,
        id: 'meter-2',
      });

      await replaceMeter('meter-1', {});

      expect(prisma.meter.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          apartmentId: 'apt-1',
          roomId: 'room-1',
          name: '水表-101',
          meterType: 'WATER',
          parentId: null,
        }),
      });
    });
  });

  describe('getLatestReading', () => {
    it('should get latest reading before a date', async () => {
      (
        prisma.meterReading.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockReading);

      const result = await getLatestReading('meter-1', new Date('2026-06-15'));

      expect(result).toEqual(mockReading);
    });

    it('should return null if no reading exists', async () => {
      (
        prisma.meterReading.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await getLatestReading('meter-1', new Date('2026-01-01'));

      expect(result).toBeNull();
    });
  });

  describe('getActiveMeterForRoom', () => {
    it('should find active meter for a room and type', async () => {
      (prisma.meter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMeter
      );

      const result = await getActiveMeterForRoom('room-1', 'WATER');

      expect(result).toEqual(mockMeter);
      expect(prisma.meter.findFirst).toHaveBeenCalledWith({
        where: {
          roomId: 'room-1',
          meterType: 'WATER',
          status: 'ACTIVE',
          deletedAt: null,
        },
      });
    });

    it('should return null if no active meter found', async () => {
      (prisma.meter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const result = await getActiveMeterForRoom('room-1', 'GAS');

      expect(result).toBeNull();
    });
  });
});
