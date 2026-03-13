import { OtpCode } from '../value-objects/OtpCode.vo.js';
import { OtpHash } from '../value-objects/OtpHash.vo.js';
import { OtpSalt } from '../value-objects/OtpSalt.vo.js';

export interface OtpHasher {
  hash(code: OtpCode, salt: OtpSalt): OtpHash;
  verify(code: OtpCode, salt: OtpSalt, hash: OtpHash): boolean;
  generateSalt(): OtpSalt;
}
