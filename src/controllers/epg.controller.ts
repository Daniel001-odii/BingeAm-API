import { Request, Response } from 'express';
import { epgService } from '../services/epg.services';

export const getNowPlaying = async (req: Request, res: Response) => {
    const { channelId } = req.params;

    const nowPlaying = await epgService.getNowPlaying(channelId);

    res.json({
        status: 'success',
        data: nowPlaying
    });
};

export const getSchedule = async (req: Request, res: Response) => {
    const { channelId } = req.params;

    const schedule = await epgService.getChannelSchedule(channelId);

    res.json({
        status: 'success',
        data: schedule
    });
};

export const getAvailability = async (req: Request, res: Response) => {
    // Since we fetch EPG on demand based on country, we don't have a static list of "available" channels
    // unless we scan all countries on startup (expensive).
    // For now, return empty or implement a different strategy if needed.

    res.json({
        status: 'success',
        data: {
            channels: [],
            pagination: {
                page: 1,
                limit: 10,
                total: 0,
                totalPages: 0
            }
        }
    });
};
