import fs from 'fs/promises';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { EPGProgram, ChannelSchedule, NowPlaying } from '../types/epg.types';
import { iptvService } from './iptv.services';

interface XMLProgram {
    title: string | { '#text': string };
    desc: string | { '#text': string };
    category: string | { '#text': string };
    '@_start': string;
    '@_stop': string;
    '@_channel': string;
}

interface XMLTVData {
    tv: {
        programme: XMLProgram | XMLProgram[];
    }
}

class LocalEPGService {
    private cache: Map<string, { data: Map<string, EPGProgram[]>, expires: number }> = new Map();
    private CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
    private EPG_DIR = path.join(process.cwd(), 'epgs');

    constructor() {
        console.log('📂 Local EPG Service Initialized');
    }

    /**
     * Extract country code from channel ID suffix (e.g. "ABC.au" -> "au")
     */
    private extractCountryCodeFromId(channelId: string): string | null {
        if (!channelId) return null;
        const lastDotIndex = channelId.lastIndexOf('.');
        if (lastDotIndex === -1 || lastDotIndex === channelId.length - 1) {
            return null;
        }
        return channelId.substring(lastDotIndex + 1);
    }

    /**
     * Map Country Code (SK) -> Country Name (Slovakia) -> Folder Path
     */
    private getCountryFolder(countryCode: string): string | null {
        if (!countryCode) return null;

        // 1. Try Intl display name
        let countryName = countryCode;
        if (countryCode.length === 2) {
            try {
                const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
                const name = regionNames.of(countryCode.toUpperCase());
                if (name) countryName = name;
            } catch (e) {
                // Ignore
            }
        }

        // 2. Sanitize for folder name (Remove spaces, special chars)
        // Folder names in `epgs` seem to be TitleCase, e.g. "Australia", "UnitedKingdom"
        const sanitized = countryName.replace(/[^a-zA-Z0-9]/g, '');
        return sanitized;
    }

