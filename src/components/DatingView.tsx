import React, { useState, useMemo, useEffect } from 'react';
import { UI_TRANSLATIONS, Language, UserProfile, parseInterestsList } from '../types';
import { normalizeMediaUrl } from '../services/mediaUpload';
import { getEffectiveAvatar } from '../services/avatarPresets';
import { ImageZoomModal } from './ImageZoomModal';

interface DatingViewProps {
  lang: Language;
  profiles: UserProfile[];
  friends: string[];
  blocked: string[];
  hidden: string[];
  onStartChat: (pubkey: string) => void;
  onToggleFriend: (pubkey: string) => void;
  onToggleBlock: (pubkey: string) => void;
  onToggleHide: (pubkey: string) => void;
}

export const DatingView: React.FC<DatingViewProps> = ({
  lang,
  profiles,
  friends,
  blocked,
  hidden,
  onStartChat,
  onToggleFriend,
  onToggleBlock,
  onToggleHide
}) => {
  const t = UI_TRANSLATIONS[lang];

  // Filters State
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [minAge, setMinAge] = useState<number>(14);
  const [maxAge, setMaxAge] = useState<number>(99);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Profile for detailed Modal
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);

  // Fullscreen Original Image Lightbox
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false);
  const [zoomImageIdx, setZoomImageIdx] = useState<number>(0);

  // All photos for active profile gallery
  const profileGalleryImages = useMemo(() => {
    if (!activeProfile) return [];
    const list: string[] = [];
    const main = activeProfile.avatarUrl || activeProfile.photos?.[0];
    if (main) list.push(main);
    if (activeProfile.photos && activeProfile.photos.length > 0) {
      activeProfile.photos.forEach(p => {
        if (p && !list.includes(p)) list.push(p);
      });
    }
    return list;
  }, [activeProfile]);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isZoomModalOpen) {
          setIsZoomModalOpen(false);
        } else if (activeProfile) {
          setActiveProfile(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomModalOpen, activeProfile]);

  // Available locations: Extract all distinct locations available in registered subscribers/profiles
  const locations = useMemo(() => {
    const locSet = new Set<string>();
    profiles.forEach(p => {
      if (p.location && p.location.trim()) {
        locSet.add(p.location.trim());
      }
    });
    return Array.from(locSet).sort((a, b) => a.localeCompare(b, 'bg'));
  }, [profiles]);

  // Filtered profiles with pubkey deduplication
  const visibleProfiles = useMemo(() => {
    const seen = new Set<string>();
    return profiles.filter(p => {
      if (!p || !p.pubkey || seen.has(p.pubkey)) return false;
      seen.add(p.pubkey);

      // Exclude blocked or hidden
      if (blocked.includes(p.pubkey) || hidden.includes(p.pubkey)) {
        return false;
      }

      // Location filter
      if (selectedLocation !== 'all') {
        if (!p.location || !p.location.toLowerCase().includes(selectedLocation.toLowerCase())) {
          return false;
        }
      }

      // Gender filter
      if (selectedGender !== 'all') {
        if (!p.gender || !p.gender.toLowerCase().includes(selectedGender.toLowerCase())) {
          return false;
        }
      }

      // Age filter with typed min & max
      const effectiveMin = Number.isNaN(minAge) ? 14 : minAge;
      const effectiveMax = Number.isNaN(maxAge) ? 99 : maxAge;
      if (p.age < effectiveMin || p.age > effectiveMax) {
        return false;
      }

      // Text search in name / bio / interests
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchBio = (p.bio || '').toLowerCase().includes(q);
        const interestsList = parseInterestsList(p.interests);
        const matchInterests = interestsList.some(item => item.toLowerCase().includes(q));
        if (!matchName && !matchBio && !matchInterests) {
          return false;
        }
      }

      return true;
    });
  }, [profiles, blocked, hidden, selectedLocation, selectedGender, minAge, maxAge, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#262633] space-y-4 shadow-lg">
        {/* Top text search input */}
        <div className="relative">
          <input
            id="dating-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.LABEL_SEARCH_CHAT}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
          />
          <svg className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Location Filter: List of all locations present in registered profiles */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
              {t.FILTER_LOCATION} ({locations.length})
            </label>
            <select
              id="filter-location-select"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="all">{t.ALL} ({locations.length})</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
              {t.FILTER_GENDER}
            </label>
            <select
              id="filter-gender-select"
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="all">{t.ALL}</option>
              <option value="жена">{lang === 'bg' ? 'Жена' : 'Female'}</option>
              <option value="мъж">{lang === 'bg' ? 'Мъж' : 'Male'}</option>
              <option value="двойк">{lang === 'bg' ? 'Двойки' : 'Doubles'}</option>
              <option value="друг">{lang === 'bg' ? 'Друго' : 'Other'}</option>
            </select>
          </div>

          {/* Age Filter Range: Two directly typeable input fields (Min & Max) without scrolling slider */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
              {t.FILTER_AGE} ({lang === 'bg' ? 'години' : 'years'})
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-[var(--bg-main)] border border-[#333345] rounded-[var(--radius-sm)] px-2.5 py-1.5 focus-within:border-[var(--primary)] transition-colors">
                <span className="text-[10px] text-[var(--text-muted)] font-medium mr-1.5 select-none shrink-0">
                  {lang === 'bg' ? 'От' : 'Min'}
                </span>
                <input
                  id="filter-min-age-input"
                  type="number"
                  min="14"
                  max="99"
                  value={minAge}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 14 : parseInt(e.target.value, 10);
                    setMinAge(Number.isNaN(val) ? 14 : val);
                  }}
                  className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
                  placeholder="14"
                />
              </div>

              <span className="text-[var(--text-muted)] text-xs font-bold">-</span>

              <div className="flex-1 flex items-center bg-[var(--bg-main)] border border-[#333345] rounded-[var(--radius-sm)] px-2.5 py-1.5 focus-within:border-[var(--primary)] transition-colors">
                <span className="text-[10px] text-[var(--text-muted)] font-medium mr-1.5 select-none shrink-0">
                  {lang === 'bg' ? 'До' : 'Max'}
                </span>
                <input
                  id="filter-max-age-input"
                  type="number"
                  min="14"
                  max="99"
                  value={maxAge}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 99 : parseInt(e.target.value, 10);
                    setMaxAge(Number.isNaN(val) ? 99 : val);
                  }}
                  className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
                  placeholder="99"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profiles Grid */}
      {visibleProfiles.length === 0 ? (
        <div className="py-16 text-center text-xs text-[var(--text-muted)] rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#262633]">
          {t.NO_PROFILES_FOUND}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProfiles.map((profile) => {
            const isFriend = friends.includes(profile.pubkey);
            const avatarFallback = getEffectiveAvatar(profile);
            const rawMain = profile.avatarUrl || profile.photos?.[0];
            const mainPhoto = normalizeMediaUrl(rawMain) || avatarFallback;

            return (
              <div
                key={profile.pubkey}
                id={`profile-card-${profile.pubkey.slice(-6)}`}
                className="group relative flex flex-col rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#262633] hover:border-[var(--primary)] overflow-hidden transition-all duration-300 shadow-md hover:shadow-[0_4px_20px_rgba(157,78,221,0.2)]"
              >
                {/* Photo & Badges */}
                <div
                  className="relative aspect-4/3 overflow-hidden bg-black/40 cursor-pointer"
                  onClick={() => setActiveProfile(profile)}
                  title={lang === 'bg' ? 'Кликни за пълен преглед на профила' : 'Click to view profile'}
                >
                  <img
                    src={mainPhoto}
                    alt={profile.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.onerror = null;
                      target.src = avatarFallback;
                    }}
                  />

                  {/* Top Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-transparent to-black/40" />

                  {/* Online & Media Badges */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-full)] bg-black/60 backdrop-blur-md text-[10px] font-bold text-[var(--status-online)] border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-online)] animate-pulse" />
                      {t.ONLINE_NOW}
                    </span>
                    {isFriend && (
                      <span className="px-1.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--primary)] text-white text-[10px] font-bold">
                        ★ Friend
                      </span>
                    )}
                  </div>

                  {/* Photo count / Video badge */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                    {profile.video && (
                      <span className="px-2 py-0.5 rounded-[var(--radius-full)] bg-[var(--secondary)] text-white text-[10px] font-bold shadow flex items-center gap-1">
                        ▶ Video
                      </span>
                    )}
                    {profile.photos && profile.photos.length > 1 && (
                      <span className="px-2 py-0.5 rounded-[var(--radius-full)] bg-black/60 backdrop-blur-md text-white text-[10px] font-mono border border-white/20">
                        📷 {profile.photos.length}
                      </span>
                    )}
                  </div>

                  {/* Bottom info banner on photo */}
                  <div className="absolute bottom-2 inset-x-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-1.5 drop-shadow-md">
                      <span>{profile.name}</span>
                      <span className="text-sm font-normal text-white/80">, {profile.age}</span>
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                      <svg className="w-3 h-3 text-[var(--secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="truncate">{profile.location}</span>
                    </p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                  {/* Bio snippet */}
                  {profile.bio && (
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                      {profile.bio}
                    </p>
                  )}

                  {/* Interests tags snippet */}
                  {(() => {
                    const tags = parseInterestsList(profile.interests);
                    if (tags.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((item, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-[var(--radius-full)] bg-[var(--bg-main)] text-[10px] text-white/80 border border-[#2C2C3C]"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-[#262633] flex items-center gap-2">
                    <button
                      id={`btn-chat-${profile.pubkey.slice(-6)}`}
                      onClick={() => onStartChat(profile.pubkey)}
                      title={`${t.BTN_START_CHAT} (${profile.name})`}
                      aria-label={`${t.BTN_START_CHAT} with ${profile.name}`}
                      className="flex-1 py-2 px-3 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>{t.BTN_START_CHAT}</span>
                    </button>

                    <button
                      id={`btn-friend-${profile.pubkey.slice(-6)}`}
                      onClick={() => onToggleFriend(profile.pubkey)}
                      title={isFriend ? `${t.BTN_REMOVE_FRIEND} (${profile.name})` : `${t.BTN_ADD_FRIEND} (${profile.name})`}
                      aria-label={isFriend ? t.BTN_REMOVE_FRIEND : t.BTN_ADD_FRIEND}
                      className={`p-2 rounded-[var(--radius-sm)] border text-xs transition-colors cursor-pointer ${
                        isFriend
                          ? 'bg-[var(--primary)]/20 border-[var(--primary)] text-[var(--primary-hover)]'
                          : 'bg-[var(--bg-surface-hover)] border-[#333345] text-[var(--text-muted)] hover:text-white'
                      }`}
                    >
                      ★
                    </button>

                    <button
                      id={`btn-hide-${profile.pubkey.slice(-6)}`}
                      onClick={() => onToggleHide(profile.pubkey)}
                      title={`${t.BTN_HIDE} (${profile.name})`}
                      aria-label={t.BTN_HIDE}
                      className="p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-hover)] hover:bg-[#333345] border border-[#333345] text-xs text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
                    >
                      👁
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Profile Modal (Fixed for PC and Mobile with Sticky Header, Full Scrollability & Never Hidden Close Button) */}
      {activeProfile && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start min-h-screen"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveProfile(null);
          }}
        >
          <div className="w-full max-w-lg rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333345] shadow-2xl relative my-auto sm:my-8 shrink-0 flex flex-col overflow-hidden">
            {/* Modal Top Header Bar with Sticky Close Button (Always visible on PC and mobile) */}
            <div className="sticky top-0 z-30 w-full bg-[var(--bg-surface)]/95 backdrop-blur-md px-4 py-3 border-b border-[#2B2B38] flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2 truncate pr-2">
                <span className="text-sm font-bold text-white truncate">
                  {activeProfile.name}, {activeProfile.age}
                </span>
                <span className="text-xs text-[var(--text-muted)] truncate hidden sm:inline">
                  • {activeProfile.location}
                </span>
              </div>
              <button
                id="btn-close-profile-modal"
                onClick={() => setActiveProfile(null)}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[#232330] hover:bg-[#323246] text-white border border-[#3A3A4E] transition-colors flex items-center gap-1.5 text-xs font-bold shadow cursor-pointer shrink-0"
                title={t.CLOSE}
              >
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>{t.CLOSE}</span>
              </button>
            </div>

            {/* Profile Gallery Main Image (Click to view full original size) */}
            <div
              className="relative aspect-4/3 bg-black cursor-pointer group"
              onClick={() => {
                setZoomImageIdx(0);
                setIsZoomModalOpen(true);
              }}
              title={lang === 'bg' ? 'Кликни за преглед в оригинален размер (100% резолюция)' : 'Click to view full original size'}
            >
              <img
                src={normalizeMediaUrl(activeProfile.avatarUrl || activeProfile.photos?.[0]) || getEffectiveAvatar(activeProfile)}
                alt={activeProfile.name}
                className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.onerror = null;
                  target.src = getEffectiveAvatar(activeProfile);
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-transparent to-black/30" />
              
              {/* Click to zoom badge */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-[var(--radius-full)] text-[11px] text-white/90 border border-white/20 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
                <span>{lang === 'bg' ? 'Пълен размер' : 'Full Size'}</span>
              </div>

              <div className="absolute bottom-3 left-4 right-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>{activeProfile.name}</span>
                  <span className="text-lg font-normal text-white/80">, {activeProfile.age}</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-[var(--secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{activeProfile.location}</span>
                  {activeProfile.gender && (
                    <span className="ml-2 px-2 py-0.5 rounded bg-[var(--bg-main)] text-[10px] text-white/80">
                      {activeProfile.gender}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Modal Body with internal scrolling */}
            <div className="p-5 space-y-4 max-h-[55vh] overflow-y-auto">
              {/* Additional Photos Gallery (Clickable for 100% original size view) */}
              {activeProfile.photos && activeProfile.photos.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      {lang === 'bg' ? 'Галерия със снимки' : 'Photo Gallery'}
                    </h4>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {lang === 'bg' ? '(Кликни за 100% оригинален размер)' : '(Click photo for 100% original size)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {activeProfile.photos.map((rawUrl, i) => {
                      const url = normalizeMediaUrl(rawUrl);
                      const targetIdx = profileGalleryImages.indexOf(rawUrl);
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            setZoomImageIdx(targetIdx >= 0 ? targetIdx : i);
                            setIsZoomModalOpen(true);
                          }}
                          className="group relative h-24 rounded-[var(--radius-sm)] overflow-hidden border border-[#2B2B38] hover:border-[var(--primary)] cursor-pointer bg-black/40 transition-all"
                          title={lang === 'bg' ? 'Кликни за преглед в оригинален размер' : 'Click to view original size'}
                        >
                          <img
                            src={url}
                            alt={`Photo ${i}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.onerror = null;
                              target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              <line x1="11" y1="8" x2="11" y2="14" />
                              <line x1="8" y1="11" x2="14" y2="11" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Video if present */}
              {activeProfile.video && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[var(--secondary)] uppercase tracking-wider">
                    Видео-визитка / Video Clip
                  </h4>
                  <video
                    src={activeProfile.video}
                    controls
                    className="w-full rounded-[var(--radius-sm)] border border-[#2B2B38] max-h-48 bg-black"
                  />
                </div>
              )}

              {/* Bio */}
              {activeProfile.bio && (
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                    {lang === 'bg' ? 'За мен' : 'About Me'}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {activeProfile.bio}
                  </p>
                </div>
              )}

              {/* Interests (MODAL_INTERESTS_TITLE) */}
              {(() => {
                const tags = parseInterestsList(activeProfile.interests);
                if (tags.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-xs font-bold text-[var(--primary-hover)] uppercase tracking-wider mb-2">
                      {t.MODAL_INTERESTS_TITLE}
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-[var(--radius-full)] bg-[var(--bg-main)] text-xs text-white border border-[#2D2D3E]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Seeking & Orientation */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {activeProfile.Orientation && (
                  <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38]">
                    <span className="text-[var(--text-muted)] block text-[10px]">{lang === 'bg' ? 'Ориентация' : 'Orientation'}</span>
                    <span className="text-white font-medium">{activeProfile.Orientation}</span>
                  </div>
                )}
                {activeProfile.seeking && (
                  <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38]">
                    <span className="text-[var(--text-muted)] block text-[10px]">{lang === 'bg' ? 'Търся' : 'Seeking'}</span>
                    <span className="text-white font-medium">{activeProfile.seeking}</span>
                  </div>
                )}
              </div>

              {/* Nostr Public Key */}
              <div className="p-2 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#262633] text-[10px] font-mono text-[var(--text-muted)] truncate">
                NOSTR PK: {activeProfile.pubkey}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-[#262633] bg-[var(--bg-surface-hover)] flex items-center gap-2">
              <button
                id="modal-btn-start-chat"
                onClick={() => {
                  onStartChat(activeProfile.pubkey);
                  setActiveProfile(null);
                }}
                title={`${t.BTN_START_CHAT} (${activeProfile.name})`}
                aria-label={`${t.BTN_START_CHAT} (${activeProfile.name})`}
                className="flex-1 py-2.5 px-4 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow cursor-pointer"
              >
                {t.BTN_START_CHAT}
              </button>

              <button
                id="modal-btn-friend"
                onClick={() => onToggleFriend(activeProfile.pubkey)}
                title={friends.includes(activeProfile.pubkey) ? `${t.BTN_REMOVE_FRIEND} (${activeProfile.name})` : `${t.BTN_ADD_FRIEND} (${activeProfile.name})`}
                aria-label={friends.includes(activeProfile.pubkey) ? t.BTN_REMOVE_FRIEND : t.BTN_ADD_FRIEND}
                className={`py-2.5 px-3 rounded-[var(--radius-sm)] text-xs font-semibold border transition-colors cursor-pointer ${
                  friends.includes(activeProfile.pubkey)
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-[var(--bg-surface)] border-[#333345] text-white hover:bg-[#333345]'
                }`}
              >
                {friends.includes(activeProfile.pubkey) ? t.BTN_REMOVE_FRIEND : t.BTN_ADD_FRIEND}
              </button>

              <button
                id="modal-btn-block"
                onClick={() => {
                  onToggleBlock(activeProfile.pubkey);
                  setActiveProfile(null);
                }}
                title={`${t.BTN_BLOCK} (${activeProfile.name})`}
                aria-label={`${t.BTN_BLOCK} (${activeProfile.name})`}
                className="py-2.5 px-3 rounded-[var(--radius-sm)] bg-[var(--status-danger)]/15 border border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger)]/25 text-xs font-semibold transition-colors cursor-pointer"
              >
                {t.BTN_BLOCK}
              </button>

              <button
                id="modal-btn-close-bottom"
                onClick={() => setActiveProfile(null)}
                title={t.CLOSE}
                aria-label={t.CLOSE}
                className="py-2.5 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] hover:bg-[#333345] border border-[#333345] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {t.CLOSE}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Original Image Lightbox Modal with 100% Zoom, Pan, Fit, and Navigation */}
      <ImageZoomModal
        isOpen={isZoomModalOpen}
        onClose={() => setIsZoomModalOpen(false)}
        images={profileGalleryImages}
        currentIndex={zoomImageIdx}
        onIndexChange={(idx) => setZoomImageIdx(idx)}
        title={`${activeProfile?.name || ''} - ${lang === 'bg' ? 'Галерия' : 'Gallery'}`}
        lang={lang}
      />
    </div>
  );
};
