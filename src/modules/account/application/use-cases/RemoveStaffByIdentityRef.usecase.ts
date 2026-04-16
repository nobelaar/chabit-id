import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { AccountEventRepository } from '../../domain/ports/AccountEventRepository.port.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export interface RemoveStaffByIdentityRefDto {
  callerRef: string;   // organizador — viene del JWT
  targetRef: string;   // identityRef del staff a remover
}

export class RemoveStaffByIdentityRefUseCase {
  constructor(
    private readonly repo: AccountRepository,
    private readonly eventRepo: AccountEventRepository,
  ) {}

  async execute(dto: RemoveStaffByIdentityRefDto): Promise<void> {
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
    const targetRef = IdentityRef.fromPrimitive(dto.targetRef);

    const callerOrganizer = await this.repo.findByIdentityRefAndType(callerRef, AccountType.organizer());
    if (!callerOrganizer || !callerOrganizer.getStatus().isActive()) {
      throw new InsufficientPermissionsError();
    }

    const account = await this.repo.findByIdentityRefAndType(targetRef, AccountType.staff());
    if (!account) throw new AccountNotFoundError();

    account.deactivate();
    await this.repo.save(account);

    this.eventRepo.save({ accountId: account.getId(), type: 'deactivated', performedBy: callerRef })
      .catch(err => logger.warn({ err }, '[RemoveStaffByIdentityRef] event error'));
  }
}
