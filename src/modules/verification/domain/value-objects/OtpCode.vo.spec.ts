import { describe, it, expect } from 'vitest';
import { OtpCode, InvalidOtpCodeError } from './OtpCode.vo.js';

describe('OtpCode VO', () => {
  it('accepts exactly 6 numeric digits', () => {
    const code = OtpCode.fromPrimitive('123456');
    expect(code.toPrimitive()).toBe('123456');
  });

  it('accepts all-zero code', () => {
    const code = OtpCode.fromPrimitive('000000');
    expect(code.toPrimitive()).toBe('000000');
  });

  it('rejects 5 digits', () => {
    expect(() => OtpCode.fromPrimitive('12345')).toThrow(InvalidOtpCodeError);
  });

  it('rejects 7 digits', () => {
    expect(() => OtpCode.fromPrimitive('1234567')).toThrow(InvalidOtpCodeError);
  });

  it('rejects letters', () => {
    expect(() => OtpCode.fromPrimitive('abc123')).toThrow(InvalidOtpCodeError);
  });

  it('rejects empty string', () => {
    expect(() => OtpCode.fromPrimitive('')).toThrow(InvalidOtpCodeError);
  });

  it('rejects code with spaces', () => {
    expect(() => OtpCode.fromPrimitive('12 456')).toThrow(InvalidOtpCodeError);
  });
});
