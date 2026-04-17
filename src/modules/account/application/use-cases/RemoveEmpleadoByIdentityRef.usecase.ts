import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { AccountEventRepository } from '../../domain/ports/AccountEventRepository.port.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export interface RemoveEmpleadoByIdentityRefDto {
  callerRef: string;   // comercio — viene del JWT
  targetRef: string;   // identityRef del empleado a remover
}

export class RemoveEmpleadoByIdentityRefUseCase {
  constructor(
    private readonly repo: AccountRepository,
    private readonly eventRepo: AccountEventRepository,
  ) {}

  async execute(dto: RemoveEmpleadoByIdentityRefDto): Promise<void> {
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
    const targetRef = IdentityRef.fromPrimitive(dto.targetRef);

    const callerComercio = await this.repo.findByIdentityRefAndType(callerRef, AccountType.comercio());
    if (!callerComercio || !callerComercio.getStatus().isActive()) {
      throw new InsufficientPermissionsError();
    }

    const account = await this.repo.findByIdentityRefAndType(targetRef, AccountType.empleado());
    if (!account) throw new AccountNotFoundError();

    account.deactivate();
    await this.repo.save(account);

    this.eventRepo.save({ accountId: account.getId(), type: 'deactivated', performedBy: callerRef })
      .catch(err => logger.warn({ err }, '[RemoveEmpleadoByIdentityRef] event error'));
  }
}
