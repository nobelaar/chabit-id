import { z } from 'zod';

export const registerSchema = z.object({
  verificationId: z.number().int().positive(),
  fullName: z.string().min(1).max(150),
  email: z.string().email(),
  phone: z.string().min(7).max(15),
  nationality: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(128),
});
