
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.util';
import { AppError } from '../utils/AppError';
import prisma from '../config/database';

export interface AuthRequest extends Request {
    userId?: string;
}

/**
 * Protect routes - verify JWT token
 */
export const protect = async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
) => {
    let token: string | undefined;

    // Check for token in cookie or Authorization header
    if (req.cookies.jwt) {
        token = req.cookies.jwt;
    } else if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new AppError('Not authenticated. Please log in.', 401);
    }

    try {
        const decoded = verifyToken(token);

        // Verify user still exists
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true }
        });

        if (!user) {
            throw new AppError('User no longer exists', 401);
        }

        req.userId = decoded.userId;
        next();
    } catch (error) {
        throw new AppError('Invalid or expired token', 401);
    }
};