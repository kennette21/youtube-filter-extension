import type { Settings, ProfileName, VideoCategory } from './types';
import { PROFILE_PRESETS } from './types';

const STORAGE_KEYS = {
  API_KEY: 'apiKey',
  ENABLED: 'enabled',
  PROFILE: 'profile',
  CUSTOM_BLOCKED: 'customBlockedCategories',
} as const;

const DEFAULT_SETTINGS: Settings = {
  apiKey: '', // Users must provide their own API key
  enabled: true,
  profile: 'productive',
  customBlockedCategories: ['entertainment', 'reaction', 'gaming', 'shorts', 'other'],
};

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.ENABLED,
    STORAGE_KEYS.PROFILE,
    STORAGE_KEYS.CUSTOM_BLOCKED,
  ]) as Record<string, unknown>;

  return {
    apiKey: (result[STORAGE_KEYS.API_KEY] as string) ?? DEFAULT_SETTINGS.apiKey,
    enabled: (result[STORAGE_KEYS.ENABLED] as boolean) ?? DEFAULT_SETTINGS.enabled,
    profile: (result[STORAGE_KEYS.PROFILE] as ProfileName) ?? DEFAULT_SETTINGS.profile,
    customBlockedCategories: (result[STORAGE_KEYS.CUSTOM_BLOCKED] as VideoCategory[]) ?? DEFAULT_SETTINGS.customBlockedCategories,
  };
}

export async function saveApiKey(apiKey: string): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.API_KEY]: apiKey });
}

export async function saveEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.ENABLED]: enabled });
}

export async function saveProfile(profile: ProfileName): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.PROFILE]: profile });
}

export async function saveCustomBlockedCategories(categories: VideoCategory[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.CUSTOM_BLOCKED]: categories });
}

export async function getApiKey(): Promise<string> {
  const result = await browser.storage.local.get(STORAGE_KEYS.API_KEY) as Record<string, unknown>;
  return (result[STORAGE_KEYS.API_KEY] as string) ?? DEFAULT_SETTINGS.apiKey;
}

export async function isEnabled(): Promise<boolean> {
  const result = await browser.storage.local.get(STORAGE_KEYS.ENABLED) as Record<string, unknown>;
  return (result[STORAGE_KEYS.ENABLED] as boolean) ?? DEFAULT_SETTINGS.enabled;
}

export async function getBlockedCategories(): Promise<VideoCategory[]> {
  const settings = await getSettings();

  if (settings.profile === 'custom') {
    return settings.customBlockedCategories;
  }

  return PROFILE_PRESETS[settings.profile].blockedCategories;
}
