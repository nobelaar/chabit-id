import { IdentityRepository } from '../../domain/ports/IdentityRepository.port.js';
import { Email, InvalidEmailError } from '../../../../shared/domain/value-objects/Email.vo.js';
import { IdentityNotFoundError } from '../../domain/errors/Identity.errors.js';

export interface GetIdentityByEmailDto { email: string; }
export interface GetIdentityByEmailResult { identityRef: string; fullName: string; }

export class GetIdentityByEmailUseCase {
  constructor(private readonly repo: IdentityRepository) {}

  async execute(dto: GetIdentityByEmailDto): Promise<GetIdentityByEmailResult> {
    let emailVo: Email;
    try {
      emailVo = Email.fromPrimitive(dto.email);
    } catch {
      throw new InvalidEmailError(dto.email);
    }

    const identity = await this.repo.findByEmail(emailVo);
    if (!identity) throw new IdentityNotFoundError(dto.email);

    const { id, fullName } = identity.toPrimitive();
    return { identityRef: id, fullName };
  }
}
