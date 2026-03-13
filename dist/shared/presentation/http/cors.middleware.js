import { cors } from 'hono/cors';
export function createCorsMiddleware() {
    const origins = process.env.CORS_ALLOWED_ORIGINS;
    return cors({
        origin: origins ? origins.split(',').map((o) => o.trim()) : '*',
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: 86400,
    });
}
