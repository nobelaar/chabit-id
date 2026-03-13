import { describe, it, expect, beforeEach } from 'vitest';
import { GetAccountsByIdentityUseCase } from './GetAccountsByIdentity.usecase.js';
import { CreateAccountUseCase } from './CreateAccount.usecase.js';
import { InMemoryAccountRepository } from '../../infrastructure/persistence/InMemoryAccountRepository.js';
import { InMemoryAccountEventRepository } from '../../infrastructure/persistence/InMemoryAccountEventRepository.js';
import { AccountNotFoundError } from '../../domain/errors/Account.errors.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { Account } from '../../domain/entities/Account.entity.js';

const OWNER_REF = '00000000-0000-4000-8000-000000000001';
const ADMIN_REF = '00000000-0000-4000-8000-000000000010';
const STRANGER_REF = '00000000-0000-4000-8000-000000000099';

describe('GetAccountsByIdentityUseCase', () => {
  let repo: InMemoryAccountRepository;
  let eventRepo: InMemoryAccountEventRepository;
  let useCase: GetAccountsByIdentityUseCase;
  let createAccount: CreateAccountUseCase;

  beforeEach(async () => {
    repo = new InMemoryAccountRepository();
    eventRepo = new InMemoryAccountEventRepository();
    useCase = new GetAccountsByIdentityUseCase(repo);
    createAccount = new CreateAccountUseCase(repo, eventRepo);
    await createAccount.execute({ identityRef: OWNER_REF, type: 'USER' });
  });

  const seedAdmin = async () => {
    const adminId = AccountId.generate();
    const adminAccount = Account.createAdmin(
      adminId,
      IdentityRef.fromPrimitive(ADMIN_REF),
      IdentityRef.fromPrimitive('00000000-0000-4000-8000-000000000098'),
    );
    await repo.save(adminAccount);
  };

  it('returns all accounts for self (owner)', async () => {
    const accounts = await useCase.execute({ identityRef: OWNER_REF, callerRef: OWNER_REF });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].type).toBe('USER');
  });

  it('returns accounts for ADMIN caller', async () => {
    await seedAdmin();
    const accounts = await useCase.execute({ identityRef: OWNER_REF, callerRef: ADMIN_REF });
    expect(accounts).toHaveLength(1);
  });

  it('throws AccountNotFoundError for non-self non-admin caller', async () => {
    await expect(
      useCase.execute({ identityRef: OWNER_REF, callerRef: STRANGER_REF }),
    ).rejects.toThrow(AccountNotFoundError);
  });
});
