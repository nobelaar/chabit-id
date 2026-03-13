import { Credential } from '../../domain/entities/Credential.entity.js';
import { CredentialId } from '../../domain/value-objects/CredentialId.vo.js';
import { Username } from '../../domain/value-objects/Username.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';

export class InMemoryCredentialRepository implements CredentialRepository {
  private readonly store: Map<string, Credential> = new Map();

  async save(credential: Credential): Promise<void> {
    this.store.set(credential.getId().toPrimitive(), credential);
  }
  async findById(id: CredentialId): Promise<Credential | null> {
    return this.store.get(id.toPrimitive()) ?? null;
  }
  async findByUsername(username: Username): Promise<Credential | null> {
    for (const c of this.store.values()) {
      if (c.getUsername().toPrimitive() === username.toPrimitive()) return c;
    }
    return null;
  }
  async findByIdentityRef(ref: IdentityRef): Promise<Credential | null> {
    for (const c of this.store.values()) {
      if (c.getIdentityRef().toPrimitive() === ref.toPrimitive()) return c;
    }
    return null;
  }
  async hardDelete(id: CredentialId): Promise<void> {
    this.store.delete(id.toPrimitive());
  }
}
