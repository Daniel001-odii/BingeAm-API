import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { epgService } from './services/epg.services';

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Initialize IPTV data on startup
        // Modified: database uses persistent data, no initialize needing remote fetch

        console.log('🔄 Loading EPG guide sources...');
        await epgService.initialize();
        console.log('✅ EPG guides loaded successfully');

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📺 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();