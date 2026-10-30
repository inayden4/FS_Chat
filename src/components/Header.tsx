import React, { useState, useRef, useEffect } from 'react';
import { UI_TRANSLATIONS, Language, NostrIdentity, UserProfile } from '../types';
import { SavedAccount } from '../services/db';
import { PWAInstallButton } from './PWAInstallButton';
import { getEffectiveAvatar } from '../services/avatarPresets';

interface HeaderProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  isSynced: boolean;
  identity: NostrIdentity | null;
  myProfile?: UserProfile | null;
  savedAccounts?: SavedAccount[];
  onOpenIdentityModal: () => void;
  onOpenChatSettings?: () => void;
  onOpenHowItWorks?: () => void;
  onSwitchAccount?: (identity: NostrIdentity) => void;
  onNewProfile?: () => void;
  onDeleteSavedAccount?: (pubkey: string) => void;
  onQuickLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onLanguageChange,
  isSynced,
  identity,
  myProfile,
  savedAccounts = [],
  onOpenIdentityModal,
  onOpenChatSettings,
  onOpenHowItWorks,
  onSwitchAccount,
  onNewProfile,
  onDeleteSavedAccount,
  onQuickLogout
}) => {
  const t = UI_TRANSLATIONS[lang];
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const otherAccounts = savedAccounts.filter(
    (acc) => acc.identity.pubKeyHex !== identity?.pubKeyHex
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--bg-main)]/90 backdrop-blur-md border-b border-[#23232F]">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Logo & App Title with tooltip */}
        <div
          className="flex items-center gap-3 cursor-pointer select-none"
          title={`${t.APP_TITLE} - ${lang === 'bg' ? 'Децентрализиран и криптиран чат' : 'Decentralized & Encrypted Chat'}`}
        >
          {/* Inline SVG App Logo: Stylized glowing heart with integrated Nostr lightning bolt */}
          <div
            className="relative flex items-center justify-center w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#2B2B38] shadow-[0_0_15px_rgba(157,78,221,0.3)]"
            title={`${t.APP_TITLE} - ${lang === 'bg' ? 'Сигурност и поверителност' : 'Security & Privacy'}`}
          >
            <svg
              className="w-7 h-7"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label={`${t.APP_TITLE} Logo`}
            >
              <defs>
                <linearGradient id="header-heart-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF007F" />
                  <stop offset="50%" stopColor="#D946EF" />
                  <stop offset="100%" stopColor="#9D4EDD" />
                </linearGradient>
                <linearGradient id="header-bolt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFE600" />
                  <stop offset="100%" stopColor="#FFAA00" />
                </linearGradient>
                <filter id="header-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Outer glowing heart */}
              <path
                d="M50 85 C30 68 15 54 15 37 A19 19 0 0 1 47 25 L50 29 L53 25 A19 19 0 0 1 85 37 C85 54 70 68 50 85 Z"
                fill="url(#header-heart-grad)"
                filter="url(#header-glow)"
              />
              {/* Nostr Lightning Bolt inside */}
              <path
                d="M54 28 L42 50 L49 50 L45 72 L60 47 L52 47 Z"
                fill="url(#header-bolt-grad)"
                stroke="#FFFFFF"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="flex flex-col">
            <h1 className="text-sm md:text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
              <span>{t.APP_TITLE}</span>
              <span
                className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-[var(--primary)]/20 text-[var(--primary-hover)] border border-[var(--primary)]/30"
                title="Децентрализиран Nostr протокол"
              >
                NOSTR
              </span>
            </h1>

            {/* Live Sync Status with tooltip */}
            <div
              className="flex items-center gap-1.5 text-[11px] mt-0.5"
              title={isSynced ? "Всички съобщения и релета са синхронизирани на 100%" : "Синхронизация с Nostr релетата в реално време..."}
            >
              <span
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  isSynced
                    ? 'bg-[var(--status-online)] shadow-[0_0_8px_var(--status-online)]'
                    : 'bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]'
                }`}
              />
              <span className={isSynced ? 'text-[var(--status-online)] font-medium' : 'text-amber-300'}>
                {isSynced ? t.SYNC_STATUS_OK : t.SYNC_STATUS_PROGRESS}
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls: PWA Install, Language Switch, Profile Switcher, Quick Logout */}
        <div className="flex items-center gap-2 md:gap-3">
          <PWAInstallButton lang={lang} />

          {/* Language Switcher with tooltips */}
          <div className="flex items-center rounded-[var(--radius-sm)] bg-[var(--bg-surface)] p-0.5 border border-[#2B2B38]">
            <button
              id="lang-bg-btn"
              onClick={() => onLanguageChange('bg')}
              title="Превключи на Български език"
              aria-label="Български език"
              className={`px-2 py-1 text-xs font-bold rounded-[4px] transition-colors ${
                lang === 'bg'
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              BG
            </button>
            <button
              id="lang-en-btn"
              onClick={() => onLanguageChange('en')}
              title="Switch to English language"
              aria-label="English language"
              className={`px-2 py-1 text-xs font-bold rounded-[4px] transition-colors ${
                lang === 'en'
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Profile Switcher Dropdown */}
          {identity && (
            <div className="relative" ref={menuRef}>
              <button
                id="btn-profile-switcher"
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                title={t.SWITCH_PROFILE}
                aria-label={t.SWITCH_PROFILE}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[#2B2B38] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 border border-[#3E3E52] bg-[#20202E]">
                  <img
                    src={getEffectiveAvatar(myProfile)}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="hidden sm:inline font-bold truncate max-w-[90px]">
                  {myProfile?.name || `Anon_${identity.npub.slice(-4)}`}
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-80 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333348] shadow-2xl p-3 z-50 text-xs space-y-2.5">
                  {/* Instant New Profile Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNewProfile?.();
                    }}
                    className="w-full py-2 px-3 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow"
                    title={lang === 'bg' ? 'Генерирай нов профил на момента' : 'Generate new profile instantly'}
                  >
                    <span className="text-sm">➕</span>
                    <span>{lang === 'bg' ? '+ Нов / Друг профил' : '+ New / Another Profile'}</span>
                  </button>

                  {/* All Saved Subscriber Profiles */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-1">
                      <span>{lang === 'bg' ? 'Всички профили' : 'All Profiles'} ({savedAccounts.length})</span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
                      {savedAccounts.map((acc) => {
                        const isCurrent = acc.identity.pubKeyHex === identity?.pubKeyHex;
                        return (
                          <div
                            key={acc.identity.pubKeyHex}
                            className={`p-2 rounded-[var(--radius-sm)] border flex items-center justify-between gap-2 transition-colors ${
                              isCurrent
                                ? 'bg-[var(--primary)]/15 border-[var(--primary)]/40 text-white'
                                : 'bg-[var(--bg-main)] border-[#313145] text-white/90'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-[#3E3E52]">
                                <img
                                  src={getEffectiveAvatar(acc.profile)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate text-xs">
                                  {acc.profile?.name || `Anon_${acc.identity.npub.slice(-4)}`}
                                </div>
                                <div className="font-mono text-[9px] text-[var(--text-muted)] truncate">
                                  {acc.identity.npub.slice(0, 8)}...{acc.identity.npub.slice(-4)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isCurrent ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                                  {lang === 'bg' ? '✓ Активен' : '✓ Active'}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowProfileMenu(false);
                                    onSwitchAccount?.(acc.identity);
                                  }}
                                  className="px-2 py-1 rounded text-[10px] font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white cursor-pointer transition-colors"
                                >
                                  {lang === 'bg' ? 'Смени' : 'Switch'}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onDeleteSavedAccount?.(acc.identity.pubKeyHex)}
                                className="p-1 rounded bg-rose-950/40 hover:bg-rose-900 border border-rose-800/40 text-rose-300 hover:text-white transition-colors cursor-pointer text-xs"
                                title={lang === 'bg' ? 'Изтрий профил от устройството' : 'Delete profile from device'}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions: PWA Install, Chat Settings, Key Login and Logout */}
                  <div className="pt-2 border-t border-[#2C2C3D] space-y-1">
                    <PWAInstallButton lang={lang} variant="menu-item" className="mb-1" />
                    {onOpenChatSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          onOpenChatSettings();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-main)] text-white text-left font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                        title={lang === 'bg' ? 'Настройки на чата (Цветове, звуци, шрифт)' : 'Chat Settings (Themes, sounds, fonts)'}
                      >
                        <span className="text-base">💬⚙️</span>
                        <span>{lang === 'bg' ? 'Настройки на чата' : 'Chat Settings'}</span>
                      </button>
                    )}

                    {onOpenHowItWorks && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          onOpenHowItWorks();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-main)] text-white text-left font-semibold flex items-center gap-2 transition-colors cursor-pointer text-amber-300"
                        title={lang === 'bg' ? 'Как работи този чат? (NOSTR, Релета, Криптиране и Tor)' : 'How This Chat Works'}
                      >
                        <span className="text-base">💡</span>
                        <span className="text-white">{lang === 'bg' ? 'Как работи този чат?' : 'How it works'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onOpenIdentityModal();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-main)] text-white text-left font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      title={lang === 'bg' ? 'Вход с друг криптографски ключ или файл' : 'Login with key or file'}
                    >
                      <span className="text-base">🔑</span>
                      <span>{lang === 'bg' ? 'Вход с друг ключ / архив' : 'Login with key / backup'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onQuickLogout?.();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] hover:bg-rose-900/30 text-rose-300 text-left font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      title={t.QUICK_LOGOUT}
                    >
                      <span className="text-base">🚪</span>
                      <span>{t.QUICK_LOGOUT}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Desktop Educational Panel Button: Как работи? */}
          {onOpenHowItWorks && (
            <button
              id="btn-desktop-how-it-works"
              type="button"
              onClick={onOpenHowItWorks}
              title={lang === 'bg' ? 'Как работи този чат? (NOSTR, Релета, Криптиране и Tor)' : 'How this chat works (NOSTR, Relays, Encryption & Tor)'}
              aria-label="How it works"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-amber-500/30 hover:border-amber-400 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <span className="text-amber-400">💡</span>
              <span className="hidden xl:inline">{lang === 'bg' ? 'Как работи?' : 'How it works'}</span>
            </button>
          )}

          {/* Desktop Chat Settings Button */}
          {onOpenChatSettings && (
            <button
              id="btn-desktop-chat-settings"
              type="button"
              onClick={onOpenChatSettings}
              title={lang === 'bg' ? 'Настройки на чата (Цветове, звуци, шрифтове)' : 'Chat Settings (Themes, sounds, fonts)'}
              aria-label="Chat Settings"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[#2B2B38] text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <span>💬⚙️</span>
              <span className="hidden xl:inline">{lang === 'bg' ? 'Настройки чат' : 'Chat Settings'}</span>
            </button>
          )}

          {/* Quick Logout Standalone Button in Header */}
          {identity && (
            <button
              id="btn-quick-logout"
              type="button"
              onClick={onQuickLogout}
              title={t.QUICK_LOGOUT}
              aria-label={t.QUICK_LOGOUT}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-300 transition-colors cursor-pointer"
            >
              <span>🚪</span>
              <span className="hidden md:inline">{t.QUICK_LOGOUT}</span>
            </button>
          )}

          {/* Identity / Key Details Button with tooltip */}
          {identity && (
            <button
              id="btn-open-identity"
              onClick={onOpenIdentityModal}
              title={`Криптографски публичен ключ: ${identity.npub} (Кликни за детайли)`}
              aria-label="Криптографски Nostr ключове"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[#2B2B38] text-xs font-medium text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-[var(--secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="m21 2-9.6 9.6" />
                <path d="m15.5 7.5 3 3L22 7l-3-3" />
              </svg>
              <span className="hidden sm:inline font-mono text-[11px]">
                {identity.npub.slice(0, 6)}...{identity.npub.slice(-4)}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
