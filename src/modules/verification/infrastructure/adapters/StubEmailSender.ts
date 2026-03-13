import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { OtpCode } from '../../domain/value-objects/OtpCode.vo.js';
import { EmailSender } from '../../domain/ports/EmailSender.port.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class StubEmailSender implements EmailSender {
  readonly sentEmails: { email: string; code: string }[] = [];

  async sendOtp(email: Email, code: OtpCode): Promise<void> {
    this.sentEmails.push({ email: email.toPrimitive(), code: code.toPrimitive() });
    if (process.env.NODE_ENV !== 'production') {
      logger.info({ to: email.toPrimitive(), otp: code.toPrimitive() }, '[EMAIL STUB]');
    }
  }

  getLastCode(email: string): string | undefined {
    const matching = this.sentEmails.filter((e) => e.email === email);
    return matching.at(-1)?.code;
  }
}
