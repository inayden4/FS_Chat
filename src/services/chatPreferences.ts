import { useSyncExternalStore, useCallback } from 'react';
import {
  playTextMessageSound,
  playJoinRequestSound,
  playVoiceMessageSound,
  playReminderAlertSound
} from './soundEffects';

export type ChatThemeId = 'neon' | 'sapphire' | 'emerald' | 'amethyst' | 'amber';
export type ChatFontSize =
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '18'
  | 'small'
  | 'medium'
  | 'large'
  | 'xlarge';

export const CHAT_FONT_SIZES = ['12', '13', '14', '15', '16', '17', '18'] as const;

export function normalizeFontSize(size: ChatFontSize | string | undefined): '12' | '13' | '14' | '15' | '16' | '17' | '18' {
  if (!size) return '14';
  if (size === 'small' || size === '12') return '12';
  if (size === '13') return '13';
  if (size === 'medium' || size === '14') return '14';
  if (size === '15') return '15';
  if (size === 'large' || size === '16') return '16';
  if (size === '17') return '17';
  if (size === 'xlarge' || size === '18') return '18';
  return '14';
}

export interface ChatThemeConfig {
  id: ChatThemeId;
  nameBg: string;
  nameEn: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  bgMain: string;
  bgSurface: string;
  bgSurfaceHover: string;
  previewBg: string;
  previewSentGradient: string;
  chatBgClass: string;
  sentBubbleClass: string;
  receivedBubbleClass: string;
  accentColor: string;
  badgeBg: string;
}

export const CHAT_THEMES: Record<ChatThemeId, ChatThemeConfig> = {
  neon: {
    id: 'neon',
    nameBg: 'Тъмен Неон',
    nameEn: 'Neon Cyber',
    primary: '#D946EF',
    primaryHover: '#E879F9',
    secondary: '#FF007F',
    bgMain: '#0F0C16',
    bgSurface: '#1A1426',
    bgSurfaceHover: '#271C38',
    previewBg: '#120D1A',
    previewSentGradient: 'from-[#FF007F] via-[#D946EF] to-[#9D4EDD]',
    chatBgClass: 'bg-[#0F0C16]',
    sentBubbleClass: 'bg-gradient-to-r from-[#FF007F] via-[#D946EF] to-[#9D4EDD] text-white shadow-[0_2px_12px_rgba(255,0,127,0.25)]',
    receivedBubbleClass: 'bg-[#1E142B] border border-[#3C2258] text-white shadow-sm',
    accentColor: '#FF007F',
    badgeBg: 'bg-[#FF007F]/20 text-[#FF007F]'
  },
  sapphire: {
    id: 'sapphire',
    nameBg: 'Среднощен Сапфир',
    nameEn: 'Midnight Sapphire',
    primary: '#2563EB',
    primaryHover: '#3B82F6',
    secondary: '#60A5FA',
    bgMain: '#081026',
    bgSurface: '#101C3D',
    bgSurfaceHover: '#1A2C5B',
    previewBg: '#0B132B',
    previewSentGradient: 'from-[#1D4ED8] via-[#2563EB] to-[#3B82F6]',
    chatBgClass: 'bg-[#081026]',
    sentBubbleClass: 'bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white shadow-[0_2px_12px_rgba(37,99,235,0.25)]',
    receivedBubbleClass: 'bg-[#162340] border border-[#273E6B] text-white shadow-sm',
    accentColor: '#3B82F6',
    badgeBg: 'bg-[#3B82F6]/20 text-[#60A5FA]'
  },
  emerald: {
    id: 'emerald',
    nameBg: 'Изумрудена Гора',
    nameEn: 'Emerald Forest',
    primary: '#059669',
    primaryHover: '#10B981',
    secondary: '#34D399',
    bgMain: '#061812',
    bgSurface: '#0E2920',
    bgSurfaceHover: '#163A2E',
    previewBg: '#091A14',
    previewSentGradient: 'from-[#047857] via-[#059669] to-[#10B981]',
    chatBgClass: 'bg-[#061812]',
    sentBubbleClass: 'bg-gradient-to-r from-[#047857] via-[#059669] to-[#10B981] text-white shadow-[0_2px_12px_rgba(16,185,129,0.25)]',
    receivedBubbleClass: 'bg-[#122E23] border border-[#1E4D3B] text-white shadow-sm',
    accentColor: '#10B981',
    badgeBg: 'bg-[#10B981]/20 text-[#34D399]'
  },
  amethyst: {
    id: 'amethyst',
    nameBg: 'Кралски Аметист',
    nameEn: 'Royal Amethyst',
    primary: '#7C3AED',
    primaryHover: '#8B5CF6',
    secondary: '#C084FC',
    bgMain: '#120A21',
    bgSurface: '#1E1235',
    bgSurfaceHover: '#2C1B4C',
    previewBg: '#150C24',
    previewSentGradient: 'from-[#6D28D9] via-[#7C3AED] to-[#9333EA]',
    chatBgClass: 'bg-[#120A21]',
    sentBubbleClass: 'bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#9333EA] text-white shadow-[0_2px_12px_rgba(147,51,234,0.25)]',
    receivedBubbleClass: 'bg-[#24133F] border border-[#442375] text-white shadow-sm',
    accentColor: '#A855F7',
    badgeBg: 'bg-[#A855F7]/20 text-[#C084FC]'
  },
  amber: {
    id: 'amber',
    nameBg: 'Топъл Кехлибар',
    nameEn: 'Warm Amber',
    primary: '#D97706',
    primaryHover: '#F59E0B',
    secondary: '#FBBF24',
    bgMain: '#16100A',
    bgSurface: '#241B12',
    bgSurfaceHover: '#35271A',
    previewBg: '#18130E',
    previewSentGradient: 'from-[#B45309] via-[#D97706] to-[#F59E0B]',
    chatBgClass: 'bg-[#16100A]',
    sentBubbleClass: 'bg-gradient-to-r from-[#B45309] via-[#D97706] to-[#F59E0B] text-white shadow-[0_2px_12px_rgba(245,158,11,0.25)]',
    receivedBubbleClass: 'bg-[#2A1E14] border border-[#483321] text-white shadow-sm',
    accentColor: '#F59E0B',
    badgeBg: 'bg-[#F59E0B]/20 text-[#FBBF24]'
  }
};

