
import prisma from '../config/database';
import { AppError } from '../utils/AppError';
import { iptvService } from './iptv.services';

class FavoriteService {
    /**
     * Toggle channel favorite status
     */
    async toggleFavorite(userId: string, channelId: string) {
        // Verify channel exists
        const channel = await iptvService.getChannelById(channelId);
        if (!channel) {
            throw new AppError('Channel not found', 404);
        }

        // Check if already favorited
        const existing = await prisma.favorite.findUnique({
            where: {
                userId_channelId: {
                    userId,
                    channelId
                }
            }
        });

        if (existing) {
            await prisma.favorite.delete({
                where: {
                    id: existing.id
                }
            });
            return { action: 'removed' };
        }

        const favorite = await prisma.favorite.create({
            data: {
                userId,
                channelId
            }
        });

        return { action: 'added', favorite };
    }

    /**
     * Remove channel from favorites
     */
    async removeFavorite(userId: string, channelId: string) {
        const favorite = await prisma.favorite.findUnique({
            where: {
                userId_channelId: {
                    userId,
                    channelId
                }
            }
        });

        if (!favorite) {
            throw new AppError('Favorite not found', 404);
        }

        await prisma.favorite.delete({
            where: {
                userId_channelId: {
                    userId,
                    channelId
                }
            }
        });

        return { message: 'Removed from favorites' };
    }

    /**
     * Get user's favorite channels with pagination
     */
    async getFavorites(userId: string, page: number = 1, limit: number = 30) {
        const skip = (page - 1) * limit;

        const [favorites, total] = await Promise.all([
            prisma.favorite.findMany({
                where: { userId },
                orderBy: { addedAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.favorite.count({ where: { userId } })
        ]);

        const channelIds = favorites.map(f => f.channelId);
        const channels = await iptvService.getChannelsByIds(channelIds);

        // Preserve order from favorites
        const orderedChannels = favorites.map(fav => {
            const channel = channels.find(ch => ch.id === fav.channelId);
            return channel ? { ...channel, addedAt: fav.addedAt } : null;
        }).filter(ch => ch !== null);

        return {
            data: orderedChannels,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}

export const favoriteService = new FavoriteService();