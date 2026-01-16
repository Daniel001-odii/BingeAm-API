
import prisma from '../config/database';
import { AppError } from '../utils/AppError';
import { hashPassword, comparePassword, generateResetToken } from '../utils/password.util';
import {
    RegisterInput,
    LoginInput,
    ForgotPasswordInput,
    ResetPasswordInput
} from '../types/schema';

class AuthService {
    /**
     * Register new user
     */
    async register(data: RegisterInput) {
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: data.email },
                    { username: data.username }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.email === data.email) {
                throw new AppError('Email already in use', 400);
            }
            throw new AppError('Username already taken', 400);
        }

        const hashedPassword = await hashPassword(data.password);

        const user = await prisma.user.create({
            data: {
                email: data.email,
                username: data.username,
                password: hashedPassword
            },
            select: {
                id: true,
                email: true,
                username: true,
                createdAt: true
            }
        });

        return user;
    }

    /**
     * Login user
     */
    async login(data: LoginInput) {
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: data.emailOrUsername },
                    { username: data.emailOrUsername }
                ]
            }
        });

        if (!user || !(await comparePassword(data.password, user.password))) {
            throw new AppError('Invalid credentials', 401);
        }

        return {
            id: user.id,
            email: user.email,
            username: user.username
        };
    }

    /**
     * Initiate password reset
     */
    async forgotPassword(data: ForgotPasswordInput) {
        const user = await prisma.user.findUnique({
            where: { email: data.email }
        });

        if (!user) {
            // Don't reveal if email exists
            return { message: 'If email exists, reset token will be sent' };
        }

        const resetToken = generateResetToken();
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiry
            }
        });

        // In production, send email here
        // For dev, return token
        if (process.env.NODE_ENV === 'development') {
            return { resetToken };
        }

        return { message: 'Password reset email sent' };
    }

    /**
     * Reset password with token
     */
    async resetPassword(data: ResetPasswordInput) {
        const user = await prisma.user.findFirst({
            where: {
                resetToken: data.token,
                resetTokenExpiry: {
                    gt: new Date()
                }
            }
        });

        if (!user) {
            throw new AppError('Invalid or expired reset token', 400);
        }

        const hashedPassword = await hashPassword(data.newPassword);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        return { message: 'Password reset successful' };
    }

    /**
     * Delete user account
     */
    async deleteAccount(userId: string, password: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user || !(await comparePassword(password, user.password))) {
            throw new AppError('Invalid password', 401);
        }

        await prisma.user.delete({
            where: { id: userId }
        });

        return { message: 'Account deleted successfully' };
    }
}

export const authService = new AuthService();