export class OtpHash {
    value;
    constructor(value) {
        this.value = value;
    }
    static fromPrimitive(raw) {
        return new OtpHash(raw);
    }
    toPrimitive() {
        return this.value;
    }
    equals(other) {
        return this.value === other.value;
    }
}
