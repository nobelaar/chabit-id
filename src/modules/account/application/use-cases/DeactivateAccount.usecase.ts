import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { AccountEventRepository } from '../../domain/ports/AccountEventRepository.port.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';

export interface DeactivateAccountDto { accountId: string; callerRef: string; }

export class DeactivateAccountUseCase {
  constructor(private readonly repo: AccountRepository, private readonly eventRepo: AccountEventRepository) {}

  async execute(dto: DeactivateAccountDto): Promise<void> {
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
    const callerAdmin = await this.repo.findByIdentityRefAndType(callerRef, AccountType.admin());
    if (!callerAdmin || !callerAdmin.getStatus().isActive()) throw new InsufficientPermissionsError();

    const account = await this.repo.findById(AccountId.fromPrimitive(dto.accountId));
    if (!account) throw new AccountNotFoundError();
    account.deactivate();
    await this.repo.save(account);
    this.eventRepo.save({ accountId: account.getId(), type: 'deactivated', performedBy: callerRef })
      .catch(err => console.error('[DeactivateAccount] event error:', err));
  }
}
