import { Request, Response } from 'express';
import { localEpgService } from '../services/localEpg.service';

export const getLocalNowPlaying = async (req: Request, res: Response) => {
    const { channelId } = req.params;

    const nowPlaying = await localEpgService.getNowPlaying(channelId);

    res.json({
        status: 'success',
        data: nowPlaying
    });
};

export const getLocalSchedule = async (req: Request, res: Response) => {
    const { channelId } = req.params;

    const schedule = await localEpgService.getChannelSchedule(channelId);

    res.json({
        status: 'success',
        data: schedule
    });
};
