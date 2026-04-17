import { describe, it, expect, beforeEach } from 'vitest';
import { AddEmpleadoByComercioUseCase } from './AddEmpleadoByComercio.usecase.js';
import { RequestComercioUseCase } from './RequestComercio.usecase.js';
import { CreateAccountUseCase } from './CreateAccount.usecase.js';
import { InMemoryAccountRepository } from '../../infrastructure/persistence/InMemoryAccountRepository.js';
import { InMemoryAccountEventRepository } from '../../infrastructure/persistence/InMemoryAccountEventRepository.js';
import { AccountAlreadyExistsError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { Account } from '../../domain/entities/Account.entity.js';
import { ApproveOrganizerUseCase } from './ApproveOrganizer.usecase.js';

const COMERCIO_REF = '00000000-0000-4000-8000-000000000001';
const TARGET_REF   = '00000000-0000-4000-8000-000000000002';
const ADMIN_REF    = '00000000-0000-4000-8000-000000000010';

describe('AddEmpleadoByComercioUseCase', () => {
  let repo: InMemoryAccountRepository;
  let eventRepo: InMemoryAccountEventRepository;
  let useCase: AddEmpleadoByComercioUseCase;
  let createAccount: CreateAccountUseCase;
  let requestComercio: RequestComercioUseCase;
  let approveOrganizer: ApproveOrganizerUseCase;

  beforeEach(() => {
    repo = new InMemoryAccountRepository();
    eventRepo = new InMemoryAccountEventRepository();
    useCase = new AddEmpleadoByComercioUseCase(repo, eventRepo);
    createAccount = new CreateAccountUseCase(repo, eventRepo);
    requestComercio = new RequestComercioUseCase(repo, eventRepo);
    approveOrganizer = new ApproveOrganizerUseCase(repo, eventRepo);
  });

  const seedActiveComercio = async () => {
    const adminId = AccountId.generate();
    const adminAccount = Account.createAdmin(adminId, IdentityRef.fromPrimitive(ADMIN_REF), IdentityRef.fromPrimitive(ADMIN_REF));
    await repo.save(adminAccount);

    await createAccount.execute({ identityRef: COMERCIO_REF, type: 'USER' });
    const { accountId } = await requestComercio.execute({ callerRef: COMERCIO_REF });
    await approveOrganizer.execute({ accountId, callerRef: ADMIN_REF });
  };

  it('creates an ACTIVE EMPLEADO account when caller has ACTIVE COMERCIO', async () => {
    await seedActiveComercio();
    const result = await useCase.execute({ callerRef: COMERCIO_REF, targetRef: TARGET_REF });
    expect(result.accountId).toBeTruthy();

    const account = await repo.findByIdentityRefAndType(
      IdentityRef.fromPrimitive(TARGET_REF),
      AccountType.empleado(),
    );
    expect(account?.getStatus().toPrimitive()).toBe('ACTIVE');
    expect(account?.getCreatedBy()?.toPrimitive()).toBe(COMERCIO_REF);
  });

  it('throws InsufficientPermissionsError when caller has no COMERCIO account', async () => {
    await expect(
      useCase.execute({ callerRef: COMERCIO_REF, targetRef: TARGET_REF }),
    ).rejects.toThrow(InsufficientPermissionsError);
  });

  it('throws InsufficientPermissionsError when COMERCIO is PENDING (not ACTIVE)', async () => {
    await createAccount.execute({ identityRef: COMERCIO_REF, type: 'USER' });
    await requestComercio.execute({ callerRef: COMERCIO_REF });

    await expect(
      useCase.execute({ callerRef: COMERCIO_REF, targetRef: TARGET_REF }),
    ).rejects.toThrow(InsufficientPermissionsError);
  });

  it('throws AccountAlreadyExistsError when target already has EMPLEADO account', async () => {
    await seedActiveComercio();
    await useCase.execute({ callerRef: COMERCIO_REF, targetRef: TARGET_REF });

    await expect(
      useCase.execute({ callerRef: COMERCIO_REF, targetRef: TARGET_REF }),
    ).rejects.toThrow(AccountAlreadyExistsError);
  });
});
