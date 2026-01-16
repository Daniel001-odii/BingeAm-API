export interface EPGGuide {
    channel: string | null;
    site: string;
    site_id: string;
    site_name: string;
    lang: string;
}

export interface EPGProgram {
    title: string;
    start: string; // ISO string
    end: string;   // ISO string
    description?: string;
    category?: string;
    icon?: string;
}

export interface ChannelSchedule {
    channelId: string;
    date: string; // YYYY-MM-DD
    programs: EPGProgram[];
    hasEPG: boolean;
}

export interface NowPlaying {
    channelId: string;
    program?: EPGProgram;
    progress?: number; // 0-100
    hasEPG: boolean;
}
