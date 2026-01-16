import axios from 'axios';
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

class EPGService {
    // Cache: Country -> Map<ChannelID, Programs[]>
    private cache: Map<string, { data: Map<string, EPGProgram[]>, expires: number }> = new Map();
    private CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
    private GITHUB_BASE_URL = 'https://raw.githubusercontent.com/globetvapp/epg/main';

    // Country name mapping overrides (DB Country Code/Name -> GitHub Folder Name)
    private countryOverrides: Record<string, string> = {
        'US': 'UnitedStates',
        'USA': 'UnitedStates',
        'UK': 'UnitedKingdom',
        'GB': 'UnitedKingdom',
        'UAE': 'UnitedArabEmirates',
        // Add more as discovered
    };

    constructor() {
        console.log('📺 EPG Service Initialized (GitHub Source)');
    }

    async initialize(): Promise<void> {
        // No-op or pre-load cache if needed. 
        // Current strategy is on-demand, so we just log.
        console.log('✅ EPG Service ready (On-demand fetching strategy)');
    }

    /**
     * Normalize country name for URL construction
     * Input: "SK", "NG", "US", "United States"
     * Output: "Slovakia", "Nigeria", "UnitedStates"
     */
    private normalizeCountryForUrl(countryInput: string): string {
        if (!countryInput) return '';

        let countryName = countryInput;

        // 1. Try to convert code to full name using Intl (Node.js 14+)
        if (countryInput.length === 2) {
            try {
                const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
                const name = regionNames.of(countryInput.toUpperCase());
                if (name) {
                    countryName = name;
                }
            } catch (e) {
                // Fallback or invalid code
                console.warn(`⚠️ Could not map country code '${countryInput}' to name. Using raw value.`);
            }
        }

        // 2. Handle known overrides or formatting
        // "United States" -> "UnitedStates"
        // "United Kingdom" -> "UnitedKingdom"

        // Remove spaces and special chars
        const sanitized = countryName.replace(/[^a-zA-Z0-9]/g, '');

        // Manual overrides if Intl output mismatch GitHub repo (e.g. specific spellings)
        // Usually GitHub repo uses standard English names without spaces.
        // e.g. "Czechia" vs "Czech Republic". 
        // We might need a small map for edge cases if they arise.

        console.log(`Normalized country for URL: ${countryInput} -> ${sanitized}`);

        return sanitized;
    }

    /**
     * Try to fetch EPG XML from multiple possible URLs
     */
    private async fetchCountryXML(countryName: string): Promise<Map<string, EPGProgram[]> | null> {
        const normalizedCountry = this.normalizeCountryForUrl(countryName);
        if (!normalizedCountry) return null;

        const folder = normalizedCountry; // Capitalized usually e.g. "Australia"
        const filenameBase = normalizedCountry.toLowerCase(); // e.g. "australia"

        // Try variations of the URL
        // 1. {Folder}/{lowercase}1.xml (Most common: Australia/australia1.xml)
        // 2. {Folder}/{Folder}1.xml (Possible fallback)
        const candidates = [
            `${this.GITHUB_BASE_URL}/${folder}/${filenameBase}1.xml`,
            `${this.GITHUB_BASE_URL}/${folder}/${filenameBase}2.xml`,
            `${this.GITHUB_BASE_URL}/${folder}/${filenameBase}3.xml`,
            `${this.GITHUB_BASE_URL}/${folder}/${filenameBase}4.xml`,
            `${this.GITHUB_BASE_URL}/${folder}/${filenameBase}5.xml`,
        ];

        for (const url of candidates) {
            try {
                // console.log(`Attempting to fetch EPG from: ${url}`);
                const response = await axios.get(url, { timeout: 10000 });
                const parsed = this.parseXML(response.data);
                if (parsed.size > 0) {
                    // console.log(`✅ Successfully loaded EPG for ${countryName} from ${url} (${parsed.size} channels)`);
                    return parsed;
                }
            } catch (err) {
                // Continue to next candidate
            }
        }

        console.warn(`⚠️ Failed to fetch EPG for country: ${countryName} (tried ${candidates.length} URLs)`);
        return null;
    }

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

