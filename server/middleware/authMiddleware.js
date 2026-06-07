import { verifyToken } from '../lib/jwt.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing.' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid authorization token.' });
  }
}

export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const role = req.user.role || 'user';
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions.' });
    }
    next();
  };
}
