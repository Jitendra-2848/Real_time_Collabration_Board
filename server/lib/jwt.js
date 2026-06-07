import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'dev_access_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';

const ACCESS_EXPIRY = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export function signAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_ACCESS_SECRET);
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

// Backward compatibility
export function signToken(payload) {
  return signAccessToken(payload);
}

export function verifyToken(token) {
  return verifyAccessToken(token);
}