export interface ChatSoundSettings {
  textMessageSound: boolean;
  joinRequestSound: boolean;
  voiceMessageSound: boolean;
  reminderAlertSound: boolean;
  reminderIntervalMinutes: number;
  reminderEnabled: boolean;
}

export interface ChatPreferences {
  theme: ChatThemeId;
  fontSize: ChatFontSize;
  sounds: ChatSoundSettings;
}

const DEFAULT_PREFERENCES: ChatPreferences = {
  theme: 'neon',
  fontSize: '14',
  sounds: {
    textMessageSound: true,
    joinRequestSound: true,
    voiceMessageSound: true,
    reminderAlertSound: true,
    reminderIntervalMinutes: 3,
    reminderEnabled: true
  }
};

const STORAGE_KEY = 'nostr_chat_preferences_v2';

function loadStoredPreferences(): ChatPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme in CHAT_THEMES ? parsed.theme : 'neon',
      fontSize: normalizeFontSize(parsed.fontSize),
      sounds: {
        textMessageSound: parsed.sounds?.textMessageSound ?? true,
        joinRequestSound: parsed.sounds?.joinRequestSound ?? true,
        voiceMessageSound: parsed.sounds?.voiceMessageSound ?? true,
        reminderAlertSound: parsed.sounds?.reminderAlertSound ?? true,
        reminderIntervalMinutes: parsed.sounds?.reminderIntervalMinutes || 3,
        reminderEnabled: parsed.sounds?.reminderEnabled ?? true
      }
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

let currentPreferences: ChatPreferences = loadStoredPreferences();
const storeListeners = new Set<() => void>();

