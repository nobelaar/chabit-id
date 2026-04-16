import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { AccountEventRepository } from '../../domain/ports/AccountEventRepository.port.js';
import { Account } from '../../domain/entities/Account.entity.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountAlreadyExistsError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export interface AddStaffByOrganizerDto {
  callerRef: string;  // organizador — viene del JWT
  targetRef: string;  // staff — viene del body
}

export class AddStaffByOrganizerUseCase {
  constructor(
    private readonly repo: AccountRepository,
    private readonly eventRepo: AccountEventRepository,
  ) {}

  async execute(dto: AddStaffByOrganizerDto): Promise<{ accountId: string }> {
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
    const targetRef = IdentityRef.fromPrimitive(dto.targetRef);

    // Verificar que el caller tiene una cuenta ORGANIZER activa
    const callerOrganizer = await this.repo.findByIdentityRefAndType(callerRef, AccountType.organizer());
    if (!callerOrganizer || !callerOrganizer.getStatus().isActive()) {
      throw new InsufficientPermissionsError();
    }

    // Verificar que el target no tiene ya una cuenta STAFF
    const existing = await this.repo.findByIdentityRefAndType(targetRef, AccountType.staff());
    if (existing) throw new AccountAlreadyExistsError('STAFF');

    const id = AccountId.generate();
    const account = Account.createStaffByOrganizer(id, targetRef, callerRef);
    await this.repo.save(account);

    this.eventRepo.save({ accountId: id, type: 'created', performedBy: callerRef })
      .catch(err => logger.warn({ err }, '[AddStaffByOrganizer] event error'));

    return { accountId: id.toPrimitive() };
  }
}
