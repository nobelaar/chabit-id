import { z } from 'zod';

export const signInSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  updateToken: z.string().uuid(),
});
