import { IdentityId } from '../../domain/value-objects/IdentityId.vo.js';
import { FullName } from '../../domain/value-objects/FullName.vo.js';
import { Nationality } from '../../domain/value-objects/Nationality.vo.js';
import { Country } from '../../domain/value-objects/Country.vo.js';
import { PhoneNumber } from '../../../../shared/domain/value-objects/PhoneNumber.vo.js';
import { IdentityNotFoundError, PhoneAlreadyRegisteredError } from '../../domain/errors/Identity.errors.js';
export class UpdateProfileUseCase {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async execute(dto) {
        const id = IdentityId.fromPrimitive(dto.identityId);
        const identity = await this.repo.findById(id);
        if (!identity)
            throw new IdentityNotFoundError(dto.identityId);
        let phone;
        if (dto.phone) {
            phone = PhoneNumber.fromPrimitive(dto.phone);
            const existing = await this.repo.findByPhone(phone);
            if (existing && !existing.getId().equals(id)) {
                throw new PhoneAlreadyRegisteredError(dto.phone);
            }
        }
        identity.updateProfile({
            fullName: dto.fullName ? FullName.fromPrimitive(dto.fullName) : undefined,
            phone,
            nationality: dto.nationality ? Nationality.fromPrimitive(dto.nationality) : undefined,
            country: dto.country ? Country.fromPrimitive(dto.country) : undefined,
        });
        await this.repo.save(identity);
    }
}
