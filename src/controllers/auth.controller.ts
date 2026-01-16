
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { authService } from '../services/auth.service';
import { sendTokenResponse, clearTokenCookie } from '../utils/jwt.util';

import { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput, DeleteAccountInput } from '../types/schema';

/**
 * POST /auth/register
 * Register a new user
 */
export const register = async (req: AuthRequest, res: Response) => {
    const data: RegisterInput = req.body;

    const user = await authService.register(data);
    const token = sendTokenResponse(user.id, res);

    res.status(201).json({
        status: 'success',
        data: {
            user,
            token
        }
    });
};

/**
 * POST /auth/login
 * Login user
 */
export const login = async (req: AuthRequest, res: Response) => {
    const data: LoginInput = req.body;

    const user = await authService.login(data);
    const token = sendTokenResponse(user.id, res);

    res.json({
        status: 'success',
        data: {
            user,
            token
        }
    });
};

/**
 * POST /auth/logout
 * Logout user (clear cookie)
 */
export const logout = async (_req: AuthRequest, res: Response) => {
    clearTokenCookie(res);

    res.json({
        status: 'success',
        message: 'Logged out successfully'
    });
};

/**
 * POST /auth/forgot-password
 * Request password reset
 */
export const forgotPassword = async (req: AuthRequest, res: Response) => {
    const data: ForgotPasswordInput = req.body;

    const result = await authService.forgotPassword(data);

    res.json({
        status: 'success',
        data: result
    });
};

/**
 * POST /auth/reset-password
 * Reset password with token
 */
export const resetPassword = async (req: AuthRequest, res: Response) => {
    const data: ResetPasswordInput = req.body;

    const result = await authService.resetPassword(data);

    res.json({
        status: 'success',
        data: result
    });
};

/**
 * DELETE /auth/account
 * Delete user account
 */
export const deleteAccount = async (req: AuthRequest, res: Response) => {
    const data: DeleteAccountInput = req.body;

    const result = await authService.deleteAccount(req.userId!, data.password);
    clearTokenCookie(res);

    res.json({
        status: 'success',
        data: result
    });
};
