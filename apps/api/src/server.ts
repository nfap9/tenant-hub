import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { app } from "./app.js";
import { ensureSystemRoles } from "./services/roles.js";
import { ensurePlatformAdmin } from "./services/adminInit.js";
import { startScheduler } from "./services/scheduler.js";

await ensureSystemRoles();
await ensurePlatformAdmin();

const server = app.listen(env.PORT, () => {
  console.info(`[TenantHub] API listening on http://localhost:${env.PORT}`);
});

if (env.SCHEDULER_ENABLED === "true") {
  startScheduler();
}

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
