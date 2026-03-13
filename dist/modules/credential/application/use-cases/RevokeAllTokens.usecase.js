import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { CredentialNotFoundError } from '../../domain/errors/Credential.errors.js';
export class RevokeAllTokensUseCase {
    credentialRepo;
    sessionRepo;
    constructor(credentialRepo, sessionRepo) {
        this.credentialRepo = credentialRepo;
        this.sessionRepo = sessionRepo;
    }
    async execute(dto) {
        const ref = IdentityRef.fromPrimitive(dto.identityRef);
        const credential = await this.credentialRepo.findByIdentityRef(ref);
        if (!credential)
            throw new CredentialNotFoundError();
        await this.sessionRepo.deleteAllByCredentialId(credential.getId());
    }
}
