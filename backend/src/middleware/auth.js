export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
  }
}

export function requireRole(...roles) {
  return async function (request, reply) {
    await authenticate(request, reply);
    if (reply.sent) return;
    if (!roles.includes(request.user.role)) {
      reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
  };
}

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PROJECT_ADMIN: 'project_admin',
  CITY_USER: 'city_user',
  ZONE_USER: 'zone_user',
  WARD_USER: 'ward_user',
  MAINTENANCE_USER: 'maintenance_user',
};

export const ADMIN_ROLES = ['super_admin', 'project_admin'];
