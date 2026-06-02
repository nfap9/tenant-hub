import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOrigins, env } from './config/env.js';
import { accountRouter } from './routes/accounts.js';
import { apartmentRouter } from './routes/apartments.js';
import { auditLogRouter } from './routes/auditLogs.js';
import { authRouter } from './routes/auth.js';
import { billRouter } from './routes/bills.js';
import { checklistRouter } from './routes/checklists.js';
import { dashboardRouter } from './routes/dashboard.js';
import { depositRouter } from './routes/deposits.js';
import { invoiceRouter } from './routes/invoices.js';
import { jobRouter } from './routes/jobs.js';
import { landlordContractRouter } from './routes/landlordContracts.js';
import { leaseRouter } from './routes/leases.js';
import { maintenanceRouter } from './routes/maintenance.js';
import { meterReadingRouter } from './routes/meterReadings.js';
import { meterRouter } from './routes/meters.js';
import { notificationRouter } from './routes/notifications.js';
import { orgRouter } from './routes/organizations.js';
import { paymentRouter } from './routes/payments.js';
import { permissionRouter } from './routes/permissions.js';
import { refundRouter } from './routes/refunds.js';
import { reportRouter } from './routes/reports.js';
import { roleRouter } from './routes/roles.js';
import { roomRouter } from './routes/rooms.js';
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

// Flow J: 组织权限
app.use('/api/auth', authRouter);
app.use('/api/organizations', orgRouter);
app.use('/api/roles', roleRouter);
app.use('/api/permissions', permissionRouter);

// Flow A: 物业初始化
app.use('/api/apartments', apartmentRouter);
app.use('/api/rooms', roomRouter);
app.use('/api/meters', meterRouter);
app.use('/api/landlord-contracts', landlordContractRouter);

// Flow B: 租客入驻 + Flow E: 退租结算 + Flow F: 租约变更
app.use('/api/leases', leaseRouter);
app.use('/api/tenants', tenantRouter);

// Flow C: 月度出账运营
app.use('/api/bills', billRouter);
app.use('/api/meter-readings', meterReadingRouter);

// Flow D: 收款核销
app.use('/api/payments', paymentRouter);

// Flow E: 退租结算 (押金)
app.use('/api/deposits', depositRouter);

// Flow B/E: 检查清单
app.use('/api/checklists', checklistRouter);

// Flow H: 维修工单
app.use('/api/maintenance-orders', maintenanceRouter);

// Flow I: 财务报表
app.use('/api/reports', reportRouter);

// Flow J + 支撑流程
app.use('/api/dashboard', dashboardRouter);
app.use('/api/audit-logs', auditLogRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/refunds', refundRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/accounts', accountRouter);
app.use('/api/jobs', jobRouter);

app.use(errorHandler);
