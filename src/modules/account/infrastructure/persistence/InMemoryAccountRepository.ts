import { Account } from '../../domain/entities/Account.entity.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';

export class InMemoryAccountRepository implements AccountRepository {
  private readonly store: Map<string, Account> = new Map();

  async save(account: Account): Promise<void> { this.store.set(account.getId().toPrimitive(), account); }
  async findById(id: AccountId): Promise<Account | null> { return this.store.get(id.toPrimitive()) ?? null; }
  async findByIdentityRef(ref: IdentityRef): Promise<Account[]> {
    return [...this.store.values()].filter(a => a.getIdentityRef().toPrimitive() === ref.toPrimitive());
  }
  async findByIdentityRefAndType(ref: IdentityRef, type: AccountType): Promise<Account | null> {
    for (const a of this.store.values()) {
      if (a.getIdentityRef().toPrimitive() === ref.toPrimitive() && a.getType().toPrimitive() === type.toPrimitive()) return a;
    }
    return null;
  }
  async findActiveByIdentityRef(ref: IdentityRef): Promise<Account[]> {
    return [...this.store.values()].filter(
      a => a.getIdentityRef().toPrimitive() === ref.toPrimitive() && a.getStatus().isActive()
    );
  }
  async hardDelete(id: AccountId): Promise<void> { this.store.delete(id.toPrimitive()); }
}
