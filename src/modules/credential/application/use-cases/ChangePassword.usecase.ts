import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';
import { SessionRepository } from '../../domain/ports/SessionRepository.port.js';
import { PasswordHasher } from '../../domain/ports/PasswordHasher.port.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { SessionId } from '../../domain/value-objects/SessionId.vo.js';
import { RawPassword } from '../../domain/value-objects/RawPassword.vo.js';
import { CredentialNotFoundError, InvalidCredentialsError } from '../../domain/errors/Credential.errors.js';

export interface ChangePasswordDto {
  identityRef: string;
  currentPassword: string;
  newPassword: string;
  currentSessionId: string;
}

export class ChangePasswordUseCase {
  constructor(
    private readonly repo: CredentialRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(dto: ChangePasswordDto): Promise<void> {
    const ref = IdentityRef.fromPrimitive(dto.identityRef);
    const credential = await this.repo.findByIdentityRef(ref);
    if (!credential) throw new CredentialNotFoundError();

    const match = await this.hasher.compare(RawPassword.fromPrimitive(dto.currentPassword), credential.getPasswordHash());
    if (!match) throw new InvalidCredentialsError();

    const newHash = await this.hasher.hash(RawPassword.fromPrimitive(dto.newPassword));
    credential.updatePassword(newHash);
    await this.repo.save(credential);
    await this.sessionRepo.deleteAllByCredentialIdExcept(
      credential.getId(),
      SessionId.fromPrimitive(dto.currentSessionId),
    );
  }
}
