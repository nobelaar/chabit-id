import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { OtpCode } from '../value-objects/OtpCode.vo.js';

export interface EmailSender {
  sendOtp(email: Email, code: OtpCode): Promise<void>;
}
