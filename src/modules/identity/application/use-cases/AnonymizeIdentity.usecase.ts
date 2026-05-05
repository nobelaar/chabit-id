import { IdentityRepository } from '../../domain/ports/IdentityRepository.port.js';
import { CredentialRepository } from '../../../credential/domain/ports/CredentialRepository.port.js';
import { SessionRepository } from '../../../credential/domain/ports/SessionRepository.port.js';
import { IdentityId } from '../../domain/value-objects/IdentityId.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

export class IdentityNotFoundError extends Error {
  constructor() { super('Identity not found'); }
}

export class AnonymizeIdentityUseCase {
  constructor(
    private readonly identityRepo: IdentityRepository,
    private readonly credentialRepo: CredentialRepository,
    private readonly sessionRepo: SessionRepository,
  ) {}

  async execute(identityRef: string): Promise<void> {
    const id = IdentityId.fromPrimitive(identityRef);

    const identity = await this.identityRepo.findById(id);
    if (!identity) throw new IdentityNotFoundError();

    // Revoke all sessions and permanently lock the credential
    const credential = await this.credentialRepo.findByIdentityRef(IdentityRef.fromPrimitive(identityRef));
    if (credential) {
      await this.sessionRepo.deleteAllByCredentialId(credential.getId());
      credential.permanentlyLock();
      await this.credentialRepo.save(credential);
    }

    await this.identityRepo.anonymize(id);
  }
}
