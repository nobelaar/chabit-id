import { OtpCode } from '../value-objects/OtpCode.vo.js';

export interface OtpGenerator {
  generate(): OtpCode;
}
