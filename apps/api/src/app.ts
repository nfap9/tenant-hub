import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins, env } from './config/env.js';
import { openApiDocument } from './openapi/index.js';
import { apartmentRouter } from './routes/apartments.js';
import { authRouter } from './routes/auth.js';
import { billRouter } from './routes/bills.js';
import { leaseRouter } from './routes/leases.js';
import { orgRouter } from './routes/organizations.js';
import { aiRouter } from './routes/ai.js';
import { aiModelsRouter } from './routes/aiModels.js';
import { adminRouter } from './routes/admin.js';
import { errorHandler } from './middleware/error.js';

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Swagger UI 依赖内联脚本/样式渲染，需放宽 CSP
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
app.use(
  cors({
    /**
     * CORS origin 校验回调
     * 非生产环境或无 origin 时允许通过；生产环境仅允许配置的域名
     * @param origin - 请求来源
     * @param callback - CORS 校验回调
     */
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

/**
 * GET /health
 * 健康检查端点
 */
app.get('/health', (_req, res) => res.json({ ok: true }));

// OpenAPI 文档：/api-docs 为 Swagger UI，/api-docs.json 为原始 spec
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get('/api-docs.json', (_req, res) => res.json(openApiDocument));

app.use('/api/auth', authRouter);
app.use('/api/organizations', orgRouter);
app.use('/api/apartments', apartmentRouter);
app.use('/api/leases', leaseRouter);
app.use('/api/bills', billRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ai-models', aiModelsRouter);
app.use('/api/admin', adminRouter);
app.use(errorHandler);
