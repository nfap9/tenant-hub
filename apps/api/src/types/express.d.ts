import type { AuthUser } from "../middleware/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      organizationId?: string;
      permissions?: string[];
    }
  }
}

export {};
