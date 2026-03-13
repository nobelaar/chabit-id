import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError } from '../../domain/errors/Account.errors.js';
export class GetAccountsByIdentityUseCase {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async execute(dto) {
        const identityRef = IdentityRef.fromPrimitive(dto.identityRef);
        const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
        // Authorization: caller must be the owner OR have ADMIN ACTIVE account
        const isSelf = callerRef.toPrimitive() === identityRef.toPrimitive();
        if (!isSelf) {
            const callerAdmin = await this.repo.findByIdentityRefAndType(callerRef, AccountType.admin());
            if (!callerAdmin || !callerAdmin.getStatus().isActive())
                throw new AccountNotFoundError();
        }
        const accounts = await this.repo.findByIdentityRef(identityRef);
        return accounts.map(a => a.toPrimitive());
    }
}
