export class OtpSalt {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static fromPrimitive(raw: string): OtpSalt {
    return new OtpSalt(raw);
  }

  toPrimitive(): string {
    return this.value;
  }
}
