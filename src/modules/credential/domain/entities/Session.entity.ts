import { SessionId } from '../value-objects/SessionId.vo.js';
import { CredentialId } from '../value-objects/CredentialId.vo.js';
import { UpdateToken } from '../value-objects/UpdateToken.vo.js';

export interface SessionPrimitives {
  id: string;
  credentialId: string;
  updateToken: string;
  expiresAt: Date;
  userAgent: string | undefined;
  ipAddress: string | undefined;
  createdAt: Date;
  lastUsedAt: Date;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class Session {
  private readonly id: SessionId;
  private readonly credentialId: CredentialId;
  private updateToken: UpdateToken;
  private expiresAt: Date;
  private readonly userAgent: string | undefined;
  private readonly ipAddress: string | undefined;
  private readonly createdAt: Date;
  private lastUsedAt: Date;

  private constructor(props: {
    id: SessionId; credentialId: CredentialId; updateToken: UpdateToken;
    expiresAt: Date; userAgent: string | undefined; ipAddress: string | undefined;
    createdAt: Date; lastUsedAt: Date;
  }) {
    this.id = props.id; this.credentialId = props.credentialId;
    this.updateToken = props.updateToken; this.expiresAt = props.expiresAt;
    this.userAgent = props.userAgent; this.ipAddress = props.ipAddress;
    this.createdAt = props.createdAt; this.lastUsedAt = props.lastUsedAt;
  }

  static create(props: {
    id: SessionId; credentialId: CredentialId; updateToken: UpdateToken;
    userAgent?: string; ipAddress?: string;
  }): Session {
    const now = new Date();
    return new Session({
      ...props,
      userAgent: props.userAgent,
      ipAddress: props.ipAddress,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      createdAt: now,
      lastUsedAt: now,
    });
  }

  static fromPrimitive(data: SessionPrimitives): Session {
    return new Session({
      id: SessionId.fromPrimitive(data.id),
      credentialId: CredentialId.fromPrimitive(data.credentialId),
      updateToken: UpdateToken.fromPrimitive(data.updateToken),
      expiresAt: data.expiresAt,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
      createdAt: data.createdAt,
      lastUsedAt: data.lastUsedAt,
    });
  }

  rotate(newToken: UpdateToken): void {
    this.updateToken = newToken;
    const now = new Date();
    this.expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    this.lastUsedAt = now;
  }

  isExpired(): boolean { return this.expiresAt < new Date(); }

  getId(): SessionId { return this.id; }
  getCredentialId(): CredentialId { return this.credentialId; }
  getUpdateToken(): UpdateToken { return this.updateToken; }
  getExpiresAt(): Date { return this.expiresAt; }
  getUserAgent(): string | undefined { return this.userAgent; }
  getIpAddress(): string | undefined { return this.ipAddress; }
  getCreatedAt(): Date { return this.createdAt; }
  getLastUsedAt(): Date { return this.lastUsedAt; }

  toPrimitive(): SessionPrimitives {
    return {
      id: this.id.toPrimitive(),
      credentialId: this.credentialId.toPrimitive(),
      updateToken: this.updateToken.toPrimitive(),
      expiresAt: this.expiresAt,
      userAgent: this.userAgent,
      ipAddress: this.ipAddress,
      createdAt: this.createdAt,
      lastUsedAt: this.lastUsedAt,
    };
  }
}
