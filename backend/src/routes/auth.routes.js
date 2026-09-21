import bcrypt from 'bcrypt';
import { User } from '../models/index.js';
import { AuditLog } from '../models/index.js';

export default async function authRoutes(fastify, opts) {
  // POST /api/auth/login
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;

    const user = await User.findOne({ where: { email: email.toLowerCase(), is_active: true } });
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    await user.update({ last_login: new Date() });

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      scope_type: user.scope_type,
      scope_id: user.scope_id,
    }, { expiresIn: '24h' });

    await AuditLog.create({
      user_id: user.id,
      user_name: user.name,
      action: 'LOGIN',
      module: 'auth',
      object_type: 'user',
      object_id: String(user.id),
      ip_address: request.ip,
      description: `User ${user.email} logged in`,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        scope_type: user.scope_type,
        scope_id: user.scope_id,
      },
    };
  });

  // GET /api/auth/me
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = await User.findByPk(request.user.id, {
      attributes: { exclude: ['password_hash'] },
    });
    return user;
  });
}
