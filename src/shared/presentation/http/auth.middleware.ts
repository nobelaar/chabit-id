import type { MiddlewareHandler, Context } from 'hono';
import jwt from 'jsonwebtoken';
import { isTokenBlacklisted } from '../../infrastructure/redis/tokenBlacklist.js';

export interface JwtPayload {
  sub: string;
  sid: string;
  jti: string;
  username: string;
  accounts: Array<{ type: string; status: string }>;
  iat: number;
  exp: number;
}

declare module 'hono' {
  interface ContextVariableMap {
    jwtPayload: JwtPayload;
  }
}

export function createAuthMiddleware(secret: string): MiddlewareHandler {
  return async (c: Context, next) => {
    const authorization = c.req.header('Authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authorization.slice(7);

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, secret) as JwtPayload;
    } catch {
      return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401);
    }

    // Check if this specific token has been revoked (JWT blacklist)
    if (payload.jti) {
      const blacklisted = await isTokenBlacklisted(payload.jti);
      if (blacklisted) {
        return c.json({ error: 'Unauthorized', message: 'Token has been revoked' }, 401);
      }
    }

    c.set('jwtPayload', payload);
    await next();
  };
}
