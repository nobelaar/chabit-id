import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

export interface IdentityQueryPort {
  findIdentityRefByEmail(email: Email): Promise<IdentityRef | null>;
}
