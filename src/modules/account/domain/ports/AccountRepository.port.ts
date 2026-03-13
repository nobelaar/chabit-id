import { Account } from '../entities/Account.entity.js';
import { AccountId } from '../value-objects/AccountId.vo.js';
import { AccountType } from '../value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

export interface AccountRepository {
  save(account: Account): Promise<void>;
  findById(id: AccountId): Promise<Account | null>;
  findByIdentityRef(ref: IdentityRef): Promise<Account[]>;
  findByIdentityRefAndType(ref: IdentityRef, type: AccountType): Promise<Account | null>;
  findActiveByIdentityRef(ref: IdentityRef): Promise<Account[]>;
  hardDelete(id: AccountId): Promise<void>;
}
