import { logger } from '../../../../shared/infrastructure/logger.js';
import { Account } from '../../domain/entities/Account.entity.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountAlreadyExistsError, AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
export class RequestOrganizerUseCase {
    repo;
    eventRepo;
    constructor(repo, eventRepo) {
        this.repo = repo;
        this.eventRepo = eventRepo;
    }
    async execute(dto) {
        const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
        const existing = await this.repo.findByIdentityRefAndType(callerRef, AccountType.organizer());
        if (existing)
            throw new AccountAlreadyExistsError('ORGANIZER');
        const userAccount = await this.repo.findByIdentityRefAndType(callerRef, AccountType.user());
        if (!userAccount)
            throw new AccountNotFoundError();
        if (!userAccount.getStatus().isActive())
            throw new InsufficientPermissionsError();
        const id = AccountId.generate();
        const account = Account.createOrganizer(id, callerRef);
        await this.repo.save(account);
        this.eventRepo.save({ accountId: id, type: 'created', performedBy: callerRef })
            .catch(err => logger.warn({ err }, '[RequestOrganizer] event error'));
        return { accountId: id.toPrimitive() };
    }
}
