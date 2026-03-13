import bcrypt from 'bcryptjs';
import { PasswordHasher } from '../../domain/ports/PasswordHasher.port.js';
import { RawPassword } from '../../domain/value-objects/RawPassword.vo.js';
import { PasswordHash } from '../../domain/value-objects/PasswordHash.vo.js';

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds = 10) {}

  async hash(raw: RawPassword): Promise<PasswordHash> {
    const hashed = await bcrypt.hash(raw.toPrimitive(), this.rounds);
    return PasswordHash.fromPrimitive(hashed);
  }

  async compare(raw: RawPassword, hash: PasswordHash): Promise<boolean> {
    return bcrypt.compare(raw.toPrimitive(), hash.toPrimitive());
  }
}
