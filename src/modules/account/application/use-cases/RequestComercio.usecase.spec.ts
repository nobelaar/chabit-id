import { describe, it, expect, beforeEach } from 'vitest';
import { RequestComercioUseCase } from './RequestComercio.usecase.js';
import { CreateAccountUseCase } from './CreateAccount.usecase.js';
import { InMemoryAccountRepository } from '../../infrastructure/persistence/InMemoryAccountRepository.js';
import { InMemoryAccountEventRepository } from '../../infrastructure/persistence/InMemoryAccountEventRepository.js';
import { AccountAlreadyExistsError, AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';

const CALLER_REF = '00000000-0000-4000-8000-000000000001';

describe('RequestComercioUseCase', () => {
  let repo: InMemoryAccountRepository;
  let eventRepo: InMemoryAccountEventRepository;
  let useCase: RequestComercioUseCase;
  let createAccount: CreateAccountUseCase;

  beforeEach(() => {
    repo = new InMemoryAccountRepository();
    eventRepo = new InMemoryAccountEventRepository();
    useCase = new RequestComercioUseCase(repo, eventRepo);
    createAccount = new CreateAccountUseCase(repo, eventRepo);
  });

  it('creates COMERCIO account for an ACTIVE USER', async () => {
    await createAccount.execute({ identityRef: CALLER_REF, type: 'USER' });
    const result = await useCase.execute({ callerRef: CALLER_REF });
    expect(result.accountId).toBeTruthy();
  });

  it('throws AccountNotFoundError when USER does not exist', async () => {
    await expect(useCase.execute({ callerRef: CALLER_REF })).rejects.toThrow(AccountNotFoundError);
  });

  it('throws AccountAlreadyExistsError when COMERCIO already exists', async () => {
    await createAccount.execute({ identityRef: CALLER_REF, type: 'USER' });
    await useCase.execute({ callerRef: CALLER_REF });
    await expect(useCase.execute({ callerRef: CALLER_REF })).rejects.toThrow(AccountAlreadyExistsError);
  });

  it('throws InsufficientPermissionsError when USER is deactivated', async () => {
    await createAccount.execute({ identityRef: CALLER_REF, type: 'USER' });
    const accounts = await repo.findByIdentityRef({ toPrimitive: () => CALLER_REF } as never);
    accounts[0].deactivate();
    await repo.save(accounts[0]);

    await expect(useCase.execute({ callerRef: CALLER_REF })).rejects.toThrow(InsufficientPermissionsError);
  });
});
