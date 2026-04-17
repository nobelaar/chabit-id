import { describe, it, expect, beforeEach } from 'vitest';
import { RemoveEmpleadoByComercioUseCase } from './RemoveEmpleadoByComercio.usecase.js';
import { RemoveEmpleadoByIdentityRefUseCase } from './RemoveEmpleadoByIdentityRef.usecase.js';
import { AddEmpleadoByComercioUseCase } from './AddEmpleadoByComercio.usecase.js';
import { RequestComercioUseCase } from './RequestComercio.usecase.js';
import { CreateAccountUseCase } from './CreateAccount.usecase.js';
import { ApproveOrganizerUseCase } from './ApproveOrganizer.usecase.js';
import { InMemoryAccountRepository } from '../../infrastructure/persistence/InMemoryAccountRepository.js';
import { InMemoryAccountEventRepository } from '../../infrastructure/persistence/InMemoryAccountEventRepository.js';
import { AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { Account } from '../../domain/entities/Account.entity.js';

const COMERCIO_REF = '00000000-0000-4000-8000-000000000001';
const TARGET_REF   = '00000000-0000-4000-8000-000000000002';
const ADMIN_REF    = '00000000-0000-4000-8000-000000000010';

describe('RemoveEmpleadoByComercioUseCase', () => {
  let repo: InMemoryAccountRepository;
  let eventRepo: InMemoryAccountEventRepository;
  let removeByAccountId: RemoveEmpleadoByComercioUseCase;
  let removeByIdentityRef: RemoveEmpleadoByIdentityRefUseCase;
  let addEmpleado: AddEmpleadoByComercioUseCase;
  let createAccount: CreateAccountUseCase;
  let requestComercio: RequestComercioUseCase;
  let approveOrganizer: ApproveOrganizerUseCase;

  beforeEach(() => {
    repo = new InMemoryAccountRepository();
    eventRepo = new InMemoryAccountEventRepository();
    removeByAccountId = new RemoveEmpleadoByComercioUseCase(repo, eventRepo);
    removeByIdentityRef = new RemoveEmpleadoByIdentityRefUseCase(repo, eventRepo);
    addEmpleado = new AddEmpleadoByComercioUseCase(repo, eventRepo);
    createAccount = new CreateAccountUseCase(repo, eventRepo);
    requestComercio = new RequestComercioUseCase(repo, eventRepo);
    approveOrganizer = new ApproveOrganizerUseCase(repo, eventRepo);
  });

  const seedActiveComercio = async () => {
    const adminAccount = Account.createAdmin(
      AccountId.generate(),
      IdentityRef.fromPrimitive(ADMIN_REF),
      IdentityRef.fromPrimitive(ADMIN_REF),
    );
    await repo.save(adminAccount);
    await createAccount.execute({ identityRef: COMERCIO_REF, type: 'USER' });
    const { accountId } = await requestComercio.execute({ callerRef: COMERCIO_REF });
    await approveOrganizer.execute({ accountId, callerRef: ADMIN_REF });
  };

  describe('by accountId', () => {
    it('deactivates an ACTIVE EMPLEADO account', async () => {
      await seedActiveComercio();
      const { accountId } = await addEmpleado.execute({ callerRef: COMERCIO_REF, targetRef: TARGET_REF });

      await removeByAccountId.execute({ callerRef: COMERCIO_REF, accountId });

      const account = await repo.findById(AccountId.fromPrimitive(accountId));
      expect(account?.getStatus().toPrimitive()).toBe('DEACTIVATED');
    });

    it('throws InsufficientPermissionsError when caller has no ACTIVE COMERCIO', async () => {
      await expect(
        removeByAccountId.execute({ callerRef: COMERCIO_REF, accountId: '00000000-0000-4000-8000-000000000099' }),
      ).rejects.toThrow(InsufficientPermissionsError);
    });

    it('throws AccountNotFoundError when accountId does not exist', async () => {
      await seedActiveComercio();
      await expect(
        removeByAccountId.execute({ callerRef: COMERCIO_REF, accountId: '00000000-0000-4000-8000-000000000099' }),
      ).rejects.toThrow(AccountNotFoundError);
    });

    it('throws InsufficientPermissionsError when account is not EMPLEADO', async () => {
      await seedActiveComercio();
      const { accountId } = await createAccount.execute({ identityRef: TARGET_REF, type: 'USER' });

      await expect(
        removeByAccountId.execute({ callerRef: COMERCIO_REF, accountId }),
      ).rejects.toThrow(InsufficientPermissionsError);
    });
  });

  describe('by identityRef', () => {
    it('deactivates EMPLEADO account by target identityRef', async () => {
      await seedActiveComercio();
      await addEmpleado.execute({ callerRef: COMERCIO_REF, targetRef: TARGET_REF });

      await removeByIdentityRef.execute({ callerRef: COMERCIO_REF, targetRef: TARGET_REF });

      const account = await repo.findByIdentityRefAndType(
        IdentityRef.fromPrimitive(TARGET_REF),
        (await import('../../domain/value-objects/AccountType.vo.js')).AccountType.empleado(),
      );
      expect(account?.getStatus().toPrimitive()).toBe('DEACTIVATED');
    });

    it('throws InsufficientPermissionsError when caller has no ACTIVE COMERCIO', async () => {
      await expect(
        removeByIdentityRef.execute({ callerRef: COMERCIO_REF, targetRef: TARGET_REF }),
      ).rejects.toThrow(InsufficientPermissionsError);
    });

    it('throws AccountNotFoundError when target has no EMPLEADO account', async () => {
      await seedActiveComercio();
      await expect(
        removeByIdentityRef.execute({ callerRef: COMERCIO_REF, targetRef: TARGET_REF }),
      ).rejects.toThrow(AccountNotFoundError);
    });
  });
});
