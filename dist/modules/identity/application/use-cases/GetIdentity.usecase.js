import { IdentityId } from '../../domain/value-objects/IdentityId.vo.js';
import { IdentityNotFoundError } from '../../domain/errors/Identity.errors.js';
export class GetIdentityUseCase {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async execute(dto) {
        const id = IdentityId.fromPrimitive(dto.identityId);
        const identity = await this.repo.findById(id);
        if (!identity)
            throw new IdentityNotFoundError(dto.identityId);
        return identity.toPrimitive();
    }
}
