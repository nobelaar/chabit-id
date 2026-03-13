import { Session } from '../../domain/entities/Session.entity.js';
import { SessionId } from '../../domain/value-objects/SessionId.vo.js';
import { UpdateToken } from '../../domain/value-objects/UpdateToken.vo.js';
import { CredentialId } from '../../domain/value-objects/CredentialId.vo.js';
import { SessionRepository } from '../../domain/ports/SessionRepository.port.js';

export class InMemorySessionRepository implements SessionRepository {
  private readonly store: Map<string, Session> = new Map();

  async save(session: Session): Promise<void> {
    this.store.set(session.getId().toPrimitive(), session);
  }
  async findByUpdateToken(token: UpdateToken): Promise<Session | null> {
    for (const s of this.store.values()) {
      if (s.getUpdateToken().toPrimitive() === token.toPrimitive()) return s;
    }
    return null;
  }
  async findAllByCredentialId(credentialId: CredentialId): Promise<Session[]> {
    return [...this.store.values()].filter(s => s.getCredentialId().toPrimitive() === credentialId.toPrimitive());
  }
  async deleteById(id: SessionId): Promise<void> {
    this.store.delete(id.toPrimitive());
  }
  async deleteAllByCredentialId(credentialId: CredentialId): Promise<void> {
    for (const [key, s] of this.store) {
      if (s.getCredentialId().toPrimitive() === credentialId.toPrimitive()) this.store.delete(key);
    }
  }
  async deleteAllByCredentialIdExcept(credentialId: CredentialId, exceptSessionId: SessionId): Promise<void> {
    for (const [key, s] of this.store) {
      if (s.getCredentialId().toPrimitive() === credentialId.toPrimitive() &&
          s.getId().toPrimitive() !== exceptSessionId.toPrimitive()) {
        this.store.delete(key);
      }
    }
  }
  async deleteExpiredByCredentialId(credentialId: CredentialId): Promise<void> {
    for (const [key, s] of this.store) {
      if (s.getCredentialId().toPrimitive() === credentialId.toPrimitive() && s.isExpired()) {
        this.store.delete(key);
      }
    }
  }
  async countActiveByCredentialId(credentialId: CredentialId): Promise<number> {
    return [...this.store.values()].filter(
      s => s.getCredentialId().toPrimitive() === credentialId.toPrimitive() && !s.isExpired()
    ).length;
  }
  async deleteOldestByCredentialId(credentialId: CredentialId): Promise<void> {
    const sessions = [...this.store.values()]
      .filter(s => s.getCredentialId().toPrimitive() === credentialId.toPrimitive())
      .sort((a, b) => a.getLastUsedAt().getTime() - b.getLastUsedAt().getTime());
    if (sessions.length > 0) {
      this.store.delete(sessions[0].getId().toPrimitive());
    }
  }
}
