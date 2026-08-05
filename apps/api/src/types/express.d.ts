import type { SystemRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        phone: string;
        username: string;
        systemRole: SystemRole | null;
      };
      organizationId?: string;
      permissions?: string[];
      systemPermissions?: string[];
    }
  }
}

export {};