    /**
     * Parse XML content
     */
    private parseXML(xmlData: string): Map<string, EPGProgram[]> {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_'
        });

        try {
            const result = parser.parse(xmlData) as XMLTVData;
            const programMap = new Map<string, EPGProgram[]>();

            if (!result.tv || !result.tv.programme) return programMap;

            const programmes = Array.isArray(result.tv.programme)
                ? result.tv.programme
                : [result.tv.programme];

            programmes.forEach((p) => {
                const channelId = p['@_channel'];

                const getText = (val: any) => typeof val === 'object' && val['#text'] ? val['#text'] : (val || '');

                const program: EPGProgram = {
                    title: getText(p.title) || 'No Title',
                    description: getText(p.desc) || '',
                    category: getText(p.category) || '',
                    start: this.parseTVTime(p['@_start']),
                    end: this.parseTVTime(p['@_stop']),
                    icon: ''
                };

                if (!programMap.has(channelId)) {
                    programMap.set(channelId, []);
                }
                programMap.get(channelId)?.push(program);
            });

            return programMap;
        } catch (error) {
            console.error('❌ Error parsing XML chunk:', error);
            return new Map();
        }
    }

    private parseTVTime(timeStr: string): string {
        if (!timeStr) return new Date().toISOString();
        const year = timeStr.substring(0, 4);
        const month = timeStr.substring(4, 6);
        const day = timeStr.substring(6, 8);
        const hour = timeStr.substring(8, 10);
        const minute = timeStr.substring(10, 12);
        const second = timeStr.substring(12, 14);

        let tz = 'Z';
        if (timeStr.includes(' ')) {
            const parts = timeStr.split(' ');
            if (parts.length > 1) {
                const offset = parts[1];
                tz = `${offset.substring(0, 3)}:${offset.substring(3, 5)}`;
            }
        }

        return `${year}-${month}-${day}T${hour}:${minute}:${second}${tz}`;
    }

    /**
     * Ensure EPG data is loaded for a country
     * Reads ALL .xml files in country folder
     */
    private async ensureCountryLoaded(countryCode: string): Promise<Map<string, EPGProgram[]>> {
        const folderName = this.getCountryFolder(countryCode);
        if (!folderName) return new Map();

        // Check cache using folder name as key
        const cached = this.cache.get(folderName);
        if (cached && cached.expires > Date.now()) {
            return cached.data;
        }

        const countryDir = path.join(this.EPG_DIR, folderName);
        const combinedMap = new Map<string, EPGProgram[]>();

        try {
            // Check if dir exists
            try {
                await fs.access(countryDir);
            } catch {
                // Try lowercase or uppercase if not found?
                // For now, assume precise mapping or fallback
                console.warn(`⚠️ EPG Directory not found: ${countryDir}`);
                return new Map();
            }

            const files = await fs.readdir(countryDir);
            const xmlFiles = files.filter(f => f.endsWith('.xml')); // Ignore .gz for now

            if (xmlFiles.length === 0) {
                console.warn(`⚠️ No XML files found in: ${countryDir}`);
                return new Map();
            }

            // Parallel read & parse
            await Promise.all(xmlFiles.map(async (file) => {
                try {
                    const filePath = path.join(countryDir, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const fileMap = this.parseXML(content);

                    // Merge into combined
                    for (const [cid, progs] of fileMap.entries()) {
                        if (!combinedMap.has(cid)) {
                            combinedMap.set(cid, []);
                        }
                        combinedMap.get(cid)?.push(...progs);
                    }
                } catch (err) {
                    console.error(`❌ Error reading ${file}:`, err);
                }
            }));

            // Sort programs by time for binary search
            for (const programs of combinedMap.values()) {
                programs.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            }

            // Cache
            this.cache.set(folderName, {
                data: combinedMap,
                expires: Date.now() + this.CACHE_TTL
            });

            console.log(`✅ Loaded ${xmlFiles.length} EPG files for ${folderName} (${combinedMap.size} channels)`);
            return combinedMap;

        } catch (error) {
            console.error(`❌ Failed to load country EPG ${folderName}:`, error);
            return new Map();
        }
    }

    /**
     * Binary Search to find current program efficiently O(log n)
     */
    private findCurrentProgram(programs: EPGProgram[], now: Date): EPGProgram | undefined {
        if (!programs.length) return undefined;

        let left = 0;
        let right = programs.length - 1;
        const nowTime = now.getTime();

        // We want the program where start <= now < end

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const p = programs[mid];
            const start = new Date(p.start).getTime();
            const end = new Date(p.end).getTime();

            if (nowTime >= start && nowTime < end) {
                return p;
            } else if (nowTime < start) {
                // Current time is before this program -> look left
                right = mid - 1;
            } else {
                // Current time is after this program -> look right
                left = mid + 1;
            }
        }

        return undefined;
    }

    async getChannelSchedule(channelId: string): Promise<ChannelSchedule> {
        const today = new Date().toISOString().split('T')[0];

        // 1. Try to get country from ID suffix
        let countryCode = this.extractCountryCodeFromId(channelId);

        // 2. Fallback to DB if not in ID
        if (!countryCode) {
            const channel = await iptvService.getChannelById(channelId);
            if (channel && channel.country) {
                countryCode = channel.country;
            }
        }

        if (!countryCode) {
            return { channelId, date: today, programs: [], hasEPG: false };
        }

        const countryEPG = await this.ensureCountryLoaded(countryCode);
        const programs = countryEPG.get(channelId) || [];

        return {
            channelId,
            date: today,
            programs, // Returns full cached list (sorted). Could filter for range if needed.
            hasEPG: programs.length > 0
        };
    }

    async getNowPlaying(channelId: string): Promise<NowPlaying> {
        // 1. Try to get country from ID suffix
        let countryCode = this.extractCountryCodeFromId(channelId);

        // 2. Fallback to DB
        if (!countryCode) {
            const channel = await iptvService.getChannelById(channelId);
            if (channel && channel.country) {
                countryCode = channel.country;
            }
        }

        if (!countryCode) {
            return { channelId, hasEPG: false };
        }

        // 3. Load EPG (Cached)
        const countryEPG = await this.ensureCountryLoaded(countryCode);
        const programs = countryEPG.get(channelId);

        if (!programs || programs.length === 0) {
            return { channelId, hasEPG: false };
        }

        // 3. Binary Search
        const now = new Date();
        const currentProgram = this.findCurrentProgram(programs, now);

        if (!currentProgram) {
            return { channelId, hasEPG: true }; // Has EPG but nothing playing (gap)
        }

        const start = new Date(currentProgram.start).getTime();
        const end = new Date(currentProgram.end).getTime();
        const total = end - start;
        const elapsed = now.getTime() - start;
        const progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));

        return {
            channelId,
            program: currentProgram,
            progress,
            hasEPG: true
        };
    }
}

export const localEpgService = new LocalEPGService();
