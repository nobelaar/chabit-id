import { SessionId } from '../value-objects/SessionId.vo.js';
import { CredentialId } from '../value-objects/CredentialId.vo.js';
import { UpdateToken } from '../value-objects/UpdateToken.vo.js';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export class Session {
    id;
    credentialId;
    updateToken;
    expiresAt;
    userAgent;
    ipAddress;
    createdAt;
    lastUsedAt;
    constructor(props) {
        this.id = props.id;
        this.credentialId = props.credentialId;
        this.updateToken = props.updateToken;
        this.expiresAt = props.expiresAt;
        this.userAgent = props.userAgent;
        this.ipAddress = props.ipAddress;
        this.createdAt = props.createdAt;
        this.lastUsedAt = props.lastUsedAt;
    }
    static create(props) {
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
    static fromPrimitive(data) {
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
    rotate(newToken) {
        this.updateToken = newToken;
        const now = new Date();
        this.expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
        this.lastUsedAt = now;
    }
    isExpired() { return this.expiresAt < new Date(); }
    getId() { return this.id; }
    getCredentialId() { return this.credentialId; }
    getUpdateToken() { return this.updateToken; }
    getExpiresAt() { return this.expiresAt; }
    getUserAgent() { return this.userAgent; }
    getIpAddress() { return this.ipAddress; }
    getCreatedAt() { return this.createdAt; }
    getLastUsedAt() { return this.lastUsedAt; }
    toPrimitive() {
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
