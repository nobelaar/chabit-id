import { describe, it, expect, beforeEach } from 'vitest';
import { CreateAccountUseCase } from './CreateAccount.usecase.js';
import { InMemoryAccountRepository } from '../../infrastructure/persistence/InMemoryAccountRepository.js';
import { InMemoryAccountEventRepository } from '../../infrastructure/persistence/InMemoryAccountEventRepository.js';
import { AccountAlreadyExistsError } from '../../domain/errors/Account.errors.js';

const ID_A = '00000000-0000-4000-8000-000000000001';

describe('CreateAccountUseCase', () => {
  let repo: InMemoryAccountRepository;
  let eventRepo: InMemoryAccountEventRepository;
  let useCase: CreateAccountUseCase;

  beforeEach(() => {
    repo = new InMemoryAccountRepository();
    eventRepo = new InMemoryAccountEventRepository();
    useCase = new CreateAccountUseCase(repo, eventRepo);
  });

  it('creates a USER account and returns accountId', async () => {
    const result = await useCase.execute({ identityRef: ID_A, type: 'USER' });
    expect(result.accountId).toBeTruthy();
    const accounts = await repo.findByIdentityRef({ toPrimitive: () => ID_A } as never);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].getType().toPrimitive()).toBe('USER');
    expect(accounts[0].getStatus().toPrimitive()).toBe('ACTIVE');
  });

  it('creates an ORGANIZER account with PENDING status', async () => {
    const result = await useCase.execute({ identityRef: ID_A, type: 'ORGANIZER' });
    expect(result.accountId).toBeTruthy();
    const accounts = await repo.findByIdentityRef({ toPrimitive: () => ID_A } as never);
    expect(accounts[0].getStatus().toPrimitive()).toBe('PENDING');
  });

  it('throws AccountAlreadyExistsError for duplicate type', async () => {
    await useCase.execute({ identityRef: ID_A, type: 'USER' });
    await expect(useCase.execute({ identityRef: ID_A, type: 'USER' })).rejects.toThrow(AccountAlreadyExistsError);
  });
});
