import { Router } from 'express';
import {
    getChannels,
    getChannelById,
    getCategories,
    getCountries,
    getLanguages
} from '../controllers/channel.controller';
import { validate } from '../middlewares/validate.middleware';
import { channelQuerySchema } from '../types/schema';
import { z } from 'zod';

const router = Router();

// Public routes - no authentication required
router.get('/channels', validate(z.object({ query: channelQuerySchema })), getChannels);
router.get('/channels/:channelId', getChannelById);
router.get('/categories', getCategories);
router.get('/countries', getCountries);
router.get('/languages', getLanguages);

export default router;
