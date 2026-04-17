import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { AccountEventRepository } from '../../domain/ports/AccountEventRepository.port.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError } from '../../domain/errors/Account.errors.js';

export interface ReRequestComercioDto { callerRef: string; }

export class ReRequestComercioUseCase {
  constructor(private readonly repo: AccountRepository, private readonly eventRepo: AccountEventRepository) {}

  async execute(dto: ReRequestComercioDto): Promise<void> {
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
    const account = await this.repo.findByIdentityRefAndType(callerRef, AccountType.comercio());
    if (!account) throw new AccountNotFoundError();
    account.reRequest();
    await this.repo.save(account);
    this.eventRepo.save({ accountId: account.getId(), type: 're_requested', performedBy: callerRef })
      .catch(err => logger.warn({ err }, '[ReRequestComercio] event error'));
  }
}
