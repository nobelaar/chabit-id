import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class InvalidOtpCodeError extends DomainError {
    constructor(reason) {
        super(`Invalid OTP code: ${reason}`);
    }
}
const OTP_REGEX = /^\d{6}$/;
export class OtpCode {
    value;
    constructor(value) {
        this.value = value;
    }
    static fromPrimitive(raw) {
        if (!OTP_REGEX.test(raw)) {
            throw new InvalidOtpCodeError('must be exactly 6 numeric digits');
        }
        return new OtpCode(raw);
    }
    toPrimitive() {
        return this.value;
    }
    equals(other) {
        return this.value === other.value;
    }
}
