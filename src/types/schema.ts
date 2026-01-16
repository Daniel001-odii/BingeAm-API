
import { z } from 'zod';

// Auth Schemas
export const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    username: z.string().min(3, 'Username must be at least 3 characters').max(30)
});

export const loginSchema = z.object({
    emailOrUsername: z.string().min(1, 'Email or username is required'),
    password: z.string().min(1, 'Password is required')
});

export const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email address')
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters')
});

export const deleteAccountSchema = z.object({
    password: z.string().min(1, 'Password is required')
});

// Profile Schemas
export const updateProfileSchema = z.object({
    username: z.string().min(3).max(30).optional()
});

// Channel Schemas
export const channelQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(30),
    search: z.string().optional(),
    category: z.string().optional(),
    country: z.string().optional(),
    language: z.string().optional(),
    hasStream: z.enum(['true', 'false']).default('true').transform(val => val === 'true'),
    sort: z.enum(['name', 'newest']).default('name')
});

// Favorite Schemas
export const addFavoriteSchema = z.object({
    channelId: z.string().min(1, 'Channel ID is required')
});

// Types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChannelQuery = z.infer<typeof channelQuerySchema>;
export type AddFavoriteInput = z.infer<typeof addFavoriteSchema>;