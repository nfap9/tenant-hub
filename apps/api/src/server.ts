import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { app } from "./app.js";
import { ensureSystemRoles } from "./services/roles.js";

await ensureSystemRoles();

const server = app.listen(env.PORT, () => {
  console.info(`[TenantHub] API listening on http://localhost:${env.PORT}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
