import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { VerificationId } from '../value-objects/VerificationId.vo.js';
import { VerificationStatus } from '../value-objects/VerificationStatus.vo.js';
import { OtpCode } from '../value-objects/OtpCode.vo.js';
import { OtpHash } from '../value-objects/OtpHash.vo.js';
import { OtpSalt } from '../value-objects/OtpSalt.vo.js';
import { OtpHasher } from '../ports/OtpHasher.port.js';
import { InvalidStatusTransitionError } from '../errors/Verification.errors.js';

export type AttemptResult = 'used' | 'blocked' | 'wrong_code';

export interface EmailVerificationPrimitives {
  id: number | undefined;
  identityId: string | undefined;
  email: string;
  otpHash: string;
  otpSalt: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  sentAt: Date;
  usedAt: Date | undefined;
  blockedAt: Date | undefined;
}

export interface CreateEmailVerificationProps {
  email: Email;
  otpHash: OtpHash;
  otpSalt: OtpSalt;
  maxAttempts: number;
  expiresAt: Date;
}

export interface ReconstructEmailVerificationProps {
  id: number;
  identityId: string | undefined;
  email: Email;
  otpHash: OtpHash;
  otpSalt: OtpSalt;
  status: VerificationStatus;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  sentAt: Date;
  usedAt: Date | undefined;
  blockedAt: Date | undefined;
}

export class EmailVerification {
  private id: VerificationId | undefined;
  private readonly email: Email;
  private readonly otpHash: OtpHash;
  private readonly otpSalt: OtpSalt;
  private status: VerificationStatus;
  private attempts: number;
  private readonly maxAttempts: number;
  private readonly expiresAt: Date;
  private readonly sentAt: Date;
  private usedAt: Date | undefined;
  private blockedAt: Date | undefined;
  private identityId: string | undefined;

  private constructor(props: {
    id: VerificationId | undefined;
    identityId: string | undefined;
    email: Email;
    otpHash: OtpHash;
    otpSalt: OtpSalt;
    status: VerificationStatus;
    attempts: number;
    maxAttempts: number;
    expiresAt: Date;
    sentAt: Date;
    usedAt: Date | undefined;
    blockedAt: Date | undefined;
  }) {
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
  static create(props: CreateEmailVerificationProps): EmailVerification {
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
  static fromPrimitive(data: EmailVerificationPrimitives): EmailVerification {
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

  isExpired(): boolean {
    return this.status.isPending() && this.expiresAt < new Date();
  }

  expire(): void {
    if (!this.status.isPending()) {
      throw new InvalidStatusTransitionError(this.status.toPrimitive(), 'EXPIRED');
    }
    this.status = VerificationStatus.expired();
  }

  attempt(code: OtpCode, hasher: OtpHasher): AttemptResult {
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

  linkToIdentity(ref: IdentityRef): void {
    if (this.identityId !== undefined) {
      throw new Error(`Verification is already linked to identity: ${this.identityId}`);
    }
    this.identityId = ref.toPrimitive();
  }

  assignId(id: VerificationId): void {
    if (this.id !== undefined) {
      throw new Error('Verification already has an ID');
    }
    this.id = id;
  }

  // ── Queries ───────────────────────────────────────────────────────

  getId(): VerificationId {
    if (this.id === undefined) {
      throw new Error('Verification does not have an ID yet (not persisted)');
    }
    return this.id;
  }

  getEmail(): Email {
    return this.email;
  }

  getStatus(): VerificationStatus {
    return this.status;
  }

  getAttempts(): number {
    return this.attempts;
  }

  getMaxAttempts(): number {
    return this.maxAttempts;
  }

  getSentAt(): Date {
    return this.sentAt;
  }

  getExpiresAt(): Date {
    return this.expiresAt;
  }

  getUsedAt(): Date | undefined {
    return this.usedAt;
  }

  getBlockedAt(): Date | undefined {
    return this.blockedAt;
  }

  // ── Serialization ─────────────────────────────────────────────────

  toPrimitive(): EmailVerificationPrimitives {
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
