import bcrypt from 'bcrypt';
import { User } from '../models/index.js';

export default async function userRoutes(fastify, opts) {
  // GET /api/users
  fastify.get('/', { preHandler: [fastify.authenticate] }, async () => {
    return User.findAll({ attributes: { exclude: ['password_hash'] }, order: [['name', 'ASC']] });
  });

  // GET /api/users/:id
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password_hash'] } });
    if (!user) return reply.status(404).send({ error: 'Not found' });
    return user;
  });

  // POST /api/users
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { password, ...rest } = req.body;
    const password_hash = await bcrypt.hash(password || 'Techavo@123', 10);
    const user = await User.create({ ...rest, password_hash });
    const { password_hash: _, ...userData } = user.toJSON();
    return reply.status(201).send(userData);
  });

  // PUT /api/users/:id
  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = await User.findByPk(req.params.id);
    if (!user) return reply.status(404).send({ error: 'Not found' });
    const { password, ...rest } = req.body;
    if (password) rest.password_hash = await bcrypt.hash(password, 10);
    await user.update(rest);
    const { password_hash: _, ...userData } = user.toJSON();
    return userData;
  });

  // DELETE /api/users/:id
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = await User.findByPk(req.params.id);
    if (!user) return reply.status(404).send({ error: 'Not found' });
    await user.update({ is_active: false });
    return { success: true };
  });
}
