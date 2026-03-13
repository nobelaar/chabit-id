import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { VerificationId } from '../value-objects/VerificationId.vo.js';
import { VerificationStatus } from '../value-objects/VerificationStatus.vo.js';
import { OtpHash } from '../value-objects/OtpHash.vo.js';
import { OtpSalt } from '../value-objects/OtpSalt.vo.js';
import { InvalidStatusTransitionError } from '../errors/Verification.errors.js';
export class EmailVerification {
    id;
    email;
    otpHash;
    otpSalt;
    status;
    attempts;
    maxAttempts;
    expiresAt;
    sentAt;
    usedAt;
    blockedAt;
    identityId;
    constructor(props) {
        this.id = props.id;
        this.identityId = props.identityId;
        this.email = props.email;
        this.otpHash = props.otpHash;
        this.otpSalt = props.otpSalt;
        this.status = props.status;
        this.attempts = props.attempts;
        this.maxAttempts = props.maxAttempts;
        this.expiresAt = props.expiresAt;
        this.sentAt = props.sentAt;
        this.usedAt = props.usedAt;
        this.blockedAt = props.blockedAt;
    }
    /** Factory: creates a new verification — id is undefined until persisted */
    static create(props) {
        return new EmailVerification({
            id: undefined,
            identityId: undefined,
            email: props.email,
            otpHash: props.otpHash,
            otpSalt: props.otpSalt,
            status: VerificationStatus.pending(),
            attempts: 0,
            maxAttempts: props.maxAttempts,
            expiresAt: props.expiresAt,
            sentAt: new Date(),
            usedAt: undefined,
            blockedAt: undefined,
        });
    }
    /** Factory: reconstructs from persistence */
    static fromPrimitive(data) {
        return new EmailVerification({
            id: data.id !== undefined ? VerificationId.fromPrimitive(data.id) : undefined,
            identityId: data.identityId,
            email: Email.fromPrimitive(data.email),
            otpHash: OtpHash.fromPrimitive(data.otpHash),
            otpSalt: OtpSalt.fromPrimitive(data.otpSalt),
            status: VerificationStatus.fromPrimitive(data.status),
            attempts: data.attempts,
            maxAttempts: data.maxAttempts,
            expiresAt: data.expiresAt,
            sentAt: data.sentAt,
            usedAt: data.usedAt,
            blockedAt: data.blockedAt,
        });
    }
    // ── Business logic ────────────────────────────────────────────────
    isExpired() {
        return this.status.isPending() && this.expiresAt < new Date();
    }
    expire() {
        if (!this.status.isPending()) {
            throw new InvalidStatusTransitionError(this.status.toPrimitive(), 'EXPIRED');
        }
        this.status = VerificationStatus.expired();
    }
    attempt(code, hasher) {
        if (!this.status.isPending()) {
            throw new InvalidStatusTransitionError(this.status.toPrimitive(), 'ATTEMPT');
        }
        // 1. Increment attempts first (counts even on success)
        this.attempts += 1;
        // 2. Verify match — if correct, succeed regardless of attempt count
        const isMatch = hasher.verify(code, this.otpSalt, this.otpHash);
        if (isMatch) {
            this.status = VerificationStatus.used();
            this.usedAt = new Date();
            return 'used';
        }
        // 3. Block if max attempts exhausted
        if (this.attempts >= this.maxAttempts) {
            this.status = VerificationStatus.blocked();
            this.blockedAt = new Date();
            return 'blocked';
        }
        return 'wrong_code';
    }
    linkToIdentity(ref) {
        if (this.identityId !== undefined) {
            throw new Error(`Verification is already linked to identity: ${this.identityId}`);
        }
        this.identityId = ref.toPrimitive();
    }
    assignId(id) {
        if (this.id !== undefined) {
            throw new Error('Verification already has an ID');
        }
        this.id = id;
    }
    // ── Queries ───────────────────────────────────────────────────────
    getId() {
        if (this.id === undefined) {
            throw new Error('Verification does not have an ID yet (not persisted)');
        }
        return this.id;
    }
    getEmail() {
        return this.email;
    }
    getStatus() {
        return this.status;
    }
    getAttempts() {
        return this.attempts;
    }
    getMaxAttempts() {
        return this.maxAttempts;
    }
    getSentAt() {
        return this.sentAt;
    }
    getExpiresAt() {
        return this.expiresAt;
    }
    getUsedAt() {
        return this.usedAt;
    }
    getBlockedAt() {
        return this.blockedAt;
    }
    // ── Serialization ─────────────────────────────────────────────────
    toPrimitive() {
        return {
            id: this.id?.toPrimitive(),
            identityId: this.identityId,
            email: this.email.toPrimitive(),
            otpHash: this.otpHash.toPrimitive(),
            otpSalt: this.otpSalt.toPrimitive(),
            status: this.status.toPrimitive(),
            attempts: this.attempts,
            maxAttempts: this.maxAttempts,
            expiresAt: this.expiresAt,
            sentAt: this.sentAt,
            usedAt: this.usedAt,
            blockedAt: this.blockedAt,
        };
    }
}
