import { AccountId } from '../value-objects/AccountId.vo.js';
import { AccountType } from '../value-objects/AccountType.vo.js';
import { AccountStatus } from '../value-objects/AccountStatus.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { InvalidStatusTransitionError } from '../errors/Account.errors.js';

export interface AccountPrimitives {
  id: string;
  identityRef: string;
  type: string;
  status: string;
  createdBy: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export class Account {
  private readonly id: AccountId;
  private readonly identityRef: IdentityRef;
  private readonly type: AccountType;
  private status: AccountStatus;
  private readonly createdBy: IdentityRef | undefined;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: {
    id: AccountId; identityRef: IdentityRef; type: AccountType; status: AccountStatus;
    createdBy: IdentityRef | undefined; createdAt: Date; updatedAt: Date;
  }) {
    this.id = props.id; this.identityRef = props.identityRef;
    this.type = props.type; this.status = props.status;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt; this.updatedAt = props.updatedAt;
  }

  static createUser(id: AccountId, identityRef: IdentityRef): Account {
    const now = new Date();
    return new Account({ id, identityRef, type: AccountType.user(), status: AccountStatus.active(), createdBy: undefined, createdAt: now, updatedAt: now });
  }

  static createOrganizer(id: AccountId, identityRef: IdentityRef): Account {
    const now = new Date();
    return new Account({ id, identityRef, type: AccountType.organizer(), status: AccountStatus.pending(), createdBy: undefined, createdAt: now, updatedAt: now });
  }

  static createAdmin(id: AccountId, identityRef: IdentityRef, createdBy: IdentityRef): Account {
    const now = new Date();
    return new Account({ id, identityRef, type: AccountType.admin(), status: AccountStatus.active(), createdBy, createdAt: now, updatedAt: now });
  }

  static fromPrimitive(data: AccountPrimitives): Account {
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

  approve(): void {
    if (!this.type.isOrganizer() || !this.status.isPending()) {
      throw new InvalidStatusTransitionError(this.type.toPrimitive(), this.status.toPrimitive(), 'approve');
    }
    this.status = AccountStatus.active();
    this.updatedAt = new Date();
  }

  reject(): void {
    if (!this.type.isOrganizer() || !this.status.isPending()) {
      throw new InvalidStatusTransitionError(this.type.toPrimitive(), this.status.toPrimitive(), 'reject');
    }
    this.status = AccountStatus.rejected();
    this.updatedAt = new Date();
  }

  reRequest(): void {
    if (!this.type.isOrganizer() || !this.status.isRejected()) {
      throw new InvalidStatusTransitionError(this.type.toPrimitive(), this.status.toPrimitive(), 'reRequest');
    }
    this.status = AccountStatus.pending();
    this.updatedAt = new Date();
  }

  deactivate(): void {
    if (!this.status.isActive()) {
      throw new InvalidStatusTransitionError(this.type.toPrimitive(), this.status.toPrimitive(), 'deactivate');
    }
    this.status = AccountStatus.deactivated();
    this.updatedAt = new Date();
  }

  reactivate(): void {
    if (!this.status.isDeactivated()) {
      throw new InvalidStatusTransitionError(this.type.toPrimitive(), this.status.toPrimitive(), 'reactivate');
    }
    this.status = AccountStatus.active();
    this.updatedAt = new Date();
  }

  getId(): AccountId { return this.id; }
  getIdentityRef(): IdentityRef { return this.identityRef; }
  getType(): AccountType { return this.type; }
  getStatus(): AccountStatus { return this.status; }
  getCreatedBy(): IdentityRef | undefined { return this.createdBy; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }

  toPrimitive(): AccountPrimitives {
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
