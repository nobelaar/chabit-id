import bcrypt from 'bcryptjs';
import { PasswordHash } from '../../domain/value-objects/PasswordHash.vo.js';
export class BcryptPasswordHasher {
    rounds;
    constructor(rounds = 10) {
        this.rounds = rounds;
    }
    async hash(raw) {
        const hashed = await bcrypt.hash(raw.toPrimitive(), this.rounds);
        return PasswordHash.fromPrimitive(hashed);
    }
    async compare(raw, hash) {
        return bcrypt.compare(raw.toPrimitive(), hash.toPrimitive());
    }
}
