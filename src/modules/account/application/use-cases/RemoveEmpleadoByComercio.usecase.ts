import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { AccountEventRepository } from '../../domain/ports/AccountEventRepository.port.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export interface RemoveEmpleadoByComercioDto {
  callerRef: string;  // comercio — viene del JWT
  accountId: string;  // account EMPLEADO a desactivar
}

export class RemoveEmpleadoByComercioUseCase {
  constructor(
    private readonly repo: AccountRepository,
    private readonly eventRepo: AccountEventRepository,
  ) {}

  async execute(dto: RemoveEmpleadoByComercioDto): Promise<void> {
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);

    const callerComercio = await this.repo.findByIdentityRefAndType(callerRef, AccountType.comercio());
    if (!callerComercio || !callerComercio.getStatus().isActive()) {
      throw new InsufficientPermissionsError();
    }

    const account = await this.repo.findById(AccountId.fromPrimitive(dto.accountId));
    if (!account) throw new AccountNotFoundError();
    if (!account.getType().isEmpleado()) throw new InsufficientPermissionsError();

    account.deactivate();
    await this.repo.save(account);

    this.eventRepo.save({ accountId: account.getId(), type: 'deactivated', performedBy: callerRef })
      .catch(err => logger.warn({ err }, '[RemoveEmpleadoByComercio] event error'));
  }
}
