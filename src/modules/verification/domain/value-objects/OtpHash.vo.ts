export class OtpHash {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static fromPrimitive(raw: string): OtpHash {
    return new OtpHash(raw);
  }

  toPrimitive(): string {
    return this.value;
  }

  equals(other: OtpHash): boolean {
    return this.value === other.value;
  }
}