                // Helper to extract text from object or string
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
            console.error('❌ Error parsing XML:', error);
            return new Map();
        }
    }

    // Parse XMLTV time format: "20251231001900 +0000" -> ISO String
    private parseTVTime(timeStr: string): string {
        if (!timeStr) return new Date().toISOString();
        // Format: YYYYMMDDHHMMSS +ZZZZ
        const year = timeStr.substring(0, 4);
        const month = timeStr.substring(4, 6);
        const day = timeStr.substring(6, 8);
        const hour = timeStr.substring(8, 10);
        const minute = timeStr.substring(10, 12);
        const second = timeStr.substring(12, 14);
        // We act nicely and treat it as UTC if +0000, or parse offset
        // Simple way: construct string for Date.parse
        // "2025-12-31T00:19:00+00:00"

        // Extract timezone offset if present
        let tz = 'Z';
        if (timeStr.includes(' ')) {
            const parts = timeStr.split(' ');
            if (parts.length > 1) {
                // +0000 -> +00:00
                const offset = parts[1];
                tz = `${offset.substring(0, 3)}:${offset.substring(3, 5)}`;
            }
        }

        return `${year}-${month}-${day}T${hour}:${minute}:${second}${tz}`;
    }

    /**
     * Ensure EPG data is loaded for a country
     */
    private async ensureCountryEPG(country: string): Promise<Map<string, EPGProgram[]>> {
        if (!country) return new Map();

        const cacheKey = this.normalizeCountryForUrl(country);
        const cached = this.cache.get(cacheKey);

        if (cached && cached.expires > Date.now()) {
            return cached.data;
        }

        // Fetch new
        const data = await this.fetchCountryXML(country);

        if (data) {
            this.cache.set(cacheKey, {
                data,
                expires: Date.now() + this.CACHE_TTL
            });
            return data;
        }

        return new Map();
    }

    /**
     * Get Schedule for a specific channel
     * Requires fetching channel details first to know the country
     */
    async getChannelSchedule(channelId: string): Promise<ChannelSchedule> {
        const today = new Date().toISOString().split('T')[0];

        // 1. Get channel details to find country
        const channel = await iptvService.getChannelById(channelId);
        if (!channel || !channel.country) {
            return { channelId, date: today, programs: [], hasEPG: false };
        }
        console.log("EPG channel: ", channel);

        // 2. Fetch/Get cached EPG for that country
        const countryEPG = await this.ensureCountryEPG(channel.country);

        // 3. Find programs for this channel
        // Note: XMLTV channel IDs might differ from our DB channelId. 
        // We might need to try partial matches or exact matches.
        // The DB channelId (e.g. "ABC1.au") *should* match XML "id" attribute.
        const programs = countryEPG.get(channelId) || [];

        return {
            channelId,
            date: today,
            programs: programs.filter(p => {
                // Filter for "today" or relevant range if needed?
                // For now return all cached (XML usually contains ~24-48h)
                return true;
            }),
            hasEPG: programs.length > 0
        };
    }

    async getNowPlaying(channelId: string): Promise<NowPlaying> {
        const schedule = await this.getChannelSchedule(channelId);
        if (!schedule.hasEPG || schedule.programs.length === 0) {
            return { channelId, hasEPG: false };
        }

        const now = new Date();
        const currentProgram = schedule.programs.find(p => {
            const start = new Date(p.start);
            const end = new Date(p.end);
            return now >= start && now < end;
        });

        if (!currentProgram) {
            return { channelId, hasEPG: true }; // EPG exists but nothing playing right now?
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

    getEPGAvailability(): string[] {
        return [];
    }
}

export const epgService = new EPGService();
