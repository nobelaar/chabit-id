import { randomInt } from 'node:crypto';
import { OtpCode } from '../../domain/value-objects/OtpCode.vo.js';
import { OtpGenerator } from '../../domain/ports/OtpGenerator.port.js';

export class CryptoOtpGenerator implements OtpGenerator {
  generate(): OtpCode {
    const n = randomInt(0, 1_000_000);
    return OtpCode.fromPrimitive(n.toString().padStart(6, '0'));
  }
}
