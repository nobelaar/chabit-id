import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { AccountEventRepository } from '../../domain/ports/AccountEventRepository.port.js';
import { Account } from '../../domain/entities/Account.entity.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountAlreadyExistsError, AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';

export interface RequestComercioDto { callerRef: string; }

export class RequestComercioUseCase {
  constructor(
    private readonly repo: AccountRepository,
    private readonly eventRepo: AccountEventRepository,
  ) {}

  async execute(dto: RequestComercioDto): Promise<{ accountId: string }> {
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);

    const existing = await this.repo.findByIdentityRefAndType(callerRef, AccountType.comercio());
    if (existing) throw new AccountAlreadyExistsError('COMERCIO');

    const userAccount = await this.repo.findByIdentityRefAndType(callerRef, AccountType.user());
    if (!userAccount) throw new AccountNotFoundError();
    if (!userAccount.getStatus().isActive()) throw new InsufficientPermissionsError();

    const id = AccountId.generate();
    const account = Account.createComercio(id, callerRef);
    await this.repo.save(account);
    this.eventRepo.save({ accountId: id, type: 'created', performedBy: callerRef })
      .catch(err => logger.warn({ err }, '[RequestComercio] event error'));
    return { accountId: id.toPrimitive() };
  }
}
