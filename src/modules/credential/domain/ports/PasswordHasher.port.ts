import { RawPassword } from '../value-objects/RawPassword.vo.js';
import { PasswordHash } from '../value-objects/PasswordHash.vo.js';

export interface PasswordHasher {
  hash(raw: RawPassword): Promise<PasswordHash>;
  compare(raw: RawPassword, hash: PasswordHash): Promise<boolean>;
}
