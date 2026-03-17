import { describe, it, expect } from 'vitest';
import { Account } from './Account.entity.js';
import { AccountId } from '../value-objects/AccountId.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { InvalidStatusTransitionError } from '../errors/Account.errors.js';

const makeId = () => AccountId.generate();
const makeRef = () => IdentityRef.fromPrimitive('00000000-0000-4000-8000-000000000001');
const makeRef2 = () => IdentityRef.fromPrimitive('00000000-0000-4000-8000-000000000002');

describe('Account entity', () => {
  describe('createUser()', () => {
    it('starts with type USER and status ACTIVE', () => {
      const a = Account.createUser(makeId(), makeRef());
      expect(a.getType().toPrimitive()).toBe('USER');
      expect(a.getStatus().toPrimitive()).toBe('ACTIVE');
      expect(a.getCreatedBy()).toBeUndefined();
    });
  });

  describe('createOrganizer()', () => {
    it('starts with type ORGANIZER and status PENDING', () => {
      const a = Account.createOrganizer(makeId(), makeRef());
      expect(a.getType().toPrimitive()).toBe('ORGANIZER');
      expect(a.getStatus().toPrimitive()).toBe('PENDING');
    });
  });

  describe('createAdmin()', () => {
    it('starts with type ADMIN and status ACTIVE with createdBy', () => {
      const a = Account.createAdmin(makeId(), makeRef(), makeRef2());
      expect(a.getType().toPrimitive()).toBe('ADMIN');
      expect(a.getStatus().toPrimitive()).toBe('ACTIVE');
      expect(a.getCreatedBy()?.toPrimitive()).toBe(makeRef2().toPrimitive());
    });
  });

  describe('approve()', () => {
    it('transitions PENDING ORGANIZER to ACTIVE', () => {
      const a = Account.createOrganizer(makeId(), makeRef());
      a.approve();
      expect(a.getStatus().toPrimitive()).toBe('ACTIVE');
    });

    it('throws on USER account', () => {
      const a = Account.createUser(makeId(), makeRef());
      expect(() => a.approve()).toThrow(InvalidStatusTransitionError);
    });

    it('throws on already ACTIVE organizer', () => {
      const a = Account.createOrganizer(makeId(), makeRef());
      a.approve();
      expect(() => a.approve()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('reject()', () => {
    it('transitions PENDING ORGANIZER to REJECTED', () => {
      const a = Account.createOrganizer(makeId(), makeRef());
      a.reject();
      expect(a.getStatus().toPrimitive()).toBe('REJECTED');
    });

    it('throws on non-PENDING organizer', () => {
      const a = Account.createOrganizer(makeId(), makeRef());
      a.approve();
      expect(() => a.reject()).toThrow(InvalidStatusTransitionError);
    });

    it('throws on USER account', () => {
      const a = Account.createUser(makeId(), makeRef());
      expect(() => a.reject()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('reRequest()', () => {
    it('transitions REJECTED ORGANIZER back to PENDING', () => {
      const a = Account.createOrganizer(makeId(), makeRef());
      a.reject();
      a.reRequest();
      expect(a.getStatus().toPrimitive()).toBe('PENDING');
    });

    it('throws if organizer is PENDING (not REJECTED)', () => {
      const a = Account.createOrganizer(makeId(), makeRef());
      expect(() => a.reRequest()).toThrow(InvalidStatusTransitionError);
    });

    it('throws on USER account', () => {
      const a = Account.createUser(makeId(), makeRef());
      expect(() => a.reRequest()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('deactivate()', () => {
    it('transitions ACTIVE to DEACTIVATED', () => {
      const a = Account.createUser(makeId(), makeRef());
      a.deactivate();
      expect(a.getStatus().toPrimitive()).toBe('DEACTIVATED');
    });

    it('throws when already DEACTIVATED', () => {
      const a = Account.createUser(makeId(), makeRef());
      a.deactivate();
      expect(() => a.deactivate()).toThrow(InvalidStatusTransitionError);
    });

    it('throws on PENDING organizer', () => {
      const a = Account.createOrganizer(makeId(), makeRef());
      expect(() => a.deactivate()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('reactivate()', () => {
    it('transitions DEACTIVATED to ACTIVE', () => {
      const a = Account.createUser(makeId(), makeRef());
      a.deactivate();
      a.reactivate();
      expect(a.getStatus().toPrimitive()).toBe('ACTIVE');
    });

    it('throws if not DEACTIVATED', () => {
      const a = Account.createUser(makeId(), makeRef());
      expect(() => a.reactivate()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('createStaff()', () => {
    it('starts with type STAFF and status PENDING', () => {
      const a = Account.createStaff(makeId(), makeRef());
      expect(a.getType().toPrimitive()).toBe('STAFF');
      expect(a.getStatus().toPrimitive()).toBe('PENDING');
      expect(a.getCreatedBy()).toBeUndefined();
    });
  });

  describe('approve() — STAFF', () => {
    it('transitions PENDING STAFF to ACTIVE', () => {
      const a = Account.createStaff(makeId(), makeRef());
      a.approve();
      expect(a.getStatus().toPrimitive()).toBe('ACTIVE');
    });

    it('throws on already ACTIVE staff', () => {
      const a = Account.createStaff(makeId(), makeRef());
      a.approve();
      expect(() => a.approve()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('reject() — STAFF', () => {
    it('transitions PENDING STAFF to REJECTED', () => {
      const a = Account.createStaff(makeId(), makeRef());
      a.reject();
      expect(a.getStatus().toPrimitive()).toBe('REJECTED');
    });

    it('throws on already ACTIVE staff', () => {
      const a = Account.createStaff(makeId(), makeRef());
      a.approve();
      expect(() => a.reject()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('reRequest() — STAFF', () => {
    it('transitions REJECTED STAFF back to PENDING', () => {
      const a = Account.createStaff(makeId(), makeRef());
      a.reject();
      a.reRequest();
      expect(a.getStatus().toPrimitive()).toBe('PENDING');
    });

    it('throws if STAFF is PENDING (not REJECTED)', () => {
      const a = Account.createStaff(makeId(), makeRef());
      expect(() => a.reRequest()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('fromPrimitive() / toPrimitive()', () => {
    it('round-trips correctly', () => {
      const a = Account.createAdmin(makeId(), makeRef(), makeRef2());
      const p = a.toPrimitive();
      const b = Account.fromPrimitive(p);
      expect(b.toPrimitive()).toEqual(p);
    });

    it('round-trips without createdBy', () => {
      const a = Account.createUser(makeId(), makeRef());
      const p = a.toPrimitive();
      const b = Account.fromPrimitive(p);
      expect(b.toPrimitive()).toEqual(p);
      expect(b.getCreatedBy()).toBeUndefined();
    });
  });
});
