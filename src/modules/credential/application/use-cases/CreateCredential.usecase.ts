import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';
import { PasswordHasher } from '../../domain/ports/PasswordHasher.port.js';
import { UsernameReservedList } from '../../domain/ports/UsernameReservedList.port.js';
import { Credential } from '../../domain/entities/Credential.entity.js';
import { CredentialId } from '../../domain/value-objects/CredentialId.vo.js';
import { Username } from '../../domain/value-objects/Username.vo.js';
import { RawPassword } from '../../domain/value-objects/RawPassword.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { UsernameReservedError, UsernameAlreadyTakenError } from '../../domain/errors/Credential.errors.js';

export interface CreateCredentialDto {
  identityRef: string;
  username: string;
  password: string;
}

export interface CreateCredentialResult {
  credentialId: string;
}

export class CreateCredentialUseCase {
  constructor(
    private readonly repo: CredentialRepository,
    private readonly hasher: PasswordHasher,
    private readonly reservedList: UsernameReservedList,
  ) {}

  async execute(dto: CreateCredentialDto): Promise<CreateCredentialResult> {
    const username = Username.fromPrimitive(dto.username);
    if (this.reservedList.isReserved(username)) throw new UsernameReservedError(dto.username);
    const existing = await this.repo.findByUsername(username);
    if (existing) throw new UsernameAlreadyTakenError(dto.username);

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
