import { Credential } from '../entities/Credential.entity.js';
import { CredentialId } from '../value-objects/CredentialId.vo.js';
import { Username } from '../value-objects/Username.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

export interface CredentialRepository {
  save(credential: Credential): Promise<void>;
  findById(id: CredentialId): Promise<Credential | null>;
  findByUsername(username: Username): Promise<Credential | null>;
  findByIdentityRef(ref: IdentityRef): Promise<Credential | null>;
  hardDelete(id: CredentialId): Promise<void>;
}
