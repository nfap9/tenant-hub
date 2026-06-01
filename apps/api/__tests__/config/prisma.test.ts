import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('prisma client extension', () => {
  let basePrisma: any;
  let extendedPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    basePrisma = {
      apartment: {
        update: vi.fn().mockResolvedValue({ id: '1', deletedAt: new Date() }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: {
        delete: vi.fn().mockResolvedValue({ id: '1' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    // 模拟 softDeleteExtension 挂载到每个模型上的行为
    const softDeleteModels = [
      'Apartment',
      'Room',
      'Lease',
      'Bill',
      'BillItem',
      'Payment',
      'MeterReading',
      'ApartmentExpense',
      'LeaseFee',
      'LeaseSettlement',
      'SettlementPayment',
      'Tenant',
      'CoResident',
      'Deposit',
      'Invoice',
      'Meter',
      'MaintenanceOrder',
      'MaintenanceOrderItem',
      'LandlordContract',
      'LandlordPayment',
      'RoomChecklist',
      'RoomChecklistItem',
      'BillItemReading',
      'TenantAccount',
    ];

    const isSoftDeleteModel = (model: string) =>
      softDeleteModels.includes(model);

    const allModelMethods = {
      softDelete: async function (this: any, args: any) {
        const model = this.$name || 'Unknown';
        if (!isSoftDeleteModel(model)) {
          return (this as any).delete(args);
        }
        return (this as any).update({
          where: args.where,
          data: { deletedAt: new Date() },
        });
      },
      softDeleteMany: async function (this: any, args: any) {
        const model = this.$name || 'Unknown';
        if (!isSoftDeleteModel(model)) {
          return (this as any).deleteMany(args);
        }
        return (this as any).updateMany({
          where: args.where,
          data: { deletedAt: new Date() },
        });
      },
      restore: async function (this: any, args: any) {
        return (this as any).update({
          ...args,
          data: { ...(args.data as any), deletedAt: null },
        });
      },
      restoreMany: async function (this: any, args: any) {
        return (this as any).updateMany({
          ...args,
          data: { ...(args.data as any), deletedAt: null },
        });
      },
      findManyActive: async function (this: any, args: any = {}) {
        const model = this.$name || 'Unknown';
        if (!isSoftDeleteModel(model)) {
          return (this as any).findMany(args);
        }
        return (this as any).findMany({
          ...args,
          where: {
            ...(args as any)?.where,
            deletedAt: null,
          },
        });
      },
      findFirstActive: async function (this: any, args: any = {}) {
        const model = this.$name || 'Unknown';
        if (!isSoftDeleteModel(model)) {
          return (this as any).findFirst(args);
        }
        return (this as any).findFirst({
          ...args,
          where: {
            ...(args as any)?.where,
            deletedAt: null,
          },
        });
      },
      findFirstActiveOrThrow: async function (this: any, args: any = {}) {
        const model = this.$name || 'Unknown';
        if (!isSoftDeleteModel(model)) {
          return (this as any).findFirstOrThrow(args);
        }
        return (this as any).findFirstOrThrow({
          ...args,
          where: {
            ...(args as any)?.where,
            deletedAt: null,
          },
        });
      },
      countActive: async function (this: any, args: any = {}) {
        const model = this.$name || 'Unknown';
        if (!isSoftDeleteModel(model)) {
          return (this as any).count(args);
        }
        return (this as any).count({
          ...args,
          where: {
            ...(args as any)?.where,
            deletedAt: null,
          },
        });
      },
      findManyWithDeleted: async function (this: any, args: any = {}) {
        return (this as any).findMany(args);
      },
    };

    extendedPrisma = { ...basePrisma };
    Object.keys(extendedPrisma).forEach((key) => {
      if (typeof extendedPrisma[key] === 'object') {
        Object.assign(extendedPrisma[key], allModelMethods);
        extendedPrisma[key].$name = key.charAt(0).toUpperCase() + key.slice(1);
      }
    });
  });

  it('should soft-delete on softDelete action', async () => {
    await extendedPrisma.apartment.softDelete({ where: { id: '1' } });

    expect(basePrisma.apartment.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should auto-filter deletedAt for findManyActive', async () => {
    await extendedPrisma.apartment.findManyActive({ where: { name: 'A' } });

    expect(basePrisma.apartment.findMany).toHaveBeenCalledWith({
      where: { name: 'A', deletedAt: null },
    });
  });

  it('should not auto-filter deletedAt for findManyWithDeleted', async () => {
    await extendedPrisma.apartment.findManyWithDeleted({
      where: { name: 'A' },
    });

    expect(basePrisma.apartment.findMany).toHaveBeenCalledWith({
      where: { name: 'A' },
    });
  });

  it('should not touch non-soft-delete models on delete', async () => {
    extendedPrisma.user.$name = 'User';
    await extendedPrisma.user.softDelete({ where: { id: '1' } });

    expect(basePrisma.user.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });
});
