import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production mode!');
  }
  console.warn('⚠️ Warning: JWT_SECRET environment variable is not set. Falling back to development secret.');
}
const secretToUse = JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

export function signToken(payload) {
  return jwt.sign(payload, secretToUse, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, secretToUse);
}
