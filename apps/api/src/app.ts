import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOrigins, env } from './config/env.js';
import { adminRouter } from './routes/admin.js';
import { apartmentRouter } from './routes/apartments.js';
import { auditLogRouter } from './routes/auditLogs.js';
import { authRouter } from './routes/auth.js';
import { billRouter } from './routes/bills.js';
import { cashierJournalRouter } from './routes/cashierJournals.js';
import { coResidentRouter } from './routes/coResidents.js';
import { depositRouter } from './routes/deposits.js';
import { invoiceRouter } from './routes/invoices.js';
import { landlordPaymentRouter } from './routes/landlordPayments.js';
import { leaseRouter } from './routes/leases.js';
import { maintenanceRouter } from './routes/maintenance.js';
import { meterRouter } from './routes/meters.js';
import { orgRouter } from './routes/organizations.js';
import { platformRouter } from './routes/platform.js';
import { notificationRouter } from './routes/notifications.js';
import { reportRouter } from './routes/reports.js';
import { refundRouter } from './routes/refunds.js';
import { accountRouter } from './routes/accounts.js';
import { roomChecklistRouter } from './routes/roomChecklists.js';
import { uploadRouter } from './routes/uploads.js';
import { tenantRouter } from './routes/tenants.js';
import { errorHandler } from './middleware/error.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.NODE_ENV !== 'production') {
        callback(null, true);
        return;
      }
      // 允许配置的域名
      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/organizations', orgRouter);
app.use('/api/apartments', apartmentRouter);
app.use('/api/leases', leaseRouter);
app.use('/api/bills', billRouter);
app.use('/api/deposits', depositRouter);
app.use('/api/meters', meterRouter);
app.use('/api/tenants', tenantRouter);
app.use('/api/admin', adminRouter);
app.use('/api/platform', platformRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/room-checklists', roomChecklistRouter);
app.use('/api/landlord-payments', landlordPaymentRouter);
app.use('/api/co-residents', coResidentRouter);
app.use('/api/cashier-journals', cashierJournalRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/audit-logs', auditLogRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/reports', reportRouter);
app.use('/api/refunds', refundRouter);
app.use('/api/accounts', accountRouter);
app.use('/api/uploads', uploadRouter);
app.use('/uploads', express.static('uploads'));
app.use(errorHandler);
