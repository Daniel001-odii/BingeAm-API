
import { Router } from 'express';
import {
    register,
    login,
    logout,
    forgotPassword,
    resetPassword,
    deleteAccount
} from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { protect } from '../middlewares/auth.middleware';
import {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    deleteAccountSchema
} from '../types/schema';
import { z } from 'zod';

const router = Router();

router.post('/register', validate(z.object({ body: registerSchema })), register);
router.post('/login', validate(z.object({ body: loginSchema })), login);
router.post('/logout', protect, logout);
router.post('/forgot-password', validate(z.object({ body: forgotPasswordSchema })), forgotPassword);
router.post('/reset-password', validate(z.object({ body: resetPasswordSchema })), resetPassword);
router.delete('/account', protect, validate(z.object({ body: deleteAccountSchema })), deleteAccount);

export default router;
