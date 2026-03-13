import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { SessionId } from '../../domain/value-objects/SessionId.vo.js';
import { RawPassword } from '../../domain/value-objects/RawPassword.vo.js';
import { CredentialNotFoundError, InvalidCredentialsError } from '../../domain/errors/Credential.errors.js';
export class ChangePasswordUseCase {
    repo;
    sessionRepo;
    hasher;
    constructor(repo, sessionRepo, hasher) {
        this.repo = repo;
        this.sessionRepo = sessionRepo;
        this.hasher = hasher;
    }
    async execute(dto) {
        const ref = IdentityRef.fromPrimitive(dto.identityRef);
        const credential = await this.repo.findByIdentityRef(ref);
        if (!credential)
            throw new CredentialNotFoundError();
        const match = await this.hasher.compare(RawPassword.fromPrimitive(dto.currentPassword), credential.getPasswordHash());
        if (!match)
            throw new InvalidCredentialsError();
        const newHash = await this.hasher.hash(RawPassword.fromPrimitive(dto.newPassword));
        credential.updatePassword(newHash);
        await this.repo.save(credential);
        await this.sessionRepo.deleteAllByCredentialIdExcept(credential.getId(), SessionId.fromPrimitive(dto.currentSessionId));
    }
}
