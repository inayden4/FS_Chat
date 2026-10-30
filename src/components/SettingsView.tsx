import React, { useState, useEffect, useRef } from 'react';
import {
  UI_TRANSLATIONS,
  Language,
  UserProfile,
  NostrIdentity,
  PROFILE_FIELDS_CONFIG,
  parseInterestsList
} from '../types';
import { publishMetadata } from '../services/nostr';
import * as db from '../services/db';
import { EmojiPicker } from './EmojiPicker';
import { uploadMediaFile, normalizeMediaUrl, parsePhotosInput } from '../services/mediaUpload';
import { AVATAR_PRESETS, getDefaultAvatar } from '../services/avatarPresets';
import { executeAutoBackup } from '../services/autoBackup';

interface SettingsViewProps {
  lang: Language;
  identity: NostrIdentity;
  profile: UserProfile;
  blockedPubkeys?: string[];
  hiddenPubkeys?: string[];
  onProfileUpdated: (p: UserProfile) => void;
  onUnblock?: (pubkey: string) => void;
  onUnhide?: (pubkey: string) => void;
  onLogout?: () => void;
  onClose?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  lang,
  identity,
  profile,
  onProfileUpdated,
  onClose
}) => {
  const t = UI_TRANSLATIONS[lang];

  // Form State based dynamically on PROFILE_FIELDS_CONFIG
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [photosInput, setPhotosInput] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Emojis for "За мен (кратко)" (bio)
  const [showBioEmoji, setShowBioEmoji] = useState(false);

  // Local media uploads state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Avatar Management State
  const [avatarInput, setAvatarInput] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAvatarPresets, setShowAvatarPresets] = useState(false);
  const [avatarPresetGender, setAvatarPresetGender] = useState<'all' | 'male' | 'female'>('all');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Initialize form fields from profile
  useEffect(() => {
    const initial: Record<string, any> = {};
    PROFILE_FIELDS_CONFIG.forEach(field => {
      if (field.id === 'photos') {
        const photoArr = (profile.photos || []).map(normalizeMediaUrl);
        setPhotosInput(photoArr.join('\n'));
      } else if (field.id === 'picture') {
        setAvatarInput(profile.picture ? normalizeMediaUrl(profile.picture) : '');
      } else if (field.id === 'interests') {
        initial[field.id] = Array.isArray(profile.interests)
          ? profile.interests.join(', ')
          : (profile.interests || '');
      } else {
        initial[field.id] = (profile as any)[field.id] ?? '';
      }
    });
    setFormData(initial);
  }, [profile]);

  const handleFieldChange = (fieldId: string, val: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: val }));
  };

  // Upload Avatar from local device
  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert(t.MEDIA_TOO_LARGE);
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const res = await uploadMediaFile(file);
      const safeUrl = normalizeMediaUrl(res.url);
      setAvatarInput(safeUrl);
    } catch (err) {
      console.error('Error uploading avatar:', err);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSelectPresetAvatar = (url: string) => {
    setAvatarInput(normalizeMediaUrl(url));
  };

  const handleResetAvatar = () => {
    setAvatarInput('');
  };

  // Upload Photo from local device and append online URL
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert(t.MEDIA_TOO_LARGE);
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const res = await uploadMediaFile(file);
      const safeUrl = normalizeMediaUrl(res.url);
      setPhotosInput(prev => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed}\n${safeUrl}` : safeUrl;
      });
    } catch (err) {
      console.error('Error uploading photo:', err);
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Upload Video from local device and set online URL
  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert(t.MEDIA_TOO_LARGE);
      return;
    }

    setIsUploadingVideo(true);
    try {
      const res = await uploadMediaFile(file);
      handleFieldChange('video', res.url);
    } catch (err) {
      console.error('Error uploading video:', err);
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (urlToRemove: string) => {
    const list = parsePhotosInput(photosInput);
    const updated = list.filter(u => u !== urlToRemove);
    setPhotosInput(updated.join('\n'));
  };

  // Save profile handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const parsedPhotos = parsePhotosInput(photosInput).map(normalizeMediaUrl);
      const finalAvatar = avatarInput.trim() ? normalizeMediaUrl(avatarInput.trim()) : undefined;

      const updatedProfile: UserProfile = {
        ...profile,
        ...formData,
        name: formData.name || profile.name || `Anon_${identity.npub.slice(-4)}`,
        age: Number(formData.age) || profile.age || 25,
        location: formData.location || profile.location || 'София / Sofia',
        about: formData.about || '',
        interests: parseInterestsList(formData.interests),
        picture: finalAvatar,
        photos: parsedPhotos,
        video: formData.video ? normalizeMediaUrl(formData.video) : undefined,
        updatedAt: Date.now()
      };

      // 1. Save to local IndexedDB & auto-save to account list
      await db.saveMyProfile(updatedProfile);

      // 2. Publish NIP-01 metadata to Nostr Relays
      await publishMetadata(identity, updatedProfile);

      // 3. Trigger immediate auto-backup
      await executeAutoBackup(true);

      onProfileUpdated(updatedProfile);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Parse photos list for preview safely
  const currentPhotosList = parsePhotosInput(photosInput).map(normalizeMediaUrl);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Hidden file pickers for local uploads */}
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleUploadAvatar}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={photoInputRef}
        onChange={handleUploadPhoto}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={videoInputRef}
        onChange={handleUploadVideo}
        accept="video/*"
        className="hidden"
      />

      {/* Main Profile Form Card */}
      <div className="rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#262633] p-4 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#262633] pb-4 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">👤</span>
            <h2 className="text-base font-bold text-white">
              {lang === 'bg' ? 'Профил' : 'Profile'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {saveSuccessMsg && (
              <span className="text-xs font-bold text-[var(--status-online)] bg-[var(--status-online)]/10 px-3 py-1 rounded-[var(--radius-sm)] border border-[var(--status-online)]/30">
                {t.PROFILE_SAVED}
              </span>
            )}
            {onClose && (
              <button
                type="button"
                id="btn-close-profile-top"
                onClick={onClose}
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-[var(--radius-sm)] bg-[#242435] hover:bg-[#323246] text-white/90 hover:text-white border border-[#3A3A4E] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title={lang === 'bg' ? 'Затвори' : 'Close'}
                aria-label="Close"
              >
                <span className="text-sm font-bold">✕</span>
                <span className="hidden sm:inline">{lang === 'bg' ? 'Затвори' : 'Close'}</span>
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Dedicated Header Picture (Avatar) Section */}
          <div className="rounded-[var(--radius-md)] bg-[var(--bg-main)] border border-[#2D2D3E] p-4.5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#262635] pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{t.AVATAR_HEADER_TITLE}</h3>
                  {avatarInput.trim() ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ✓ {t.AVATAR_CUSTOM}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      ⚡ {t.AVATAR_PRESET_DEFAULT}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t.AVATAR_HEADER_DESC}
                </p>
              </div>

              {/* Action Buttons: Choose Preset or Upload Device */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  id="btn-choose-avatar-preset"
                  onClick={() => setShowAvatarPresets(!showAvatarPresets)}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[#2A2A3C] hover:bg-[#383850] text-white text-xs font-semibold border border-[#3D3D54] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title={t.CHOOSE_AVATAR_PRESET}
                >
                  <span>🎭</span>
                  <span>{showAvatarPresets ? 'Скрий галерията' : t.CHOOSE_AVATAR_PRESET}</span>
                </button>

                <button
                  type="button"
                  id="btn-upload-avatar-device"
                  disabled={isUploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                  title={t.UPLOAD_PHOTO_DEVICE}
                >
                  {isUploadingAvatar ? (
                    <>
                      <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>{t.UPLOADING_ONLINE}</span>
                    </>
                  ) : (
                    <>
                      <span>📷</span>
                      <span>{t.UPLOAD_PHOTO_DEVICE}</span>
                    </>
                  )}
                </button>

                {avatarInput.trim() && (
                  <button
                    type="button"
                    onClick={handleResetAvatar}
                    className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                    title={t.AVATAR_RESET_DEFAULT}
                  >
                    ✕ {t.AVATAR_RESET_DEFAULT}
                  </button>
                )}
              </div>
            </div>

            {/* Avatar Preview Display & URL field */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[var(--primary)] shadow-[0_0_15px_rgba(255,0,127,0.3)] bg-[#1A1A24]">
                  <img
                    src={avatarInput.trim() || getDefaultAvatar(formData.gender)}
                    alt="Profile Avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.onerror = null;
                      target.src = getDefaultAvatar(formData.gender);
                    }}
                  />
                </div>
              </div>

              <div className="flex-1 w-full space-y-1">
                <label className="block text-xs font-medium text-white/90">
                  {lang === 'bg' ? 'URL адрес на главната профилна снимка:' : 'Main profile picture direct URL:'}
                </label>
                <input
                  type="text"
                  value={avatarInput}
                  onChange={(e) => setAvatarInput(e.target.value)}
                  placeholder="https://images.unsplash.com/... или качи от бутона горе"
                  className="w-full px-3 py-2 text-xs font-mono rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#3A3A4E] text-white focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>

            {/* Expandable Gallery of Avatar Presets */}
            {showAvatarPresets && (
              <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#333348] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {lang === 'bg' ? 'Избери готов аватар от галерията:' : 'Select preset avatar from gallery:'}
                  </span>
                  <div className="flex items-center gap-1 bg-[var(--bg-main)] p-0.5 rounded border border-[#2B2B38] text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAvatarPresetGender('all')}
                      className={`px-2 py-0.5 rounded font-semibold ${avatarPresetGender === 'all' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)]'}`}
                    >
                      {lang === 'bg' ? 'Всички' : 'All'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarPresetGender('female')}
                      className={`px-2 py-0.5 rounded font-semibold ${avatarPresetGender === 'female' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)]'}`}
                    >
                      {lang === 'bg' ? 'Жени' : 'Women'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarPresetGender('male')}
                      className={`px-2 py-0.5 rounded font-semibold ${avatarPresetGender === 'male' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)]'}`}
                    >
                      {lang === 'bg' ? 'Мъже' : 'Men'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {AVATAR_PRESETS
                    .filter(preset => avatarPresetGender === 'all' || preset.gender === avatarPresetGender)
                    .map(preset => {
                      const isSelected = avatarInput === preset.url;
                      const presetLabel = lang === 'bg' ? preset.labelBg : preset.labelEn;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPresetAvatar(preset.url)}
                          className={`relative aspect-square rounded-full overflow-hidden border-2 transition-all p-0.5 group cursor-pointer ${
                            isSelected
                              ? 'border-[var(--primary)] ring-2 ring-[var(--primary)] scale-105'
                              : 'border-[#3D3D52] hover:border-white'
                          }`}
                          title={presetLabel}
                        >
                          <img
                            src={preset.url}
                            alt={presetLabel}
                            className="w-full h-full object-cover rounded-full"
                          />
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Grid of Profile Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROFILE_FIELDS_CONFIG.map(field => {
              const label = lang === 'bg' ? field.labelBg : field.labelEn;
              const value = formData[field.id] ?? '';

              if (field.type === 'text') {
                const isInterestsField = field.id === 'interests';
                const popularInterests = [
                  'БДСМ / BDSM', 'Флирт / Flirt', 'Купони / Parties', 'Татуси / Tattoos',
                  'Пътувания / Travel', 'Фитнес / Fitness', 'Кино / Movies', 'Гейминг / Gaming',
                  'Танци / Dancing', 'Музика / Music', 'Ролеви игри / Roleplay', 'Масаж / Massage',
                  'Къмпинг / Camping', 'Вино / Wine', 'СПА / Spa', 'Кафе / Coffee'
                ];

                return (
                  <div key={field.id} className={`space-y-1 ${isInterestsField ? 'md:col-span-2' : ''}`}>
                    <label className="block text-xs font-semibold text-white">
                      {label} {field.required && <span className="text-[var(--primary)]">*</span>}
                    </label>
                    <input
                      id={`field-${field.id}`}
                      type="text"
                      required={field.required}
                      value={value}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={isInterestsField ? (lang === 'bg' ? 'Флирт, БДСМ, Пътувания, Фитнес...' : 'Flirt, BDSM, Travel, Fitness...') : ''}
                      className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                );
              }

              if (field.type === 'number') {
                return (
                  <div key={field.id} className="space-y-1">
                    <label className="block text-xs font-semibold text-white">
                      {label} {field.required && <span className="text-[var(--primary)]">*</span>}
                    </label>
                    <input
                      id={`field-${field.id}`}
                      type="number"
                      required={field.required}
                      min={14}
                      max={120}
                      value={value}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                );
              }

              if (field.type === 'select') {
                return (
                  <div key={field.id} className="space-y-1">
                    <label className="block text-xs font-semibold text-white">
                      {label} {field.required && <span className="text-[var(--primary)]">*</span>}
                    </label>
                    <select
                      id={`field-${field.id}`}
                      value={value}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="">{lang === 'bg' ? '-- Изберете --' : '-- Select --'}</option>
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (field.type === 'textarea') {
                return (
                  <div key={field.id} className="md:col-span-2 space-y-1 relative">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-white">
                        {label} {field.required && <span className="text-[var(--primary)]">*</span>}
                      </label>
                      <button
                        type="button"
                        id="btn-bio-emoji-toggle"
                        onClick={() => setShowBioEmoji(!showBioEmoji)}
                        className="px-2 py-0.5 rounded text-xs bg-[var(--bg-main)] hover:bg-[#2A2A38] border border-[#333348] text-white/90 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        title={lang === 'bg' ? 'Вмъкни емотикон' : 'Insert emoji'}
                      >
                        <span>😊</span>
                        <span className="text-[11px] font-medium">{lang === 'bg' ? 'Емотикони' : 'Emojis'}</span>
                      </button>
                    </div>

                    {showBioEmoji && (
                      <div className="absolute right-0 top-7 z-30 shadow-2xl">
                        <EmojiPicker
                          onSelectEmoji={(emoji) => {
                            handleFieldChange(field.id, (value || '') + emoji);
                            setShowBioEmoji(false);
                          }}
                          onClose={() => setShowBioEmoji(false)}
                        />
                      </div>
                    )}

                    <textarea
                      id={`field-${field.id}`}
                      rows={3}
                      value={value}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={lang === 'bg' ? 'Разкажи накратко за себе си...' : 'Tell something about yourself...'}
                      className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                );
              }

              if (field.type === 'media_photos') {
                return (
                  <div key={field.id} className="md:col-span-2 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-white">
                          {label} ({currentPhotosList.length})
                        </label>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {lang === 'bg'
                            ? 'Снимките се хостват онлайн за сигурност'
                            : 'Photos are hosted online for security'}
                        </span>
                      </div>

                      {/* Upload Photo from local device button */}
                      <button
                        type="button"
                        id="btn-upload-profile-photo"
                        disabled={isUploadingPhoto}
                        onClick={() => photoInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingPhoto ? (
                          <>
                            <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            <span>{t.UPLOADING_ONLINE}</span>
                          </>
                        ) : (
                          <>
                            <span>📷</span>
                            <span>{t.UPLOAD_PHOTO_DEVICE}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Visual Photo Thumbnails with Delete button */}
                    {currentPhotosList.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38]">
                        {currentPhotosList.map((url, i) => (
                          <div key={i} className="relative group rounded overflow-hidden aspect-square border border-[#333345] bg-black/50">
                            <img
                              src={url}
                              alt={`Upload ${i + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.onerror = null;
                                target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1 gap-1">
                              <span className="text-[9px] text-white truncate max-w-full text-center font-mono">
                                #{i + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(url)}
                                className="px-1.5 py-0.5 rounded bg-[var(--status-danger)] text-white text-[10px] font-bold cursor-pointer hover:bg-red-700"
                              >
                                ✕ {t.REMOVE_MEDIA}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Direct Textarea for URLs */}
                    <div>
                      <span className="block text-[11px] text-[var(--text-muted)] mb-1">
                        {lang === 'bg' ? 'URL адреси на снимките (по един на ред):' : 'Photo URLs (one per line):'}
                      </span>
                      <textarea
                        id={`field-${field.id}`}
                        rows={2}
                        value={photosInput}
                        onChange={(e) => setPhotosInput(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full px-3 py-2 text-xs font-mono rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>
                );
              }

              if (field.type === 'media_video') {
                return (
                  <div key={field.id} className="md:col-span-2 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-xs font-semibold text-white">
                        {label} ({lang === 'bg' ? 'Видео-визитка' : 'Video Clip'})
                      </label>

                      {/* Upload Video from local device button */}
                      <button
                        type="button"
                        id="btn-upload-profile-video"
                        disabled={isUploadingVideo}
                        onClick={() => videoInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--secondary)] hover:bg-[#8338EC] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingVideo ? (
                          <>
                            <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            <span>{t.UPLOADING_ONLINE}</span>
                          </>
                        ) : (
                          <>
                            <span>▶</span>
                            <span>{t.UPLOAD_VIDEO_DEVICE}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Video Player Preview if URL is set */}
                    {value && (
                      <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[var(--status-online)] font-semibold flex items-center gap-1">
                            <span>✓</span>
                            <span>{t.ONLINE_STORED}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleFieldChange(field.id, '')}
                            className="text-xs text-[var(--status-danger)] hover:underline cursor-pointer"
                          >
                            ✕ {t.REMOVE_MEDIA}
                          </button>
                        </div>
                        <video src={value} controls className="max-h-48 rounded w-full bg-black" />
                      </div>
                    )}

                    <input
                      id={`field-${field.id}`}
                      type="text"
                      value={value}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder="https://example.com/video.mp4"
                      className="w-full px-3 py-2 text-xs font-mono rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Bottom Save & Close buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 flex-wrap border-t border-[#262635]">
            {onClose && (
              <button
                type="button"
                id="btn-close-profile-bottom"
                onClick={onClose}
                className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-[#262638] hover:bg-[#34344C] text-white/90 hover:text-white text-xs font-bold border border-[#3C3C52] transition-colors cursor-pointer"
              >
                {lang === 'bg' ? 'Затвори' : 'Close'}
              </button>
            )}
            <button
              type="submit"
              id="btn-save-profile"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? t.SYNC_STATUS_PROGRESS : t.SAVE_PROFILE}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
