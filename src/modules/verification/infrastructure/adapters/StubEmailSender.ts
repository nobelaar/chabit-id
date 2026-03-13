import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { OtpCode } from '../../domain/value-objects/OtpCode.vo.js';
import { EmailSender } from '../../domain/ports/EmailSender.port.js';

export class StubEmailSender implements EmailSender {
  async sendOtp(email: Email, code: OtpCode): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EMAIL STUB] To: ${email.toPrimitive()} | OTP: ${code.toPrimitive()}`);
    }
  }
}
