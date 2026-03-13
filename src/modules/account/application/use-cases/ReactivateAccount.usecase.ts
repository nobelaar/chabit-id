import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { AccountEventRepository } from '../../domain/ports/AccountEventRepository.port.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';

export interface ReactivateAccountDto { accountId: string; callerRef: string; }

export class ReactivateAccountUseCase {
  constructor(private readonly repo: AccountRepository, private readonly eventRepo: AccountEventRepository) {}

  async execute(dto: ReactivateAccountDto): Promise<void> {
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
    const callerAdmin = await this.repo.findByIdentityRefAndType(callerRef, AccountType.admin());
    if (!callerAdmin || !callerAdmin.getStatus().isActive()) throw new InsufficientPermissionsError();

    const account = await this.repo.findById(AccountId.fromPrimitive(dto.accountId));
    if (!account) throw new AccountNotFoundError();
    account.reactivate();
    await this.repo.save(account);
    this.eventRepo.save({ accountId: account.getId(), type: 'reactivated', performedBy: callerRef })
      .catch(err => logger.warn({ err }, '[ReactivateAccount] event error'));
  }
}
