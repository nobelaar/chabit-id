import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export class InvalidOtpCodeError extends DomainError {
  constructor(reason: string) {
    super(`Invalid OTP code: ${reason}`);
  }
}

const OTP_REGEX = /^\d{6}$/;

export class OtpCode {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static fromPrimitive(raw: string): OtpCode {
    if (!OTP_REGEX.test(raw)) {
      throw new InvalidOtpCodeError('must be exactly 6 numeric digits');
    }
    return new OtpCode(raw);
  }

  toPrimitive(): string {
    return this.value;
  }

  equals(other: OtpCode): boolean {
    return this.value === other.value;
  }
}
