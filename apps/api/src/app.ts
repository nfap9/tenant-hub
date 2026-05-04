import cors from "cors";
import express from "express";
import helmet from "helmet";
import { adminRouter } from "./routes/admin.js";
import { apartmentRouter } from "./routes/apartments.js";
import { authRouter } from "./routes/auth.js";
import { billRouter } from "./routes/bills.js";
import { leaseRouter } from "./routes/leases.js";
import { orgRouter } from "./routes/organizations.js";
import { errorHandler } from "./middleware/error.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/organizations", orgRouter);
app.use("/api/apartments", apartmentRouter);
app.use("/api/leases", leaseRouter);
app.use("/api/bills", billRouter);
app.use("/api/admin", adminRouter);
app.use(errorHandler);
