import { CredentialId } from '../value-objects/CredentialId.vo.js';
import { Username } from '../value-objects/Username.vo.js';
import { PasswordHash } from '../value-objects/PasswordHash.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

export interface CredentialPrimitives {
  id: string;
  identityRef: string;
  username: string;
  passwordHash: string;
  usernameChangedAt: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export class Credential {
  private readonly id: CredentialId;
  private readonly identityRef: IdentityRef;
  private username: Username;
  private passwordHash: PasswordHash;
  private usernameChangedAt: Date | undefined;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: {
    id: CredentialId; identityRef: IdentityRef; username: Username;
    passwordHash: PasswordHash; usernameChangedAt: Date | undefined;
    createdAt: Date; updatedAt: Date;
  }) {
    this.id = props.id; this.identityRef = props.identityRef;
    this.username = props.username; this.passwordHash = props.passwordHash;
    this.usernameChangedAt = props.usernameChangedAt;
    this.createdAt = props.createdAt; this.updatedAt = props.updatedAt;
  }

  static create(props: {
    id: CredentialId; identityRef: IdentityRef; username: Username; passwordHash: PasswordHash;
  }): Credential {
    const now = new Date();
    return new Credential({ ...props, usernameChangedAt: undefined, createdAt: now, updatedAt: now });
  }

  static fromPrimitive(data: CredentialPrimitives): Credential {
    return new Credential({
      id: CredentialId.fromPrimitive(data.id),
      identityRef: IdentityRef.fromPrimitive(data.identityRef),
      username: Username.fromPrimitive(data.username),
      passwordHash: PasswordHash.fromPrimitive(data.passwordHash),
      usernameChangedAt: data.usernameChangedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
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
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }

  toPrimitive(): CredentialPrimitives {
    return {
      id: this.id.toPrimitive(),
      identityRef: this.identityRef.toPrimitive(),
      username: this.username.toPrimitive(),
      passwordHash: this.passwordHash.toPrimitive(),
      usernameChangedAt: this.usernameChangedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
