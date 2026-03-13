import { randomInt } from 'node:crypto';
import { OtpCode } from '../../domain/value-objects/OtpCode.vo.js';
export class CryptoOtpGenerator {
    generate() {
        const n = randomInt(0, 1_000_000);
        return OtpCode.fromPrimitive(n.toString().padStart(6, '0'));
    }
}
