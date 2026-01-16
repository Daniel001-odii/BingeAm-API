import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import {
    IPTVChannel,
    IPTVStream,
    IPTVLogo,
    ChannelWithStream
} from '../types';

dotenv.config();

const prisma = new PrismaClient();

// Batch size for database operations
const BATCH_SIZE = 500;

// Helper to check if channel data has changed
function hasChannelChanged(existing: any, newData: any): boolean {
    return (
        existing.name !== newData.name ||
        existing.streamUrl !== newData.streamUrl ||
        existing.logo !== newData.logo ||
        existing.network !== newData.network ||
        existing.website !== newData.website ||
        existing.country !== newData.country ||
        existing.isNsfw !== newData.isNsfw ||
        existing.launched !== newData.launched ||
        existing.closed !== newData.closed ||
        existing.replacedBy !== newData.replacedBy ||
        JSON.stringify(existing.altNames) !== JSON.stringify(newData.altNames) ||
        JSON.stringify(existing.owners) !== JSON.stringify(newData.owners) ||
        JSON.stringify(existing.categories) !== JSON.stringify(newData.categories)
    );
}

async function seedChannels() {
    console.log('🚀 Starting channel seed...');

    try {
        console.log('📥 Fetching data from IPTV sources...');
        const [channelsRes, streamsRes, logosRes] = await Promise.all([
            axios.get('https://iptv-org.github.io/api/channels.json'),
            axios.get('https://iptv-org.github.io/api/streams.json'),
            axios.get('https://iptv-org.github.io/api/logos.json')
        ]);

        const channels: IPTVChannel[] = channelsRes.data;
        const streamsData: IPTVStream[] = streamsRes.data;
        const logosData: IPTVLogo[] = logosRes.data;

        console.log(`📊 Fetched ${channels.length} channels, ${streamsData.length} streams, ${logosData.length} logos`);

        // O(n) - Map streams
        const streamMap = new Map<string, string>();
        streamsData.forEach(s => {
            if (s.channel && !streamMap.has(s.channel)) {
                streamMap.set(s.channel, s.url);
            }
        });

        // O(n) - Map logos
        const logoMap = new Map<string, string>();
        logosData.forEach(l => {
            if (l.channel && l.url && !logoMap.has(l.channel)) {
                logoMap.set(l.channel, l.url);
            }
        });

        // O(n) - Filter channels that have streams and aren't closed
        const validChannels = channels.filter(channel => {
            const streamUrl = streamMap.get(channel.id);
            return streamUrl && !channel.closed;
        });

        console.log(`✅ Found ${validChannels.length} valid channels to process`);

        // O(1) - Single batch query to get all existing channels with full data
        console.log('🔍 Checking for existing channels...');
        const existingChannels = await prisma.channel.findMany();

        // O(n) - Create a Map for O(1) lookups with full channel data
        const existingChannelMap = new Map(
            existingChannels.map(c => [c.channelId, c])
        );

        // Separate channels into new and potentially updated
        const channelsToCreate: any[] = [];
        const channelsToUpdate: any[] = [];

        // O(n) - Categorize channels
        validChannels.forEach(channel => {
            const channelData = {
                channelId: channel.id,
                name: channel.name,
                altNames: channel.alt_names || [],
                network: channel.network || null,
                owners: channel.owners || [],
                country: channel.country || null,
                categories: channel.categories || [],
                isNsfw: channel.is_nsfw,
                launched: channel.launched || null,
                closed: channel.closed || null,
                replacedBy: channel.replaced_by || null,
                website: channel.website || null,
                streamUrl: streamMap.get(channel.id)!,
                logo: logoMap.get(channel.id) || null
            };

            const existing = existingChannelMap.get(channel.id);

            if (!existing) {
                channelsToCreate.push(channelData);
            } else if (hasChannelChanged(existing, channelData)) {
                channelsToUpdate.push({ ...channelData, id: existing.id });
            }
        });

        console.log(`📝 Summary:`);
        console.log(`   New channels to add: ${channelsToCreate.length}`);
        console.log(`   Existing channels to update: ${channelsToUpdate.length}`);
        console.log(`   Unchanged channels: ${validChannels.length - channelsToCreate.length - channelsToUpdate.length}`);

        let totalAdded = 0;
        let totalUpdated = 0;
        let errorCount = 0;

        // Process new channels in batches
        if (channelsToCreate.length > 0) {
            console.log('\n💾 Adding new channels...');
            for (let i = 0; i < channelsToCreate.length; i += BATCH_SIZE) {
                const batch = channelsToCreate.slice(i, i + BATCH_SIZE);

                try {
                    const result = await prisma.channel.createMany({
                        data: batch
                    });

                    totalAdded += result.count;
                    process.stdout.write(
                        `\r✅ Added ${totalAdded}/${channelsToCreate.length} channels...`
                    );
                } catch (err) {
                    console.error(`\n❌ Error adding batch starting at index ${i}:`, err);

                    // Fallback: try inserting individually
                    console.log('   Attempting individual inserts for failed batch...');
                    for (const channel of batch) {
                        try {
                            await prisma.channel.create({ data: channel });
                            totalAdded++;
                        } catch (individualErr) {
                            errorCount++;
                        }
                    }
                }
            }
            console.log(''); // New line after progress
        }

        // Process updates in batches using transactions
        if (channelsToUpdate.length > 0) {
            console.log('\n🔄 Updating existing channels...');
            for (let i = 0; i < channelsToUpdate.length; i += BATCH_SIZE) {
                const batch = channelsToUpdate.slice(i, i + BATCH_SIZE);

                try {
                    // Use transaction for batch updates
                    await prisma.$transaction(
                        batch.map(channel =>
                            prisma.channel.update({
                                where: { id: channel.id },
                                data: {
                                    name: channel.name,
                                    altNames: channel.altNames,
                                    network: channel.network,
                                    owners: channel.owners,
                                    country: channel.country,
                                    categories: channel.categories,
                                    isNsfw: channel.isNsfw,
                                    launched: channel.launched,
                                    closed: channel.closed,
                                    replacedBy: channel.replacedBy,
                                    website: channel.website,
                                    streamUrl: channel.streamUrl,
                                    logo: channel.logo
                                }
                            })
                        )
                    );

                    totalUpdated += batch.length;
                    process.stdout.write(
                        `\r🔄 Updated ${totalUpdated}/${channelsToUpdate.length} channels...`
                    );
                } catch (err) {
                    console.error(`\n❌ Error updating batch starting at index ${i}:`, err);

                    // Fallback: try updating individually
                    console.log('   Attempting individual updates for failed batch...');
                    for (const channel of batch) {
                        try {
                            await prisma.channel.update({
                                where: { id: channel.id },
                                data: {
                                    name: channel.name,
                                    altNames: channel.altNames,
                                    network: channel.network,
                                    owners: channel.owners,
                                    country: channel.country,
                                    categories: channel.categories,
                                    isNsfw: channel.isNsfw,
                                    launched: channel.launched,
                                    closed: channel.closed,
                                    replacedBy: channel.replacedBy,
                                    website: channel.website,
                                    streamUrl: channel.streamUrl,
                                    logo: channel.logo
                                }
                            });
                            totalUpdated++;
                        } catch (individualErr) {
                            errorCount++;
                        }
                    }
                }
            }
            console.log(''); // New line after progress
        }

        console.log('\n✨ Seed completed!');
        console.log(`   Total valid channels: ${validChannels.length}`);
        console.log(`   New channels added: ${totalAdded}`);
        console.log(`   Channels updated: ${totalUpdated}`);
        console.log(`   Unchanged: ${validChannels.length - totalAdded - totalUpdated}`);
        console.log(`   Errors: ${errorCount}`);

    } catch (error) {
        console.error('❌ Fatal error during seed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seedChannels();