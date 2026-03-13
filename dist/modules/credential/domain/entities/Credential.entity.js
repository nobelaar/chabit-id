import { CredentialId } from '../value-objects/CredentialId.vo.js';
import { Username } from '../value-objects/Username.vo.js';
import { PasswordHash } from '../value-objects/PasswordHash.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
export class Credential {
    id;
    identityRef;
    username;
    passwordHash;
    usernameChangedAt;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.identityRef = props.identityRef;
        this.username = props.username;
        this.passwordHash = props.passwordHash;
        this.usernameChangedAt = props.usernameChangedAt;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    static create(props) {
        const now = new Date();
        return new Credential({ ...props, usernameChangedAt: undefined, createdAt: now, updatedAt: now });
    }
    static fromPrimitive(data) {
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
    updatePassword(newHash) {
        this.passwordHash = newHash;
        this.updatedAt = new Date();
    }
    changeUsername(newUsername) {
        this.username = newUsername;
        this.usernameChangedAt = new Date();
        this.updatedAt = new Date();
    }
    getId() { return this.id; }
    getIdentityRef() { return this.identityRef; }
    getUsername() { return this.username; }
    getPasswordHash() { return this.passwordHash; }
    getUsernameChangedAt() { return this.usernameChangedAt; }
    getCreatedAt() { return this.createdAt; }
    getUpdatedAt() { return this.updatedAt; }
    toPrimitive() {
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
