
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { favoriteService } from '../services/favorite.service';
import { AddFavoriteInput } from '../types/schema';

/**
 * POST /favorites
 * Toggle channel favorite status
 */
export const addFavorite = async (req: AuthRequest, res: Response) => {
    const data: AddFavoriteInput = req.body;

    const result = await favoriteService.toggleFavorite(req.userId!, data.channelId);

    res.status(200).json({
        status: 'success',
        data: result
    });
};

/**
 * DELETE /favorites/:channelId
 * Remove channel from favorites
 */
export const removeFavorite = async (req: AuthRequest, res: Response) => {
    const { channelId } = req.params;

    const result = await favoriteService.removeFavorite(req.userId!, channelId);

    res.json({
        status: 'success',
        data: result
    });
};

/**
 * GET /favorites
 * Get user's favorite channels
 */
export const getFavorites = async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

    const result = await favoriteService.getFavorites(req.userId!, page, limit);

    res.json({
        status: 'success',
        data: result
    });
};
