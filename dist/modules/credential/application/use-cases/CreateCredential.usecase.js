import { Credential } from '../../domain/entities/Credential.entity.js';
import { CredentialId } from '../../domain/value-objects/CredentialId.vo.js';
import { Username } from '../../domain/value-objects/Username.vo.js';
import { RawPassword } from '../../domain/value-objects/RawPassword.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { UsernameReservedError, UsernameAlreadyTakenError } from '../../domain/errors/Credential.errors.js';
export class CreateCredentialUseCase {
    repo;
    hasher;
    reservedList;
    constructor(repo, hasher, reservedList) {
        this.repo = repo;
        this.hasher = hasher;
        this.reservedList = reservedList;
    }
    async execute(dto) {
        const username = Username.fromPrimitive(dto.username);
        if (this.reservedList.isReserved(username))
            throw new UsernameReservedError(dto.username);
        const existing = await this.repo.findByUsername(username);
        if (existing)
            throw new UsernameAlreadyTakenError(dto.username);
        const raw = RawPassword.fromPrimitive(dto.password);
        const hash = await this.hasher.hash(raw);
        const credential = Credential.create({
            id: CredentialId.generate(),
            identityRef: IdentityRef.fromPrimitive(dto.identityRef),
            username,
            passwordHash: hash,
        });
        await this.repo.save(credential);
        return { credentialId: credential.getId().toPrimitive() };
    }
}
