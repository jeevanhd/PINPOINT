import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from './errors';

export interface TokenPayload {
  sub: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  } as SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !decoded.sub) throw new Error('missing subject');
    return { sub: String(decoded.sub) };
  } catch {
    throw unauthorized('Session expired, sign in again');
  }
}
