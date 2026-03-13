import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { OtpHash } from '../../domain/value-objects/OtpHash.vo.js';
import { OtpSalt } from '../../domain/value-objects/OtpSalt.vo.js';
export class HmacOtpHasher {
    hash(code, salt) {
        // OTP is the HMAC key (the secret), salt is the per-record nonce (the message).
        const digest = createHmac('sha256', code.toPrimitive())
            .update(salt.toPrimitive())
            .digest('hex');
        return OtpHash.fromPrimitive(digest);
    }
    verify(code, salt, hash) {
        const computed = Buffer.from(this.hash(code, salt).toPrimitive(), 'hex');
        const stored = Buffer.from(hash.toPrimitive(), 'hex');
        if (computed.length !== stored.length)
            return false;
        return timingSafeEqual(computed, stored);
    }
    generateSalt() {
        return OtpSalt.fromPrimitive(randomBytes(32).toString('hex'));
    }
}
