import { Identity } from '../entities/Identity.entity.js';
import { IdentityId } from '../value-objects/IdentityId.vo.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { PhoneNumber } from '../../../../shared/domain/value-objects/PhoneNumber.vo.js';

export interface IdentityRepository {
  save(identity: Identity): Promise<void>;
  findById(id: IdentityId): Promise<Identity | null>;
  findByEmail(email: Email): Promise<Identity | null>;
  findByPhone(phone: PhoneNumber): Promise<Identity | null>;
  hardDelete(id: IdentityId): Promise<void>;
  anonymize(id: IdentityId): Promise<void>;
}
