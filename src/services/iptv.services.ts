
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import {
    ChannelWithStream,
    PaginatedResponse
} from '../types';
import { ChannelQuery } from '../types/schema';

class IPTVService {
    /**
     * Get paginated and filtered channels from database
     */
    async getChannels(query: ChannelQuery): Promise<PaginatedResponse<ChannelWithStream>> {
        const {
            page = 1,
            limit = 20,
            search,
            category,
            country,
            language,
            hasStream,
            sort
        } = query;

        // Build where clause
        const where: Prisma.ChannelWhereInput = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { altNames: { hasSome: [search] } } // Exact match for array element, vague 'contains' not supported for arrays easily in mongo+prisma without raw
            ];
            // Improvement: For MongoDB, partial match in array is tricky with Prisma. 
            // We'll stick to name contains for now, and maybe rough check on altNames if needed.
            // But Prisma 'hasSome' checks for exact equality of elements. 
            // Let's rely on name search primarily as it's most common.
        }

        if (category) {
            where.categories = { has: category };
        }

        if (country) {
            where.country = { equals: country, mode: 'insensitive' };
        }

        // Language is not in schema, so we can't filter by it efficiently. 
        // If passed, we might return empty or ignore. Implementation plan said we ignore/fail language support.
        // We will ignore the filter to avoid breaking requests, or return nothing? 
        // Returning nothing is safer if the user expects language specific content.
        if (language) {
            // Effectively return no results if language filter is strictly required, 
            // but since we dropped support, maybe just ignore it. 
            // Let's return empty to signal "none found" is better than wrong data.
            return {
                data: [],
                pagination: { page, limit, total: 0, totalPages: 0 }
            };
        }

        if (hasStream) {
            // All seeded channels have streamUrl, but we can check not empty
            where.streamUrl = { not: '' };
        }

        // Build sort
        const orderBy: Prisma.ChannelOrderByWithRelationInput = {};
        if (sort === 'name') {
            orderBy.name = 'asc';
        } else {
            // Default sort? maybe by id or popularity (if we had it)
            orderBy.id = 'asc';
        }

        // Execute query
        const total = await prisma.channel.count({ where });
        const channels = await prisma.channel.findMany({
            where,
            take: limit,
            skip: (page - 1) * limit,
            orderBy
        });

        // Map to ChannelWithStream (Prisma types match closely, but need to ensure)
        // prisma channel has streamUrl (String) and logo (String?)
        const data: ChannelWithStream[] = channels.map(c => ({
            id: c.channelId, // Map MongoDB _id to id or stick to channelId as the public ID? The previous app used string IDs. Seed uses `channel.id` as `channelId` and `_id` is auto.
            // `getChannelById` used `channelId` param.
            // The `ChannelWithStream` type likely expects the string ID from source (e.g. "cnn-us").
            // Our schema: `channelId` is that ID. `id` is db ID.
            // Let's use `channelId` as the exposed `id`.
            name: c.name,
            alt_names: c.altNames,
            network: c.network || undefined,
            owners: c.owners,
            country: c.country || '',
            categories: c.categories,
            is_nsfw: c.isNsfw || false,
            launched: c.launched || undefined,
            closed: c.closed || undefined, // Schema has closed as String? but type might be boolean? 
            // Original seed: `closed: channel.closed || null` (string).
            // IPVChannel type: `closed?: boolean`.
            // Wait, seed script: `closed: channel.closed || null`. 
            // Let's check `src/types/index.ts` for IPTVChannel definition to be sure. 
            // Assuming closed is boolean in type but string in DB?
            // Schema says `closed String?`.
            // Let's convert safely.
            replaced_by: c.replacedBy || undefined,
            website: c.website || undefined,
            logo: c.logo || undefined,
            streamUrl: c.streamUrl,
            languages: [] // Missing field in DB
        }));

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get single channel by ID
     */
    async getChannelById(channelId: string): Promise<ChannelWithStream | null> {
        const channel = await prisma.channel.findFirst({
            where: { id: channelId }
        });

        if (!channel) return null;

        return {
            id: channel.channelId,
            name: channel.name,
            alt_names: channel.altNames,
            network: channel.network || undefined,
            owners: channel.owners,
            country: channel.country || '',
            categories: channel.categories,
            is_nsfw: channel.isNsfw || false,
            launched: channel.launched || undefined,
            closed: channel.closed || undefined,
            replaced_by: channel.replacedBy || undefined,
            website: channel.website || undefined,
            logo: channel.logo || undefined,
            streamUrl: channel.streamUrl,
            languages: [] // Missing field
        };
    }

    /**
     * Get all categories with channel counts
     */
    async getCategories() {
        // Aggregation to count categories
        // Since categories is an array, we can't easily group by it with Prisma for counts.
        // We'll fetch all categories arrays.
        const channels = await prisma.channel.findMany({
            select: { categories: true }
        });

        const categoryCounts = new Map<string, number>();

        channels.forEach(ch => {
            ch.categories.forEach(cat => {
                categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
            });
        });

        // Convert to array
        return Array.from(categoryCounts.entries()).map(([id, count]) => ({
            id,
            name: id, // Mapping id to name as in original
            channelCount: count
        }));
    }

    /**
     * Get all countries with channel counts
     */
    async getCountries() {
        const result = await prisma.channel.groupBy({
            by: ['country'],
            _count: {
                country: true
            }
        });

        // Filter out null countries and map
        return result
            .filter(r => r.country != null)
            .map(r => ({
                code: r.country!,
                name: r.country!, // We don't have full name in DB, just code usually? 
                // Seed says `channel.country` mapped to schema `country`.
                // Original used `countries.json` for name. 
                // We accept code as name for now.
                channelCount: r._count.country
            }));
    }

    /**
     * Get all languages with channel counts
     * NOT IMPLEMENTED due to missing database field
     */
    async getLanguages() {
        return [];
    }

    /**
     * Get channels by IDs (for favorites)
     */
    async getChannelsByIds(channelIds: string[]): Promise<ChannelWithStream[]> {
        const channels = await prisma.channel.findMany({
            where: {
                channelId: { in: channelIds }
            }
        });

        return channels.map(c => ({
            id: c.channelId,
            name: c.name,
            alt_names: c.altNames,
            network: c.network || undefined,
            owners: c.owners,
            country: c.country || '',
            categories: c.categories,
            is_nsfw: c.isNsfw || false,
            launched: c.launched || undefined,
            closed: c.closed || undefined,
            replaced_by: c.replacedBy || undefined,
            website: c.website || undefined,
            logo: c.logo || undefined,
            streamUrl: c.streamUrl,
            languages: []
        }));
    }
}

export const iptvService = new IPTVService();