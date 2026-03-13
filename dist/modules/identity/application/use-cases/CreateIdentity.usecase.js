import { Identity } from '../../domain/entities/Identity.entity.js';
import { IdentityId } from '../../domain/value-objects/IdentityId.vo.js';
import { FullName } from '../../domain/value-objects/FullName.vo.js';
import { Nationality } from '../../domain/value-objects/Nationality.vo.js';
import { Country } from '../../domain/value-objects/Country.vo.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { PhoneNumber } from '../../../../shared/domain/value-objects/PhoneNumber.vo.js';
import { EmailAlreadyRegisteredError, PhoneAlreadyRegisteredError } from '../../domain/errors/Identity.errors.js';
export class CreateIdentityUseCase {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async execute(dto) {
        const email = Email.fromPrimitive(dto.email);
        const phone = PhoneNumber.fromPrimitive(dto.phone);
        const existing = await this.repo.findByEmail(email);
        if (existing)
            throw new EmailAlreadyRegisteredError(email.toPrimitive());
        const existingPhone = await this.repo.findByPhone(phone);
        if (existingPhone)
            throw new PhoneAlreadyRegisteredError(phone.toPrimitive());
        const identity = Identity.create({
            id: IdentityId.generate(),
            fullName: FullName.fromPrimitive(dto.fullName),
            email,
            phone,
            nationality: Nationality.fromPrimitive(dto.nationality),
            country: Country.fromPrimitive(dto.country),
            emailVerifiedAt: dto.emailVerifiedAt,
        });
        await this.repo.save(identity);
        return { identityId: identity.getId().toPrimitive() };
    }
}
