import { iptvService } from '../services/iptv.services';
import { localEpgService } from '../services/localEpg.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debug() {
    try {
        console.log('🔍 Checking channel 1001Noites.br...');
        const channel = await iptvService.getChannelById('1001Noites.br');
        console.log('📄 DB Channel:', channel);

        if (channel) {
            // Already tested single channel, now let's find a valid match if that failed
            console.log('🧪 Testing specific channel failed? Let\'s find a valid match...');
        }

        console.log('🔎 Searching for ANY matching channel in BR...');
        const allBrChannels = await prisma.channel.findMany({
            where: { country: 'BR' },
            select: { channelId: true }
        });
        console.log(`📄 Found ${allBrChannels.length} channels in DB for BR`);

        const scheduleMap = await localEpgService['ensureCountryLoaded']('Brazil'); // Access private method for debug
        console.log(`xml Loaded ${scheduleMap.size} channels from XML`);

        const validChannel = allBrChannels.find(c => scheduleMap.has(c.channelId));

        if (validChannel) {
            console.log(`✅ FOUND MATCH: ${validChannel.channelId}`);
            const schedule = await localEpgService.getChannelSchedule(validChannel.channelId);
            console.log('📅 Schedule result:', {
                channelId: schedule.channelId,
                hasEPG: schedule.hasEPG,
                programCount: schedule.programs.length,
                firstProgram: schedule.programs[0]?.title
            });
        } else {
            console.log('❌ No overlapping channels found between DB and XML for Brazil.');
        }

    } catch (e) {
        console.error('❌ Debug error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

debug();
