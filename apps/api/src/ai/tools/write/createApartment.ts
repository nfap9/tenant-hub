import { z } from 'zod';
import { PERMISSIONS } from '../../../services/roles.js';
import { createApartment } from '../../../services/apartment.js';
import { apartmentInput } from '../../../routes/apartments.js';
import { prisma } from '../../../config/prisma.js';
import type { ToolMeta } from '../types.js';

// 与路由层创建公寓入参同源
const input = apartmentInput;

type Input = z.infer<typeof input>;

export const createApartmentTool: ToolMeta<Input, unknown> = {
  name: 'create_apartment',
  description:
    '在当前组织下新建公寓（仅创建公寓主体，不包含房间）。写操作，需用户确认。',
  inputSchema: input,
  permission: PERMISSIONS.APARTMENT_MANAGE,
  isWrite: true,

  async preview(inp, ctx) {
    const existing = await prisma.apartment.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: { equals: inp.name, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) throw new Error('公寓名称已存在');
    return {
      title: `新建公寓 · ${inp.name}`,
      riskLevel: 'medium',
      diff: [
        { field: '公寓名称', newValue: inp.name },
        { field: '公寓地址', newValue: inp.address },
        { field: '上游租金', newValue: inp.rentAmount },
        { field: '房东姓名', newValue: inp.landlordName },
        { field: '房东联系方式', newValue: inp.landlordPhone },
        { field: '合同开始日期', newValue: inp.contractStart },
        { field: '合同结束日期', newValue: inp.contractEnd },
        { field: '楼层数', newValue: inp.floors },
      ],
      description: '将创建一个新公寓记录；创建后还需另行批量添加房间。',
    };
  },

  async execute(inp, ctx) {
    const apartment = await createApartment({
      ...inp,
      organizationId: ctx.organizationId,
    });
    return {
      ok: true,
      data: { apartmentId: apartment.id, name: apartment.name },
      summary: `已创建公寓「${apartment.name}」（${apartment.address}）。`,
    };
  },
};
