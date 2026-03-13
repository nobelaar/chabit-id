export class OtpSalt {
    value;
    constructor(value) {
        this.value = value;
    }
    static fromPrimitive(raw) {
        return new OtpSalt(raw);
    }
    toPrimitive() {
        return this.value;
    }
}
