import { z } from 'zod';
export const signInSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});
export const refreshTokenSchema = z.object({
    updateToken: z.string().uuid(),
});
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
});
export const changeUsernameSchema = z.object({
    newUsername: z.string().min(3).max(30),
});
export const resetPasswordSchema = z.object({
    verificationId: z.number().int().positive(),
    code: z.string().length(6),
    email: z.string().email(),
    newPassword: z.string().min(8).max(128),
});
export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});
