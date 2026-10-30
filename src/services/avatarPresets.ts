import { normalizeMediaUrl } from './mediaUpload';

export interface AvatarPreset {
  id: string;
  gender: 'male' | 'female';
  age: number;
  url: string;
  labelBg: string;
  labelEn: string;
}

export const PRESET_AGES = [14, 18, 25, 30, 40, 50, 60] as const;

export const AVATAR_PRESETS: AvatarPreset[] = [
  // Male Presets
  { id: 'm_14', gender: 'male', age: 14, url: '/avatars/avatar_m_14.jpg', labelBg: 'Мъж, 14 г.', labelEn: 'Male, 14 yrs' },
  { id: 'm_18', gender: 'male', age: 18, url: '/avatars/avatar_m_18.jpg', labelBg: 'Мъж, 18 г.', labelEn: 'Male, 18 yrs' },
  { id: 'm_25', gender: 'male', age: 25, url: '/avatars/avatar_m_25.jpg', labelBg: 'Мъж, 25 г.', labelEn: 'Male, 25 yrs' },
  { id: 'm_30', gender: 'male', age: 30, url: '/avatars/avatar_m_30.jpg', labelBg: 'Мъж, 30 г.', labelEn: 'Male, 30 yrs' },
  { id: 'm_40', gender: 'male', age: 40, url: '/avatars/avatar_m_40.jpg', labelBg: 'Мъж, 40 г.', labelEn: 'Male, 40 yrs' },
  { id: 'm_50', gender: 'male', age: 50, url: '/avatars/avatar_m_50.jpg', labelBg: 'Мъж, 50 г.', labelEn: 'Male, 50 yrs' },
  { id: 'm_60', gender: 'male', age: 60, url: '/avatars/avatar_m_60.jpg', labelBg: 'Мъж, 60 г.', labelEn: 'Male, 60 yrs' },

  // Female Presets
  { id: 'f_14', gender: 'female', age: 14, url: '/avatars/avatar_f_14.jpg', labelBg: 'Жена, 14 г.', labelEn: 'Female, 14 yrs' },
  { id: 'f_18', gender: 'female', age: 18, url: '/avatars/avatar_f_18.jpg', labelBg: 'Жена, 18 г.', labelEn: 'Female, 18 yrs' },
  { id: 'f_25', gender: 'female', age: 25, url: '/avatars/avatar_f_25.jpg', labelBg: 'Жена, 25 г.', labelEn: 'Female, 25 yrs' },
  { id: 'f_30', gender: 'female', age: 30, url: '/avatars/avatar_f_30.jpg', labelBg: 'Жена, 30 г.', labelEn: 'Female, 30 yrs' },
  { id: 'f_40', gender: 'female', age: 40, url: '/avatars/avatar_f_40.jpg', labelBg: 'Жена, 40 г.', labelEn: 'Female, 40 yrs' },
  { id: 'f_50', gender: 'female', age: 50, url: '/avatars/avatar_f_50.jpg', labelBg: 'Жена, 50 г.', labelEn: 'Female, 50 yrs' },
  { id: 'f_60', gender: 'female', age: 60, url: '/avatars/avatar_f_60.jpg', labelBg: 'Жена, 60 г.', labelEn: 'Female, 60 yrs' }
];

/**
 * Resolves the closest matching preset avatar for a given gender and age
 */
export function getDefaultAvatar(gender?: string, age?: number): string {
  const gStr = (gender || '').toLowerCase().trim();
  const isFemale = gStr.includes('жен') || gStr.includes('female') || gStr.includes('woman') || gStr.startsWith('ж') || gStr.startsWith('f');
  const targetGender: 'male' | 'female' = isFemale ? 'female' : 'male';

  const numericAge = typeof age === 'number' && !Number.isNaN(age) && age > 0 ? age : 25;
  const closestAge = PRESET_AGES.reduce((prev, curr) => {
    return Math.abs(curr - numericAge) < Math.abs(prev - numericAge) ? curr : prev;
  }, 25);

  const matched = AVATAR_PRESETS.find(p => p.gender === targetGender && p.age === closestAge);
  if (matched) {
    return normalizeMediaUrl(matched.url);
  }

  return normalizeMediaUrl(`/avatars/avatar_${targetGender === 'female' ? 'f' : 'm'}_${closestAge}.jpg`);
}

/**
 * Determines the effective avatar for a profile:
 * Returns the customized avatarUrl if present, otherwise computes the automatic avatar based on gender and age.
 */
export function getEffectiveAvatar(profile?: {
  avatarUrl?: string;
  gender?: string;
  age?: number;
  photos?: string[];
} | null): string {
  if (!profile) {
    return normalizeMediaUrl('/avatars/avatar_m_25.jpg');
  }

  if (profile.avatarUrl && profile.avatarUrl.trim()) {
    return normalizeMediaUrl(profile.avatarUrl);
  }

  // Automatic avatar based on gender and age
  return getDefaultAvatar(profile.gender, profile.age);
}
