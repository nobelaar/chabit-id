import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';
import { UsernameReservedList } from '../../domain/ports/UsernameReservedList.port.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { Username } from '../../domain/value-objects/Username.vo.js';
import {
  CredentialNotFoundError, CannotChangeUsernameYetError,
  UsernameReservedError, UsernameAlreadyTakenError,
} from '../../domain/errors/Credential.errors.js';

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface ChangeUsernameDto { identityRef: string; newUsername: string; }

export class ChangeUsernameUseCase {
  constructor(
    private readonly repo: CredentialRepository,
    private readonly reservedList: UsernameReservedList,
  ) {}

  async execute(dto: ChangeUsernameDto): Promise<void> {
    const ref = IdentityRef.fromPrimitive(dto.identityRef);
    const credential = await this.repo.findByIdentityRef(ref);
    if (!credential) throw new CredentialNotFoundError();

    const changedAt = credential.getUsernameChangedAt();
    if (changedAt && Date.now() < changedAt.getTime() + COOLDOWN_MS) {
      throw new CannotChangeUsernameYetError(new Date(changedAt.getTime() + COOLDOWN_MS));
    }

    const newUsername = Username.fromPrimitive(dto.newUsername);
    if (this.reservedList.isReserved(newUsername)) throw new UsernameReservedError(dto.newUsername);
    const existing = await this.repo.findByUsername(newUsername);
    if (existing) throw new UsernameAlreadyTakenError(dto.newUsername);

    credential.changeUsername(newUsername);
    await this.repo.save(credential);
  }
}
