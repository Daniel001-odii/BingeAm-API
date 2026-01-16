
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../config/database';
import { UpdateProfileInput } from '../types/schema';
import { AppError } from '../utils/AppError';

/**
 * GET /profile
 * Get current user profile
 */
export const getProfile = async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
            id: true,
            email: true,
            username: true,
            interests: true,
            country: true,
            language: true,
            prefferedDevice: true,
            viewingHabit: true,
            createdAt: true,
            updatedAt: true
        }
    });

    res.json({
        status: 'success',
        data: { user }
    });
};

/**
 * PATCH /profile
 * Update user profile
 */
export const updateProfile = async (req: AuthRequest, res: Response) => {
    const data: UpdateProfileInput = req.body;

    // Check if username is taken
    if (data.username) {
        const existing = await prisma.user.findFirst({
            where: {
                username: data.username,
                id: { not: req.userId }
            }
        });

        if (existing) {
            throw new AppError('Username already taken', 400);
        }
    }

    const user = await prisma.user.update({
        where: { id: req.userId },
        data,
        select: {
            id: true,
            email: true,
            username: true,
            interests: true,
            country: true,
            language: true,
            prefferedDevice: true,
            viewingHabit: true,
            updatedAt: true
        }
    });

    res.json({
        status: 'success',
        data: { user }
    });
};