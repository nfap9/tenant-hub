import cors from "cors";
import express from "express";
import helmet from "helmet";
import { corsOrigins, env } from "./config/env.js";
import { adminRouter } from "./routes/admin.js";
import { apartmentRouter } from "./routes/apartments.js";
import { authRouter } from "./routes/auth.js";
import { billRouter } from "./routes/bills.js";
import { leaseRouter } from "./routes/leases.js";
import { orgRouter } from "./routes/organizations.js";
import { platformRouter } from "./routes/platform.js";
import { errorHandler } from "./middleware/error.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.NODE_ENV !== "production" || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    }
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/organizations", orgRouter);
app.use("/api/apartments", apartmentRouter);
app.use("/api/leases", leaseRouter);
app.use("/api/bills", billRouter);
app.use("/api/admin", adminRouter);
app.use("/platform", platformRouter);
app.use(errorHandler);
