import { Session } from '../entities/Session.entity.js';
import { SessionId } from '../value-objects/SessionId.vo.js';
import { UpdateToken } from '../value-objects/UpdateToken.vo.js';
import { CredentialId } from '../value-objects/CredentialId.vo.js';

export interface SessionRepository {
  save(session: Session): Promise<void>;
  findByUpdateToken(token: UpdateToken): Promise<Session | null>;
  findAllByCredentialId(credentialId: CredentialId): Promise<Session[]>;
  deleteById(id: SessionId): Promise<void>;
  deleteAllByCredentialId(credentialId: CredentialId): Promise<void>;
  deleteAllByCredentialIdExcept(credentialId: CredentialId, exceptSessionId: SessionId): Promise<void>;
  deleteExpiredByCredentialId(credentialId: CredentialId): Promise<void>;
  countActiveByCredentialId(credentialId: CredentialId): Promise<number>;
  deleteOldestByCredentialId(credentialId: CredentialId): Promise<void>;
}
