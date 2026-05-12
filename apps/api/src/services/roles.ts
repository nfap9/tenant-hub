import { prisma } from "../config/prisma.js";

export const PERMISSIONS = {
  APARTMENT_VIEW: "apartment:view",
  APARTMENT_MANAGE: "apartment:manage",
  ROOM_VIEW: "room:view",
  ROOM_MANAGE: "room:manage",
  LEASE_VIEW: "lease:view",
  LEASE_MANAGE: "lease:manage",
  BILL_VIEW: "bill:view",
  BILL_MANAGE: "bill:manage",
  ORG_MANAGE: "org:manage",
  MEMBER_MANAGE: "member:manage"
} as const;

export const ensureSystemRoles = async (
  db: Pick<typeof prisma, "role"> = prisma
) => {
  const roles = [
    { code: "owner", name: "所有者", description: "组织所有权限", permissions: ["*"] },
    {
      code: "manager",
      name: "管家",
      description: "管理公寓、房间、租约、账单",
      permissions: [
        PERMISSIONS.APARTMENT_VIEW,
        PERMISSIONS.APARTMENT_MANAGE,
        PERMISSIONS.ROOM_VIEW,
        PERMISSIONS.ROOM_MANAGE,
        PERMISSIONS.LEASE_VIEW,
        PERMISSIONS.LEASE_MANAGE,
        PERMISSIONS.BILL_VIEW,
        PERMISSIONS.BILL_MANAGE
      ]
    },
    {
      code: "readonly",
      name: "只读成员",
      description: "查看公寓、房间、租约、账单",
      permissions: [
        PERMISSIONS.APARTMENT_VIEW,
        PERMISSIONS.ROOM_VIEW,
        PERMISSIONS.LEASE_VIEW,
        PERMISSIONS.BILL_VIEW
      ]
    }
  ];

  await Promise.all(
    roles.map((role) =>
      db.role.upsert({
        where: { code: role.code },
        create: { ...role, system: true },
        update: { name: role.name, description: role.description, permissions: role.permissions, system: true }
      })
    )
  );
};
