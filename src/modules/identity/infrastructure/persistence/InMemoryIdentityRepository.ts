import { Identity } from '../../domain/entities/Identity.entity.js';
import { IdentityId } from '../../domain/value-objects/IdentityId.vo.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { PhoneNumber } from '../../../../shared/domain/value-objects/PhoneNumber.vo.js';
import { IdentityRepository } from '../../domain/ports/IdentityRepository.port.js';

export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly store: Map<string, Identity> = new Map();

  async save(identity: Identity): Promise<void> {
    this.store.set(identity.getId().toPrimitive(), identity);
  }

  async findById(id: IdentityId): Promise<Identity | null> {
    return this.store.get(id.toPrimitive()) ?? null;
  }

  async findByEmail(email: Email): Promise<Identity | null> {
    for (const identity of this.store.values()) {
      if (identity.getEmail().toPrimitive() === email.toPrimitive()) return identity;
    }
    return null;
  }

  async findByPhone(phone: PhoneNumber): Promise<Identity | null> {
    for (const identity of this.store.values()) {
      if (identity.getPhone().toPrimitive() === phone.toPrimitive()) return identity;
    }
    return null;
  }

  async hardDelete(id: IdentityId): Promise<void> {
    this.store.delete(id.toPrimitive());
  }

  async anonymize(id: IdentityId): Promise<void> {
    this.store.delete(id.toPrimitive());
  }
}
