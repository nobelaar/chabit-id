import { logger } from '../../../../shared/infrastructure/logger.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
export class RejectOrganizerUseCase {
    repo;
    eventRepo;
    constructor(repo, eventRepo) {
        this.repo = repo;
        this.eventRepo = eventRepo;
    }
    async execute(dto) {
        const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
        const callerAdmin = await this.repo.findByIdentityRefAndType(callerRef, AccountType.admin());
        if (!callerAdmin || !callerAdmin.getStatus().isActive())
            throw new InsufficientPermissionsError();
        const account = await this.repo.findById(AccountId.fromPrimitive(dto.accountId));
        if (!account)
            throw new AccountNotFoundError();
        account.reject();
        await this.repo.save(account);
        this.eventRepo.save({ accountId: account.getId(), type: 'rejected', performedBy: callerRef })
            .catch(err => logger.warn({ err }, '[RejectOrganizer] event error'));
    }
}
