import { IdentityRepository } from '../../domain/ports/IdentityRepository.port.js';
import { IdentityQueryPort } from '../../../credential/domain/ports/IdentityQueryPort.port.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

export class InMemoryIdentityQueryAdapter implements IdentityQueryPort {
  constructor(private readonly repo: IdentityRepository) {}

  async findIdentityRefByEmail(email: Email): Promise<IdentityRef | null> {
    const identity = await this.repo.findByEmail(email);
    if (!identity) return null;
    return IdentityRef.fromPrimitive(identity.getId().toPrimitive());
  }
}
