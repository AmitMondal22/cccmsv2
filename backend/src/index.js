import 'dotenv/config';

// Enforce Indian Standard Time globally across all server operations & logs
process.env.TZ = 'Asia/Kolkata';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { sequelize } from './models/index.js';
import { startUDPServer, startOfflineDetector } from './telemetry/udpServer.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import deviceRoutes from './routes/device.routes.js';
import alertRoutes from './routes/alert.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import organizationRoutes from './routes/organization.routes.js';
import userRoutes from './routes/user.routes.js';
import auditRoutes from './routes/audit.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import reportRoutes from './routes/report.routes.js';
import energyRoutes from './routes/energy.routes.js';

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    },
  },
});

// ── Plugins ──────────────────────────────────────────────────────
await fastify.register(cors, {
  origin: (origin, cb) => {
    // Allow all origins (reflect requesting origin to support credentials: true)
    cb(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers'],
  exposedHeaders: ['*'],
  maxAge: 86400,
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'techavo_jwt_secret',
});

// Decorate fastify with authenticate helper
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// ── Routes ────────────────────────────────────────────────────────
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
await fastify.register(deviceRoutes, { prefix: '/api/devices' });
await fastify.register(alertRoutes, { prefix: '/api/alerts' });
await fastify.register(maintenanceRoutes, { prefix: '/api/maintenance' });
await fastify.register(organizationRoutes, { prefix: '/api/org' });
await fastify.register(userRoutes, { prefix: '/api/users' });
await fastify.register(auditRoutes, { prefix: '/api/audit' });
await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
await fastify.register(reportRoutes, { prefix: '/api/reports' });
await fastify.register(energyRoutes, { prefix: '/api/energy' });

// Health check
fastify.get('/api/health', async () => ({
  status: 'ok',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}));

// ── Start ─────────────────────────────────────────────────────────
async function start() {
  try {
    // DB connection
    await sequelize.authenticate();
    fastify.log.info('✅ PostgreSQL connected');

    // Sync models
    await sequelize.sync({ alter: true });
    fastify.log.info('✅ Models synced');

    // Start HTTP server
    const port = parseInt(process.env.PORT) || 3000;
    const host = process.env.HOST || '0.0.0.0';
    await fastify.listen({ port, host });

    // Start UDP telemetry server
    startUDPServer();

    // Start background offline detector
    startOfflineDetector();

    fastify.log.info(`🚀 Techavo CCMS API running at http://localhost:${port}`);
    fastify.log.info(`📡 UDP Telemetry server on port ${process.env.UDP_PORT || 9000}`);

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
