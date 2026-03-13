import { describe, it, expect, beforeEach } from 'vitest';
import { ApproveOrganizerUseCase } from './ApproveOrganizer.usecase.js';
import { CreateAccountUseCase } from './CreateAccount.usecase.js';
import { RequestOrganizerUseCase } from './RequestOrganizer.usecase.js';
import { InMemoryAccountRepository } from '../../infrastructure/persistence/InMemoryAccountRepository.js';
import { InMemoryAccountEventRepository } from '../../infrastructure/persistence/InMemoryAccountEventRepository.js';
import { InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { Account } from '../../domain/entities/Account.entity.js';

const ADMIN_REF = '00000000-0000-4000-8000-000000000010';
const USER_REF = '00000000-0000-4000-8000-000000000001';

describe('ApproveOrganizerUseCase', () => {
  let repo: InMemoryAccountRepository;
  let eventRepo: InMemoryAccountEventRepository;
  let approveUseCase: ApproveOrganizerUseCase;
  let createAccount: CreateAccountUseCase;
  let requestOrganizer: RequestOrganizerUseCase;

  beforeEach(() => {
    repo = new InMemoryAccountRepository();
    eventRepo = new InMemoryAccountEventRepository();
    approveUseCase = new ApproveOrganizerUseCase(repo, eventRepo);
    createAccount = new CreateAccountUseCase(repo, eventRepo);
    requestOrganizer = new RequestOrganizerUseCase(repo, eventRepo);
  });

  const seedAdmin = async () => {
    // Create an admin account directly
    const adminId = AccountId.generate();
    const adminIdentityRef = IdentityRef.fromPrimitive(ADMIN_REF);
    const adminCallerRef = IdentityRef.fromPrimitive('00000000-0000-4000-8000-000000000099');
    const adminAccount = Account.createAdmin(adminId, adminIdentityRef, adminCallerRef);
    await repo.save(adminAccount);
    return adminId;
  };

  it('approves a PENDING organizer account', async () => {
    await seedAdmin();
    await createAccount.execute({ identityRef: USER_REF, type: 'USER' });
    const { accountId } = await requestOrganizer.execute({ callerRef: USER_REF });

    await approveUseCase.execute({ accountId, callerRef: ADMIN_REF });

    const account = await repo.findById(AccountId.fromPrimitive(accountId));
    expect(account?.getStatus().toPrimitive()).toBe('ACTIVE');
  });

  it('throws InsufficientPermissionsError when caller is not ADMIN', async () => {
    await createAccount.execute({ identityRef: USER_REF, type: 'USER' });
    const { accountId } = await requestOrganizer.execute({ callerRef: USER_REF });

    await expect(
      approveUseCase.execute({ accountId, callerRef: USER_REF }),
    ).rejects.toThrow(InsufficientPermissionsError);
  });
});
