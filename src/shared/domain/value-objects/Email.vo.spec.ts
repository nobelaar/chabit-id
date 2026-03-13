import { describe, it, expect } from 'vitest';
import { Email, InvalidEmailError } from './Email.vo.js';

describe('Email VO', () => {
  it('accepts a valid email', () => {
    const email = Email.fromPrimitive('test@example.com');
    expect(email.toPrimitive()).toBe('test@example.com');
  });

  it('normalizes to lowercase', () => {
    const email = Email.fromPrimitive('User@EXAMPLE.COM');
    expect(email.toPrimitive()).toBe('user@example.com');
  });

  it('trims surrounding whitespace', () => {
    const email = Email.fromPrimitive('  test@example.com  ');
    expect(email.toPrimitive()).toBe('test@example.com');
  });

  it('rejects email without @', () => {
    expect(() => Email.fromPrimitive('invalidemail.com')).toThrow(InvalidEmailError);
  });

  it('rejects email without domain dot', () => {
    expect(() => Email.fromPrimitive('user@nodot')).toThrow(InvalidEmailError);
  });

  it('rejects empty string', () => {
    expect(() => Email.fromPrimitive('')).toThrow(InvalidEmailError);
  });

  it('rejects email exceeding 254 characters', () => {
    const longEmail = 'a'.repeat(251) + '@b.c'; // 255 chars total
    expect(() => Email.fromPrimitive(longEmail)).toThrow(InvalidEmailError);
  });

  it('equals() returns true for same email', () => {
    const a = Email.fromPrimitive('test@example.com');
    const b = Email.fromPrimitive('TEST@EXAMPLE.COM');
    expect(a.equals(b)).toBe(true);
  });

  it('equals() returns false for different emails', () => {
    const a = Email.fromPrimitive('a@example.com');
    const b = Email.fromPrimitive('b@example.com');
    expect(a.equals(b)).toBe(false);
  });
});
