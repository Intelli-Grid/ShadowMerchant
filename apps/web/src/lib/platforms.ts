// UPGRADE-F: tier differentiates branded vs value platforms for UI logic
export interface PlatformConfig {
  name: string;
  slug: string;
  bg: string;
  text: string;
  borderColor: string;
  accentColor: string;
  emoji: string;
  tier: 'branded' | 'value';
  trustLabel?: string; // shown as badge on value-tier cards
}

export const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  amazon: {
    name: 'Amazon',
    slug: 'amazon',
    bg: '#FF9900',
    text: '#0F1111',
    borderColor: 'rgba(255,153,0,0.3)',
    accentColor: '#FF9900',
    emoji: '📦',
    tier: 'branded',
  },
  flipkart: {
    name: 'Flipkart',
    slug: 'flipkart',
    bg: '#2874F0',
    text: '#FFFFFF',
    borderColor: 'rgba(40,116,240,0.3)',
    accentColor: '#2874F0',
    emoji: '🛒',
    tier: 'branded',
  },
  myntra: {
    name: 'Myntra',
    slug: 'myntra',
    bg: '#FF3F6C',
    text: '#FFFFFF',
    borderColor: 'rgba(255,63,108,0.3)',
    accentColor: '#FF3F6C',
    emoji: '👗',
    tier: 'branded',
  },
  meesho: {
    name: 'Meesho',
    slug: 'meesho',
    bg: '#9B2FCE',
    text: '#FFFFFF',
    borderColor: 'rgba(155,47,206,0.3)',
    accentColor: '#9B2FCE',
    emoji: '🛍️',
    tier: 'value',
    trustLabel: 'Unbranded / Generic',
  },
  nykaa: {
    name: 'Nykaa',
    slug: 'nykaa',
    bg: '#FC2779',
    text: '#FFFFFF',
    borderColor: 'rgba(252,39,121,0.3)',
    accentColor: '#FC2779',
    emoji: '💄',
    tier: 'branded',
  },
  croma: {
    name: 'Croma',
    slug: 'croma',
    bg: '#67A024',
    text: '#FFFFFF',
    borderColor: 'rgba(103,160,36,0.3)',
    accentColor: '#67A024',
    emoji: '📱',
    tier: 'branded',
  },
};

export function getPlatform(slug: string): PlatformConfig {
  return (
    PLATFORM_CONFIG[slug?.toLowerCase()] ?? {
      name: slug ?? 'Unknown',
      slug: slug ?? 'unknown',
      bg: '#3A3A4A',
      text: '#FFFFFF',
      borderColor: 'rgba(255,255,255,0.15)',
      accentColor: '#FF6B2C',
      emoji: '🏷️',
    }
  );
}
