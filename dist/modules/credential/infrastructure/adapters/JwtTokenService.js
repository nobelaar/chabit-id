import jwt from 'jsonwebtoken';
import { UpdateToken } from '../../domain/value-objects/UpdateToken.vo.js';
import { SessionId } from '../../domain/value-objects/SessionId.vo.js';
import { randomUUID } from 'node:crypto';
const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes in seconds
export class JwtTokenService {
    secret;
    constructor(secret) {
        this.secret = secret;
    }
    generateAccessToken(payload) {
        return jwt.sign({
            sub: payload.sub.toPrimitive(),
            sid: payload.sid.toPrimitive(),
            username: payload.username,
            accounts: payload.accounts,
        }, this.secret, { expiresIn: ACCESS_TOKEN_TTL });
    }
    generateUpdateToken() {
        return UpdateToken.fromPrimitive(randomUUID());
    }
    generateSessionId() {
        return SessionId.fromPrimitive(randomUUID());
    }
}
