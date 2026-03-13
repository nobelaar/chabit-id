import { logger } from '../../../../shared/infrastructure/logger.js';
import { Account } from '../../domain/entities/Account.entity.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountAlreadyExistsError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
export class CreateAccountUseCase {
    repo;
    eventRepo;
    constructor(repo, eventRepo) {
        this.repo = repo;
        this.eventRepo = eventRepo;
    }
    async execute(dto) {
        const identityRef = IdentityRef.fromPrimitive(dto.identityRef);
        const type = AccountType.fromPrimitive(dto.type);
        const existing = await this.repo.findByIdentityRefAndType(identityRef, type);
        if (existing)
            throw new AccountAlreadyExistsError(dto.type);
        const id = AccountId.generate();
        let account;
        if (type.isUser()) {
            account = Account.createUser(id, identityRef);
        }
        else if (type.isOrganizer()) {
            account = Account.createOrganizer(id, identityRef);
        }
        else {
            // ADMIN — requires callerRef with ADMIN account
            if (!dto.callerRef)
                throw new InsufficientPermissionsError();
            const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
            const callerAdminAccounts = await this.repo.findByIdentityRefAndType(callerRef, AccountType.admin());
            if (!callerAdminAccounts || !callerAdminAccounts.getStatus().isActive()) {
                throw new InsufficientPermissionsError();
            }
            account = Account.createAdmin(id, identityRef, callerRef);
        }
        await this.repo.save(account);
        const callerRef = dto.callerRef ? IdentityRef.fromPrimitive(dto.callerRef) : undefined;
        this.eventRepo.save({ accountId: id, type: 'created', performedBy: callerRef })
            .catch(err => logger.warn({ err }, '[CreateAccount] Failed to save event'));
        return { accountId: id.toPrimitive() };
    }
}
