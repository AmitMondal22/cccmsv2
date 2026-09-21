import { Notification } from '../models/index.js';
import { Op } from 'sequelize';

export default async function notificationRoutes(fastify, opts) {
  // GET /api/notifications
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req) => {
    const where = {};
    if (!req.user.role.includes('super')) {
      where.user_id = { [Op.or]: [req.user.id, null] };
    }
    const result = await Notification.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    const unread = await Notification.count({ where: { ...where, is_read: false } });
    return { data: result, unread };
  });

  // PUT /api/notifications/:id/read
  fastify.put('/:id/read', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const n = await Notification.findByPk(req.params.id);
    if (!n) return reply.status(404).send({ error: 'Not found' });
    await n.update({ is_read: true });
    return { success: true };
  });

  // PUT /api/notifications/read-all
  fastify.put('/read-all', { preHandler: [fastify.authenticate] }, async (req) => {
    await Notification.update({ is_read: true }, { where: { is_read: false } });
    return { success: true };
  });
}
