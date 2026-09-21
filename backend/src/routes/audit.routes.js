import { AuditLog, User } from '../models/index.js';
import { Op } from 'sequelize';

export default async function auditRoutes(fastify, opts) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req) => {
    const { page = 1, limit = 50, module, user_id, from, to } = req.query;
    const where = {};
    if (module) where.module = module;
    if (user_id) where.user_id = user_id;
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }
    const result = await AuditLog.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    return { data: result.rows, total: result.count, page: parseInt(page) };
  });
}
