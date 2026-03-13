import { AccountId } from '../value-objects/AccountId.vo.js';
import { AccountType } from '../value-objects/AccountType.vo.js';
import { AccountStatus } from '../value-objects/AccountStatus.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { InvalidStatusTransitionError } from '../errors/Account.errors.js';
export class Account {
    id;
    identityRef;
    type;
    status;
    createdBy;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.identityRef = props.identityRef;
        this.type = props.type;
        this.status = props.status;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    static createUser(id, identityRef) {
        const now = new Date();
        return new Account({ id, identityRef, type: AccountType.user(), status: AccountStatus.active(), createdBy: undefined, createdAt: now, updatedAt: now });
    }
    static createOrganizer(id, identityRef) {
        const now = new Date();
        return new Account({ id, identityRef, type: AccountType.organizer(), status: AccountStatus.pending(), createdBy: undefined, createdAt: now, updatedAt: now });
    }
    static createAdmin(id, identityRef, createdBy) {
        const now = new Date();
        return new Account({ id, identityRef, type: AccountType.admin(), status: AccountStatus.active(), createdBy, createdAt: now, updatedAt: now });
    }
    static fromPrimitive(data) {
        return new Account({
            id: AccountId.fromPrimitive(data.id),
            identityRef: IdentityRef.fromPrimitive(data.identityRef),
            type: AccountType.fromPrimitive(data.type),
            status: AccountStatus.fromPrimitive(data.status),
            createdBy: data.createdBy ? IdentityRef.fromPrimitive(data.createdBy) : undefined,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        });
    }
    approve() {
        if (!this.type.isOrganizer() || !this.status.isPending()) {
            throw new InvalidStatusTransitionError(this.type.toPrimitive(), this.status.toPrimitive(), 'approve');
        }
        this.status = AccountStatus.active();
        this.updatedAt = new Date();
    }
    reject() {
        if (!this.type.isOrganizer() || !this.status.isPending()) {
            throw new InvalidStatusTransitionError(this.type.toPrimitive(), this.status.toPrimitive(), 'reject');
        }
        this.status = AccountStatus.rejected();
        this.updatedAt = new Date();
    }
    reRequest() {
        if (!this.type.isOrganizer() || !this.status.isRejected()) {
            throw new InvalidStatusTransitionError(this.type.toPrimitive(), this.status.toPrimitive(), 'reRequest');
        }
        this.status = AccountStatus.pending();
        this.updatedAt = new Date();
    }
    deactivate() {
        if (!this.status.isActive()) {
            throw new InvalidStatusTransitionError(this.type.toPrimitive(), this.status.toPrimitive(), 'deactivate');
        }
        this.status = AccountStatus.deactivated();
        this.updatedAt = new Date();
    }
    reactivate() {
        if (!this.status.isDeactivated()) {
            throw new InvalidStatusTransitionError(this.type.toPrimitive(), this.status.toPrimitive(), 'reactivate');
        }
        this.status = AccountStatus.active();
        this.updatedAt = new Date();
    }
    getId() { return this.id; }
    getIdentityRef() { return this.identityRef; }
    getType() { return this.type; }
    getStatus() { return this.status; }
    getCreatedBy() { return this.createdBy; }
    getCreatedAt() { return this.createdAt; }
    getUpdatedAt() { return this.updatedAt; }
    toPrimitive() {
        return {
            id: this.id.toPrimitive(),
            identityRef: this.identityRef.toPrimitive(),
            type: this.type.toPrimitive(),
            status: this.status.toPrimitive(),
            createdBy: this.createdBy?.toPrimitive(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}
