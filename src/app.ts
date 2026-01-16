import express from 'express';
import 'express-async-errors';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

// Routes
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import channelRoutes from './routes/channel.routes';
import favoriteRoutes from './routes/favorite.routes';
import epgRoutes from './routes/epg.routes';

// Middlewares
import { errorHandler } from './middlewares/errorHandler.middleware';
import { AppError } from './utils/AppError';

const app = express();

// Security & Parsing
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/auth', limiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/channels', channelRoutes);
app.use('/categories', channelRoutes);
app.use('/countries', channelRoutes);
app.use('/languages', channelRoutes);
app.use('/favorites', favoriteRoutes);
app.use('/epg', epgRoutes);

// 404 handler
app.all('*', (req, res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

// Global error handler
app.use(errorHandler);

export default app;