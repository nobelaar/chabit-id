import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';
import { SessionRepository } from '../../domain/ports/SessionRepository.port.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { CredentialNotFoundError } from '../../domain/errors/Credential.errors.js';

export interface RevokeAllTokensDto { identityRef: string; }

export class RevokeAllTokensUseCase {
  constructor(
    private readonly credentialRepo: CredentialRepository,
    private readonly sessionRepo: SessionRepository,
  ) {}

  async execute(dto: RevokeAllTokensDto): Promise<void> {
    const ref = IdentityRef.fromPrimitive(dto.identityRef);
    const credential = await this.credentialRepo.findByIdentityRef(ref);
    if (!credential) throw new CredentialNotFoundError();
    await this.sessionRepo.deleteAllByCredentialId(credential.getId());
  }
}
