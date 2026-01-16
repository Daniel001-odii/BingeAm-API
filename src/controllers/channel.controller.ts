
import { Request, Response } from 'express';
import { channelQuerySchema } from '../types/schema';
import { AppError } from '../utils/AppError';
import { iptvService } from '../services/iptv.services';

/**
 * GET /channels
 * Get paginated channels with filtering
 */
export const getChannels = async (req: Request, res: Response) => {
    const query = channelQuerySchema.parse(req.query);

    const result = await iptvService.getChannels(query);

    res.json({
        status: 'success',
        data: result
    });
};

/**
 * GET /channels/:channelId
 * Get single channel details
 */
export const getChannelById = async (req: Request, res: Response) => {
    const { channelId } = req.params;

    const channel = await iptvService.getChannelById(channelId);

    if (!channel) {
        throw new AppError('Channel not found', 404);
    }

    res.json({
        status: 'success',
        data: { channel }
    });
};

/**
 * GET /categories
 * Get all categories with channel counts
 */
export const getCategories = async (_req: Request, res: Response) => {
    const categories = await iptvService.getCategories();

    res.json({
        status: 'success',
        data: { categories }
    });
};

/**
 * GET /countries
 * Get all countries with channel counts
 */
export const getCountries = async (_req: Request, res: Response) => {
    const countries = await iptvService.getCountries();

    res.json({
        status: 'success',
        data: { countries }
    });
};

/**
 * GET /languages
 * Get all languages with channel counts
 */
export const getLanguages = async (_req: Request, res: Response) => {
    const languages = await iptvService.getLanguages();

    res.json({
        status: 'success',
        data: { languages }
    });
};