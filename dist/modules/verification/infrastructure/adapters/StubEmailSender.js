import { logger } from '../../../../shared/infrastructure/logger.js';
export class StubEmailSender {
    sentEmails = [];
    async sendOtp(email, code) {
        this.sentEmails.push({ email: email.toPrimitive(), code: code.toPrimitive() });
        if (process.env.NODE_ENV !== 'production') {
            logger.info({ to: email.toPrimitive(), otp: code.toPrimitive() }, '[EMAIL STUB]');
        }
    }
    getLastCode(email) {
        const matching = this.sentEmails.filter((e) => e.email === email);
        return matching.at(-1)?.code;
    }
}
