import { z } from 'zod';

// Mirrors Username VO: 3-30 chars, a-z0-9_-, must start/end with alphanumeric
export const usernameCheckSchema = z.object({
  value: z
    .string({ required_error: 'value is required' })
    .min(3, 'min 3 characters')
    .max(30, 'max 30 characters')
    .regex(/^[a-z0-9]([a-z0-9_-]{1,28}[a-z0-9])?$/, 'only a-z, 0-9, _, - allowed; cannot start/end with _ or -'),
});

// Mirrors Email VO: non-empty, max 254 chars, basic @ format
export const emailCheckSchema = z.object({
  value: z
    .string({ required_error: 'value is required' })
    .min(1)
    .max(254)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'invalid email address'),
});

// Mirrors PhoneNumber VO: optional +, then 7-15 digits
export const phoneCheckSchema = z.object({
  value: z
    .string({ required_error: 'value is required' })
    .regex(/^\+?\d{7,15}$/, 'invalid phone number — must be 7-15 digits, optionally prefixed with +'),
});
