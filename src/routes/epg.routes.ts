import { Router } from 'express';
import { getNowPlaying, getSchedule } from '../controllers/epg.controller';
import { getLocalNowPlaying, getLocalSchedule } from '../controllers/localEpg.controller';

const router = Router();

// GitHub-based EPG routes (Original)
router.get('/:channelId/now', getNowPlaying);
router.get('/:channelId/schedule', getSchedule);

// Local EPG routes (New)
router.get('/local/:channelId/now', getLocalNowPlaying);
router.get('/local/:channelId/schedule', getLocalSchedule);

export default router;
