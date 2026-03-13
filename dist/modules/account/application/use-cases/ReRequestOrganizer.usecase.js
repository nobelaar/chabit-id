import { logger } from '../../../../shared/infrastructure/logger.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError } from '../../domain/errors/Account.errors.js';
export class ReRequestOrganizerUseCase {
    repo;
    eventRepo;
    constructor(repo, eventRepo) {
        this.repo = repo;
        this.eventRepo = eventRepo;
    }
    async execute(dto) {
        const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
        const account = await this.repo.findByIdentityRefAndType(callerRef, AccountType.organizer());
        if (!account)
            throw new AccountNotFoundError();
        account.reRequest();
        await this.repo.save(account);
        this.eventRepo.save({ accountId: account.getId(), type: 're_requested', performedBy: callerRef })
            .catch(err => logger.warn({ err }, '[ReRequestOrganizer] event error'));
    }
}
