import { CredentialId } from '../value-objects/CredentialId.vo.js';
import { Username } from '../value-objects/Username.vo.js';
import { PasswordHash } from '../value-objects/PasswordHash.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export interface CredentialPrimitives {
  id: string;
  identityRef: string;
  username: string;
  passwordHash: string;
  usernameChangedAt: Date | undefined;
  failedAttempts: number;
  lockedUntil: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export class Credential {
  private readonly id: CredentialId;
  private readonly identityRef: IdentityRef;
  private username: Username;
  private passwordHash: PasswordHash;
  private usernameChangedAt: Date | undefined;
  private failedAttempts: number;
  private lockedUntil: Date | undefined;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: {
    id: CredentialId; identityRef: IdentityRef; username: Username;
    passwordHash: PasswordHash; usernameChangedAt: Date | undefined;
    failedAttempts: number; lockedUntil: Date | undefined;
    createdAt: Date; updatedAt: Date;
  }) {
    this.id = props.id; this.identityRef = props.identityRef;
    this.username = props.username; this.passwordHash = props.passwordHash;
    this.usernameChangedAt = props.usernameChangedAt;
    this.failedAttempts = props.failedAttempts;
    this.lockedUntil = props.lockedUntil;
    this.createdAt = props.createdAt; this.updatedAt = props.updatedAt;
  }

  static create(props: {
    id: CredentialId; identityRef: IdentityRef; username: Username; passwordHash: PasswordHash;
  }): Credential {
    const now = new Date();
    return new Credential({
      ...props, usernameChangedAt: undefined,
      failedAttempts: 0, lockedUntil: undefined,
      createdAt: now, updatedAt: now,
    });
  }

  static fromPrimitive(data: CredentialPrimitives): Credential {
    return new Credential({
      id: CredentialId.fromPrimitive(data.id),
      identityRef: IdentityRef.fromPrimitive(data.identityRef),
      username: Username.fromPrimitive(data.username),
      passwordHash: PasswordHash.fromPrimitive(data.passwordHash),
      usernameChangedAt: data.usernameChangedAt,
      failedAttempts: data.failedAttempts,
      lockedUntil: data.lockedUntil,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  isLocked(): boolean {
    return !!this.lockedUntil && this.lockedUntil > new Date();
  }

  recordFailedAttempt(): void {
    this.failedAttempts += 1;
    if (this.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      this.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }
    this.updatedAt = new Date();
  }

  resetFailedAttempts(): void {
    this.failedAttempts = 0;
    this.lockedUntil = undefined;
    this.updatedAt = new Date();
  }

  updatePassword(newHash: PasswordHash): void {
    this.passwordHash = newHash;
    this.updatedAt = new Date();
  }

  changeUsername(newUsername: Username): void {
    this.username = newUsername;
    this.usernameChangedAt = new Date();
    this.updatedAt = new Date();
  }

  getId(): CredentialId { return this.id; }
  getIdentityRef(): IdentityRef { return this.identityRef; }
  getUsername(): Username { return this.username; }
  getPasswordHash(): PasswordHash { return this.passwordHash; }
  getUsernameChangedAt(): Date | undefined { return this.usernameChangedAt; }
  getLockedUntil(): Date | undefined { return this.lockedUntil; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }

  toPrimitive(): CredentialPrimitives {
    return {
      id: this.id.toPrimitive(),
      identityRef: this.identityRef.toPrimitive(),
      username: this.username.toPrimitive(),
      passwordHash: this.passwordHash.toPrimitive(),
      usernameChangedAt: this.usernameChangedAt,
      failedAttempts: this.failedAttempts,
      lockedUntil: this.lockedUntil,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