function notifyStoreListeners() {
  storeListeners.forEach(listener => {
    try {
      listener();
    } catch (e) {
      console.warn('Listener error:', e);
    }
  });
}

function subscribeToChatPreferences(callback: () => void) {
  storeListeners.add(callback);
  return () => {
    storeListeners.delete(callback);
  };
}

function getSnapshotPreferences(): ChatPreferences {
  return currentPreferences;
}

function getServerSnapshotPreferences(): ChatPreferences {
  return DEFAULT_PREFERENCES;
}

export function applyThemeToDocument(themeId: ChatThemeId) {
  if (typeof document === 'undefined') return;
  const cfg = CHAT_THEMES[themeId] || CHAT_THEMES.neon;
  const root = document.documentElement;
  root.style.setProperty('--primary', cfg.primary);
  root.style.setProperty('--primary-hover', cfg.primaryHover);
  root.style.setProperty('--secondary', cfg.secondary);
  root.style.setProperty('--bg-main', cfg.bgMain);
  root.style.setProperty('--bg-surface', cfg.bgSurface);
  root.style.setProperty('--bg-surface-hover', cfg.bgSurfaceHover);
  root.style.setProperty('--accent', cfg.accentColor);
  if (document.body) {
    document.body.style.backgroundColor = cfg.bgMain;
  }
}

// Initial application of theme on load
if (typeof window !== 'undefined') {
  applyThemeToDocument(currentPreferences.theme);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      currentPreferences = loadStoredPreferences();
      applyThemeToDocument(currentPreferences.theme);
      notifyStoreListeners();
    }
  });
}

export function getChatPreferences(): ChatPreferences {
  return currentPreferences;
}

export function saveChatPreferences(prefs: ChatPreferences) {
  currentPreferences = prefs;
  applyThemeToDocument(prefs.theme);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save chat preferences:', e);
    }
  }
  notifyStoreListeners();
}

export function useChatPreferences(): [ChatPreferences, (p: Partial<ChatPreferences> | ((prev: ChatPreferences) => ChatPreferences)) => void] {
  const prefs = useSyncExternalStore(subscribeToChatPreferences, getSnapshotPreferences, getServerSnapshotPreferences);

  const updatePrefs = useCallback((updater: Partial<ChatPreferences> | ((prev: ChatPreferences) => ChatPreferences)) => {
    const next = typeof updater === 'function' ? updater(currentPreferences) : { ...currentPreferences, ...updater };
    saveChatPreferences(next);
  }, []);

  return [prefs, updatePrefs];
}

/**
 * Returns font size classes and style object for message text and message input
 * Supports exact requested values: 12, 13, 14, 15, 16, 17, 18
 */
export function getChatFontSizeClasses(size: ChatFontSize): {
  messageText: string;
  inputText: string;
  label: string;
  fontSizeStyle: { fontSize: string };
} {
  const norm = normalizeFontSize(size);
  return {
    messageText: `text-[${norm}px] leading-relaxed`,
    inputText: `text-[${norm}px]`,
    label: `${norm}px`,
    fontSizeStyle: { fontSize: `${norm}px` }
  };
}

/**
 * Dispatchers for sound effects checking user preference before triggering
 */
export function triggerTextMessageSound() {
  const prefs = getChatPreferences();
  if (prefs.sounds.textMessageSound) {
    playTextMessageSound();
  }
}

export function triggerJoinRequestSound() {
  const prefs = getChatPreferences();
  if (prefs.sounds.joinRequestSound) {
    playJoinRequestSound();
  }
}

export function triggerVoiceMessageSound() {
  const prefs = getChatPreferences();
  if (prefs.sounds.voiceMessageSound) {
    playVoiceMessageSound();
  }
}

export function triggerReminderAlertSound() {
  const prefs = getChatPreferences();
  if (prefs.sounds.reminderAlertSound && prefs.sounds.reminderEnabled) {
    playReminderAlertSound();
  }
}
