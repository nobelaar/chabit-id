import { z } from 'zod';

export const requestVerificationSchema = z.object({
  email: z.string().email().max(254),
});

export const verifyEmailSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 numeric digits'),
});
