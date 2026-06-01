import { Prisma } from '@prisma/client';

/**
 * 支持软删除的模型列表。
 * 必须与 schema.prisma 中定义了 deletedAt 字段的模型严格保持一致。
 */
const SOFT_DELETE_MODELS = [
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
] as const;

type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

const isSoftDeleteModel = (model: string): model is SoftDeleteModel =>
  (SOFT_DELETE_MODELS as readonly string[]).includes(model);

/**
 * Prisma Client Extension：类型安全的软删除 API
 *
 * 为所有软删除模型注入以下方法：
 * - softDelete / softDeleteMany
 * - restore / restoreMany
 * - findManyActive / findFirstActive / findFirstActiveOrThrow / countActive
 * - findManyWithDeleted（显式查询含已删除）
 */
export const softDeleteExtension = Prisma.defineExtension({
  name: 'softDelete',
  model: {
    $allModels: {
      /**
       * 单条软删除：将 delete 语义转为 update deletedAt
       */
      async softDelete<T>(
        this: T,
        args: Prisma.Args<T, 'delete'>
      ): Promise<
        Prisma.Result<T, Prisma.Args<T, 'delete'>, 'findUniqueOrThrow'>
      > {
        const context = Prisma.getExtensionContext(this);
        const model = context.$name as string;

        if (!isSoftDeleteModel(model)) {
          return (context as any).delete(args);
        }

        return (context as any).update({
          where: args.where,
          data: { deletedAt: new Date() } as any,
        });
      },

      /**
       * 批量软删除
       */
      async softDeleteMany<T>(
        this: T,
        args: Prisma.Args<T, 'deleteMany'>
      ): Promise<Prisma.Result<T, Prisma.Args<T, 'deleteMany'>, 'updateMany'>> {
        const context = Prisma.getExtensionContext(this);
        const model = context.$name as string;

        if (!isSoftDeleteModel(model)) {
          return (context as any).deleteMany(args);
        }

        return (context as any).updateMany({
          where: args.where,
          data: { deletedAt: new Date() } as any,
        });
      },

      /**
       * 单条恢复
       */
      async restore<T>(
        this: T,
        args: Prisma.Args<T, 'update'>
      ): Promise<
        Prisma.Result<T, Prisma.Args<T, 'update'>, 'findUniqueOrThrow'>
      > {
        const context = Prisma.getExtensionContext(this);
        return (context as any).update({
          ...args,
          data: { ...(args.data as any), deletedAt: null },
        });
      },

      /**
       * 批量恢复
       */
      async restoreMany<T>(
        this: T,
        args: Prisma.Args<T, 'updateMany'>
      ): Promise<Prisma.Result<T, Prisma.Args<T, 'updateMany'>, 'updateMany'>> {
        const context = Prisma.getExtensionContext(this);
        return (context as any).updateMany({
          ...args,
          data: { ...(args.data as any), deletedAt: null },
        });
      },

      /**
       * 查询活跃记录（自动过滤 deletedAt: null）
       */
      async findManyActive<T>(
        this: T,
        args?: Prisma.Args<T, 'findMany'>
      ): Promise<Prisma.Result<T, Prisma.Args<T, 'findMany'>, 'findMany'>> {
        const context = Prisma.getExtensionContext(this);
        const model = context.$name as string;

        if (!isSoftDeleteModel(model)) {
          return (context as any).findMany(args);
        }

        return (context as any).findMany({
          ...args,
          where: {
            ...(args as any)?.where,
            deletedAt: null,
          },
        });
      },

      /**
       * 查询单条活跃记录
       */
      async findFirstActive<T>(
        this: T,
        args?: Prisma.Args<T, 'findFirst'>
      ): Promise<Prisma.Result<T, Prisma.Args<T, 'findFirst'>, 'findFirst'>> {
        const context = Prisma.getExtensionContext(this);
        const model = context.$name as string;

        if (!isSoftDeleteModel(model)) {
          return (context as any).findFirst(args);
        }

        return (context as any).findFirst({
          ...args,
          where: {
            ...(args as any)?.where,
            deletedAt: null,
          },
        });
      },

      /**
       * 查询单条活跃记录，不存在则抛错
       */
      async findFirstActiveOrThrow<T>(
        this: T,
        args?: Prisma.Args<T, 'findFirstOrThrow'>
      ): Promise<
        Prisma.Result<T, Prisma.Args<T, 'findFirstOrThrow'>, 'findFirstOrThrow'>
      > {
        const context = Prisma.getExtensionContext(this);
        const model = context.$name as string;

        if (!isSoftDeleteModel(model)) {
          return (context as any).findFirstOrThrow(args);
        }

        return (context as any).findFirstOrThrow({
          ...args,
          where: {
            ...(args as any)?.where,
            deletedAt: null,
          },
        });
      },

      /**
       * 统计活跃记录数
       */
      async countActive<T>(
        this: T,
        args?: Prisma.Args<T, 'count'>
      ): Promise<Prisma.Result<T, Prisma.Args<T, 'count'>, 'count'>> {
        const context = Prisma.getExtensionContext(this);
        const model = context.$name as string;

        if (!isSoftDeleteModel(model)) {
          return (context as any).count(args);
        }

        return (context as any).count({
          ...args,
          where: {
            ...(args as any)?.where,
            deletedAt: null,
          },
        });
      },

      /**
       * 显式查询含已删除的记录（用于回收站等场景）
       */
      async findManyWithDeleted<T>(
        this: T,
        args?: Prisma.Args<T, 'findMany'>
      ): Promise<Prisma.Result<T, Prisma.Args<T, 'findMany'>, 'findMany'>> {
        const context = Prisma.getExtensionContext(this);
        return (context as any).findMany(args);
      },
    },
  },
});
