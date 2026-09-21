import { Project, City, Zone, Ward, Street } from '../models/index.js';

export default async function organizationRoutes(fastify, opts) {
  // ── Projects ───────────────────────────────────────────────────
  fastify.get('/projects', { preHandler: [fastify.authenticate] }, async () =>
    Project.findAll({ order: [['name', 'ASC']] }));

  fastify.post('/projects', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const p = await Project.create(req.body);
    return reply.status(201).send(p);
  });

  fastify.put('/projects/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const p = await Project.findByPk(req.params.id);
    if (!p) return reply.status(404).send({ error: 'Not found' });
    await p.update(req.body); return p;
  });

  fastify.delete('/projects/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const p = await Project.findByPk(req.params.id);
    if (!p) return reply.status(404).send({ error: 'Not found' });
    await p.update({ status: 'inactive' }); return { success: true };
  });

  // ── Cities ─────────────────────────────────────────────────────
  fastify.get('/cities', { preHandler: [fastify.authenticate] }, async (req) => {
    const where = {};
    if (req.query.project_id) where.project_id = req.query.project_id;
    return City.findAll({ where, include: [{ model: Project, as: 'project' }], order: [['name', 'ASC']] });
  });

  fastify.post('/cities', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const c = await City.create(req.body);
    return reply.status(201).send(c);
  });

  fastify.put('/cities/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const c = await City.findByPk(req.params.id);
    if (!c) return reply.status(404).send({ error: 'Not found' });
    await c.update(req.body); return c;
  });

  // ── Zones ──────────────────────────────────────────────────────
  fastify.get('/zones', { preHandler: [fastify.authenticate] }, async (req) => {
    const where = {};
    if (req.query.city_id) where.city_id = req.query.city_id;
    return Zone.findAll({ where, include: [{ model: City, as: 'city' }], order: [['name', 'ASC']] });
  });

  fastify.post('/zones', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const z = await Zone.create(req.body);
    return reply.status(201).send(z);
  });

  fastify.put('/zones/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const z = await Zone.findByPk(req.params.id);
    if (!z) return reply.status(404).send({ error: 'Not found' });
    await z.update(req.body); return z;
  });

  // ── Wards ──────────────────────────────────────────────────────
  fastify.get('/wards', { preHandler: [fastify.authenticate] }, async (req) => {
    const where = {};
    if (req.query.zone_id) where.zone_id = req.query.zone_id;
    return Ward.findAll({ where, include: [{ model: Zone, as: 'zone' }], order: [['name', 'ASC']] });
  });

  fastify.post('/wards', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const w = await Ward.create(req.body);
    return reply.status(201).send(w);
  });

  fastify.put('/wards/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const w = await Ward.findByPk(req.params.id);
    if (!w) return reply.status(404).send({ error: 'Not found' });
    await w.update(req.body); return w;
  });

  // ── Streets ────────────────────────────────────────────────────
  fastify.get('/streets', { preHandler: [fastify.authenticate] }, async (req) => {
    const where = {};
    if (req.query.ward_id) where.ward_id = req.query.ward_id;
    return Street.findAll({ where, include: [{ model: Ward, as: 'ward' }], order: [['name', 'ASC']] });
  });

  fastify.post('/streets', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const s = await Street.create(req.body);
    return reply.status(201).send(s);
  });

  fastify.put('/streets/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const s = await Street.findByPk(req.params.id);
    if (!s) return reply.status(404).send({ error: 'Not found' });
    await s.update(req.body); return s;
  });
}
