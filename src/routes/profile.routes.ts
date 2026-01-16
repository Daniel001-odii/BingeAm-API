
import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profile.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { updateProfileSchema } from '../types/schema';
import { z } from 'zod';

const router = Router();

router.use(protect); // All profile routes require authentication

router.get('/', getProfile);
router.patch('/', validate(z.object({ body: updateProfileSchema })), updateProfile);

export default router;
