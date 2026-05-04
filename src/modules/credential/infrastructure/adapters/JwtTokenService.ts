import jwt from 'jsonwebtoken';
import { TokenService, AccessTokenPayload } from '../../domain/ports/TokenService.port.js';
import { UpdateToken } from '../../domain/value-objects/UpdateToken.vo.js';
import { SessionId } from '../../domain/value-objects/SessionId.vo.js';
import { randomUUID } from 'node:crypto';

const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes in seconds

export class JwtTokenService implements TokenService {
  constructor(private readonly secret: string) {}

  generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(
      {
        sub: payload.sub.toPrimitive(),
        sid: payload.sid.toPrimitive(),
        jti: randomUUID(),
        username: payload.username,
        accounts: payload.accounts,
      },
      this.secret,
      { expiresIn: ACCESS_TOKEN_TTL },
    );
  }

  generateUpdateToken(): UpdateToken {
    return UpdateToken.fromPrimitive(randomUUID());
  }

  generateSessionId(): SessionId {
    return SessionId.fromPrimitive(randomUUID());
  }

  generateChallengeToken(credentialId: string): string {
    return jwt.sign({ type: 'totp_challenge', credentialId }, this.secret, { expiresIn: 5 * 60 });
  }

  verifyChallengeToken(token: string): string {
    const payload = jwt.verify(token, this.secret) as { type: string; credentialId: string };
    if (payload.type !== 'totp_challenge') throw new Error('invalid token type');
    return payload.credentialId;
  }
}
