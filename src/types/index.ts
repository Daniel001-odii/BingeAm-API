
export interface IPTVChannel {
    id: string;
    name: string;
    alt_names?: string[];
    network?: string;
    owners?: string[];
    country: string;
    subdivision?: string;
    city?: string;
    broadcast_area?: string[];
    languages: string[];
    categories: string[];
    is_nsfw: boolean;
    launched?: string;
    closed?: string;
    replaced_by?: string;
    website?: string;
    logo?: string;
}

export interface IPTVLogo {
    channel: string;
    feed?: string | null;
    tags: string[];
    width: number;
    height: number;
    format?: string | null;
    url: string;
}

export interface IPTVStream {
    channel: string;
    url: string;
    http_referrer?: string;
    user_agent?: string;
}

export interface IPTVCategory {
    id: string;
    name: string;
}

export interface IPTVCountry {
    name: string;
    code: string;
    languages: string[];
    flag: string;
}

export interface IPTVLanguage {
    name: string;
    code: string;
}

export interface ChannelWithStream extends IPTVChannel {
    streamUrl?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
