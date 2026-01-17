import { Router } from 'express';
import {
    addFavorite,
    getFavorites
} from '../controllers/favorite.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { addFavoriteSchema } from '../types/schema';
import { z } from 'zod';

const router = Router();

router.use(protect); // All favorite routes require authentication

router.post('/', validate(z.object({ body: addFavoriteSchema })), addFavorite);
router.get('/', getFavorites);

export default router;
