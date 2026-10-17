/**
 * Role-Based Access Control Middleware
 * Validates user roles for route protection.
 *
 * Roles: HOST, NGO, ADMIN, GUEST
 * Usage: router.get('/protected', rbac('ADMIN', 'NGO'), handler)
 */

function rbac(...allowedRoles) {
  return (req, res, next) => {
    const role = req.headers['x-role'] || req.query.role || 'GUEST';
    req.userRole = role;
    req.ngoId = req.headers['x-ngo-id'] || req.query.ngoId || null;

    if (allowedRoles.includes('*') || allowedRoles.includes(role)) {
      return next();
    }

    return res.status(403).json({
      error: 'Access denied',
      message: `This endpoint requires one of: ${allowedRoles.join(', ')}`,
      yourRole: role
    });
  };
}

module.exports = { rbac };
