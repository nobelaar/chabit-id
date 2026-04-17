import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { AccountEventRepository } from '../../domain/ports/AccountEventRepository.port.js';
import { Account } from '../../domain/entities/Account.entity.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountAlreadyExistsError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export interface AddEmpleadoByComercioDto {
  callerRef: string;  // comercio — viene del JWT
  targetRef: string;  // empleado — viene del body
}

export class AddEmpleadoByComercioUseCase {
  constructor(
    private readonly repo: AccountRepository,
    private readonly eventRepo: AccountEventRepository,
  ) {}

  async execute(dto: AddEmpleadoByComercioDto): Promise<{ accountId: string }> {
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
    const targetRef = IdentityRef.fromPrimitive(dto.targetRef);

    const callerComercio = await this.repo.findByIdentityRefAndType(callerRef, AccountType.comercio());
    if (!callerComercio || !callerComercio.getStatus().isActive()) {
      throw new InsufficientPermissionsError();
    }

    const existing = await this.repo.findByIdentityRefAndType(targetRef, AccountType.empleado());
    if (existing) throw new AccountAlreadyExistsError('EMPLEADO');

    const id = AccountId.generate();
    const account = Account.createEmpleadoByComercio(id, targetRef, callerRef);
    await this.repo.save(account);

    this.eventRepo.save({ accountId: id, type: 'created', performedBy: callerRef })
      .catch(err => logger.warn({ err }, '[AddEmpleadoByComercio] event error'));

    return { accountId: id.toPrimitive() };
  }
}
