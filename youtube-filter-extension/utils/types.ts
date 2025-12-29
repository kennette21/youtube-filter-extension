// Video information extracted from YouTube DOM
export interface VideoInfo {
  videoId: string;
  title: string;
  channel: string;
  element: HTMLElement;
}

// Classification result from Claude
export interface Classification {
  video_id: string;
  category: VideoCategory;
  allow: boolean;
  reason?: string;
}

export type VideoCategory =
  | 'tutorial'
  | 'lecture'
  | 'documentary'
  | 'news'
  | 'entertainment'
  | 'reaction'
  | 'gaming'
  | 'shorts'
  | 'other';

// All available categories
export const ALL_CATEGORIES: VideoCategory[] = [
  'tutorial',
  'lecture',
  'documentary',
  'news',
  'entertainment',
  'reaction',
  'gaming',
  'shorts',
  'other',
];

// Filter profile presets
export type ProfileName = 'productive' | 'learning' | 'relax' | 'custom';

export interface FilterProfile {
  name: ProfileName;
  label: string;
  description: string;
  blockedCategories: VideoCategory[];
}

export const PROFILE_PRESETS: Record<ProfileName, FilterProfile> = {
  productive: {
    name: 'productive',
    label: 'Productive',
    description: 'Block entertainment, keep educational content',
    blockedCategories: ['entertainment', 'reaction', 'gaming', 'shorts', 'other'],
  },
  learning: {
    name: 'learning',
    label: 'Learning Only',
    description: 'Only allow tutorials and lectures',
    blockedCategories: ['documentary', 'news', 'entertainment', 'reaction', 'gaming', 'shorts', 'other'],
  },
  relax: {
    name: 'relax',
    label: 'Relax Mode',
    description: 'Allow everything (filtering off)',
    blockedCategories: [],
  },
  custom: {
    name: 'custom',
    label: 'Custom',
    description: 'Choose which categories to block',
    blockedCategories: [],
  },
};

// Extension settings
export interface Settings {
  apiKey: string;
  enabled: boolean;
  profile: ProfileName;
  customBlockedCategories: VideoCategory[];
}

// Message types for content <-> background communication
export type Message =
  | { type: 'CLASSIFY'; videos: Omit<VideoInfo, 'element'>[] }
  | { type: 'RESULTS'; classifications: Classification[] }
  | { type: 'GET_SETTINGS' }
  | { type: 'SETTINGS'; settings: Settings };
