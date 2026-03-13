import { describe, it, expect, beforeEach } from 'vitest';
import { EmailVerification } from './EmailVerification.entity.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { OtpHash } from '../value-objects/OtpHash.vo.js';
import { OtpSalt } from '../value-objects/OtpSalt.vo.js';
import { OtpCode } from '../value-objects/OtpCode.vo.js';
import { OtpHasher } from '../ports/OtpHasher.port.js';
import { InvalidStatusTransitionError } from '../errors/Verification.errors.js';

// ── Stub hasher ───────────────────────────────────────────────────────────────

class StubHasher implements OtpHasher {
  hash(code: OtpCode, _salt: OtpSalt): OtpHash {
    return OtpHash.fromPrimitive(`hash:${code.toPrimitive()}`);
  }

  verify(code: OtpCode, salt: OtpSalt, hash: OtpHash): boolean {
    return this.hash(code, salt).toPrimitive() === hash.toPrimitive();
  }

  generateSalt(): OtpSalt {
    return OtpSalt.fromPrimitive('stub-salt');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeVerification(overrides?: { expiresAt?: Date; maxAttempts?: number }) {
  const email = Email.fromPrimitive('test@example.com');
  const code = OtpCode.fromPrimitive('123456');
  const hasher = new StubHasher();
  const salt = hasher.generateSalt();
  const hash = hasher.hash(code, salt);

  return EmailVerification.create({
    email,
    otpHash: hash,
    otpSalt: salt,
    maxAttempts: overrides?.maxAttempts ?? 5,
    expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EmailVerification entity', () => {
  const hasher = new StubHasher();

  describe('create()', () => {
    it('starts with PENDING status and 0 attempts', () => {
      const v = makeVerification();
      expect(v.getStatus().isPending()).toBe(true);
      expect(v.getAttempts()).toBe(0);
    });

    it('has no id until persisted', () => {
      const v = makeVerification();
      expect(() => v.getId()).toThrow();
    });
  });

  describe('isExpired()', () => {
    it('returns false when expiresAt is in the future', () => {
      const v = makeVerification({ expiresAt: new Date(Date.now() + 60_000) });
      expect(v.isExpired()).toBe(false);
    });

    it('returns true when expiresAt is in the past and status is PENDING', () => {
      const v = makeVerification({ expiresAt: new Date(Date.now() - 1) });
      expect(v.isExpired()).toBe(true);
    });
  });

  describe('expire()', () => {
    it('transitions PENDING → EXPIRED', () => {
      const v = makeVerification();
      v.expire();
      expect(v.getStatus().isExpired()).toBe(true);
    });

    it('throws InvalidStatusTransitionError when status is USED', () => {
      const v = makeVerification();
      const code = OtpCode.fromPrimitive('123456');
      v.attempt(code, hasher); // → 'used'
      expect(() => v.expire()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('attempt() — correct code', () => {
    it('returns "used", sets status to USED, sets usedAt, and increments attempts', () => {
      const v = makeVerification();
      const code = OtpCode.fromPrimitive('123456');
      const result = v.attempt(code, hasher);

      expect(result).toBe('used');
      expect(v.getStatus().isUsed()).toBe(true);
      expect(v.getUsedAt()).toBeInstanceOf(Date);
      // attempts is incremented before verifying (per architecture)
      expect(v.getAttempts()).toBe(1);
    });
  });

  describe('attempt() — wrong code', () => {
    it('returns "wrong_code" and increments attempts', () => {
      const v = makeVerification();
      const wrong = OtpCode.fromPrimitive('000000');
      const result = v.attempt(wrong, hasher);

      expect(result).toBe('wrong_code');
      expect(v.getAttempts()).toBe(1);
      expect(v.getStatus().isPending()).toBe(true);
    });
  });

  describe('attempt() — blocking on 5th wrong attempt', () => {
    it('returns "blocked" and sets status to BLOCKED on maxAttempts failures', () => {
      const v = makeVerification({ maxAttempts: 5 });
      const wrong = OtpCode.fromPrimitive('000000');

      let result: string = '';
      for (let i = 0; i < 5; i++) {
        result = v.attempt(wrong, hasher);
      }

      expect(result).toBe('blocked');
      expect(v.getStatus().isBlocked()).toBe(true);
      expect(v.getAttempts()).toBe(5);
    });
  });

  describe('attempt() — correct code on 5th attempt (no block)', () => {
    it('returns "used" even on the final allowed attempt', () => {
      const v = makeVerification({ maxAttempts: 5 });
      const wrong = OtpCode.fromPrimitive('000000');
      const correct = OtpCode.fromPrimitive('123456');

      // 4 wrong attempts
      for (let i = 0; i < 4; i++) {
        v.attempt(wrong, hasher);
      }

      // 5th attempt with correct code
      const result = v.attempt(correct, hasher);

      expect(result).toBe('used');
      expect(v.getStatus().isUsed()).toBe(true);
    });
  });

  describe('attempt() — non-PENDING status guard', () => {
    it('throws InvalidStatusTransitionError when called on a BLOCKED verification', () => {
      const v = makeVerification({ maxAttempts: 1 });
      const wrong = OtpCode.fromPrimitive('000000');
      v.attempt(wrong, hasher); // → 'blocked' (maxAttempts: 1, 1 wrong attempt)

      const code = OtpCode.fromPrimitive('123456');
      expect(() => v.attempt(code, hasher)).toThrow(InvalidStatusTransitionError);
    });
  });
});
