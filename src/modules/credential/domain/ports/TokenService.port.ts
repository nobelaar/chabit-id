import { UpdateToken } from '../value-objects/UpdateToken.vo.js';
import { SessionId } from '../value-objects/SessionId.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

export interface AccountSnapshot {
  id: string;
  type: string;
  status: string;
}

export interface AccessTokenPayload {
  sub: IdentityRef;
  sid: SessionId;
  username: string;
  accounts: AccountSnapshot[];
}

export interface TokenService {
  generateAccessToken(payload: AccessTokenPayload): string;
  generateUpdateToken(): UpdateToken;
  generateSessionId(): SessionId;
  generateChallengeToken(credentialId: string): string;
  verifyChallengeToken(token: string): string;
}
