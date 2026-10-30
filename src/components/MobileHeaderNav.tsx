import React, { useState } from 'react';
import { Language, NostrIdentity, UserProfile } from '../types';
import { SavedAccount } from '../services/db';
import { getEffectiveAvatar } from '../services/avatarPresets';
import { PWAInstallButton } from './PWAInstallButton';

interface MobileHeaderNavProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  identity: NostrIdentity | null;
  myProfile?: UserProfile | null;
  savedAccounts: SavedAccount[];
  activeTab: 'dating' | 'chats' | 'groups' | 'settings';
  onSelectTab: (tab: 'dating' | 'chats' | 'groups' | 'settings') => void;
  hasUnreadChats: boolean;
  unreadCount?: number;
  pendingRequestsCount?: number;
  unacceptedInvitesCount?: number;
  onOpenKeysAndBackups: () => void;
  onOpenChatSettings: () => void;
  onOpenHowItWorks?: () => void;
  onOpenProfileSettings: () => void;
  onSwitchAccount: (identity: NostrIdentity) => void;
  onNewProfile: () => void;
  onDeleteSavedAccount: (pubkey: string) => void;
  onLogout: () => void;
}

export const MobileHeaderNav: React.FC<MobileHeaderNavProps> = ({
  lang,
  onLanguageChange,
  identity,
  myProfile,
  savedAccounts,
  activeTab,
  onSelectTab,
  hasUnreadChats,
  unreadCount = 0,
  pendingRequestsCount = 0,
  unacceptedInvitesCount = 0,
  onOpenKeysAndBackups,
  onOpenChatSettings,
  onOpenHowItWorks,
  onOpenProfileSettings,
  onSwitchAccount,
  onNewProfile,
  onDeleteSavedAccount,
  onLogout
}) => {
  const [showDrawerMenu, setShowDrawerMenu] = useState(false);
  const [showProfileActionsModal, setShowProfileActionsModal] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

  const appTitle = lang === 'bg' ? 'Намери Секс' : 'FS_Chat';

  const otherAccounts = savedAccounts.filter(
    (acc) => acc.identity.pubKeyHex !== identity?.pubKeyHex
  );

  return (
    <div className="md:hidden w-full bg-[var(--bg-main)] border-b border-[#23232F] sticky top-0 z-40 select-none shadow-md">
      {/* ──────────────── ROW 1 ──────────────── */}
      {/* Left: Chat Icon + Chat Name | Right: Menu Button */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-main)]/95 backdrop-blur-md border-b border-[#20202C]">
        <div className="flex items-center gap-2.5">
          {/* Stylized Glowing Logo */}
          <div className="relative flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#2B2B38] shadow-[0_0_12px_rgba(157,78,221,0.3)]">
            <svg
              className="w-5 h-5"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="mob-heart-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF007F" />
                  <stop offset="50%" stopColor="#D946EF" />
                  <stop offset="100%" stopColor="#9D4EDD" />
                </linearGradient>
                <linearGradient id="mob-bolt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFE600" />
                  <stop offset="100%" stopColor="#FFAA00" />
                </linearGradient>
              </defs>
              <path
                d="M50 85 C30 68 15 54 15 37 A19 19 0 0 1 47 25 L50 29 L53 25 A19 19 0 0 1 85 37 C85 54 70 68 50 85 Z"
                fill="url(#mob-heart-grad)"
              />
              <path
                d="M54 28 L42 50 L49 50 L45 72 L60 47 L52 47 Z"
                fill="url(#mob-bolt-grad)"
                stroke="#FFFFFF"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
            <span>{appTitle}</span>
            <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-[var(--primary)]/20 text-[var(--primary-hover)] border border-[var(--primary)]/30">
              NOSTR
            </span>
          </h1>
        </div>

        {/* Right Controls: Install App Button (visible only when installable) + Menu Button */}
        <div className="flex items-center gap-1.5">
          <PWAInstallButton lang={lang} />

          <button
            id="btn-mobile-hamburger"
            type="button"
            onClick={() => setShowDrawerMenu(true)}
            className="p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] hover:bg-[#2A2A38] border border-[#2F2F40] text-white transition-colors cursor-pointer shadow flex items-center justify-center shrink-0"
            title={lang === 'bg' ? 'Отвори меню' : 'Open menu'}
            aria-label="Menu"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ──────────────── ROW 2 ──────────────── */}
      {/* Left: Language Switcher | Right: Logged-in profile name & actions */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface)]/80 border-b border-[#20202C] text-xs">
        {/* Language switch icons/buttons */}
        <div className="flex items-center rounded-[var(--radius-sm)] bg-[var(--bg-main)] p-0.5 border border-[#2B2B38] shrink-0">
          <button
            type="button"
            onClick={() => onLanguageChange('bg')}
            className={`px-2 py-0.5 text-[11px] font-bold rounded transition-colors ${
              lang === 'bg'
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
            title="Български език"
          >
            🇧🇬 BG
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('en')}
            className={`px-2 py-0.5 text-[11px] font-bold rounded transition-colors ${
              lang === 'en'
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
            title="English language"
          >
            🇬🇧 EN
          </button>
        </div>

        {/* Current logged-in profile display & actions - expands to occupy all remaining space */}
        <button
          type="button"
          onClick={() => setShowProfileActionsModal(true)}
          className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-[#262635] border border-[#2C2C3D] text-white transition-colors cursor-pointer shadow-sm"
          title={lang === 'bg' ? 'Управление на профила' : 'Profile Management'}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 border border-[#3E3E52] bg-[#20202E]">
              <img
                src={getEffectiveAvatar(myProfile)}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-bold truncate text-[11px] text-white">
              {myProfile?.name || (identity ? `Anon_${identity.npub.slice(-4)}` : 'Гост')}
            </span>
          </div>
          <svg className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* ──────────────── ROW 3 ──────────────── */}
      {/* Large navigation icons ONLY: Запознанства, Разговори, Стаи/Групи */}
      <div className="flex items-center justify-around px-2 py-1.5 bg-[var(--bg-main)]">
        {/* TAB 1: Запознанства (Dating / Discovery) */}
        <button
          type="button"
          id="mob-tab-dating"
          onClick={() => onSelectTab('dating')}
          className={`flex-1 flex items-center justify-center py-2.5 rounded-[var(--radius-sm)] transition-all cursor-pointer ${
            activeTab === 'dating'
              ? 'bg-[var(--primary)] text-white shadow-md'
              : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface)]'
          }`}
          title={lang === 'bg' ? 'Запознанства' : 'Dating'}
          aria-label={lang === 'bg' ? 'Запознанства' : 'Dating'}
        >
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>

        {/* TAB 2: Разговори (Chats) */}
        <button
          type="button"
          id="mob-tab-chats"
          onClick={() => onSelectTab('chats')}
          className={`flex-1 flex items-center justify-center py-2.5 rounded-[var(--radius-sm)] transition-all relative cursor-pointer ${
            activeTab === 'chats'
              ? 'bg-[var(--primary)] text-white shadow-md'
              : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface)]'
          }`}
          title={lang === 'bg' ? 'Разговори' : 'Chats'}
          aria-label={lang === 'bg' ? 'Разговори' : 'Chats'}
        >
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {unreadCount > 0 ? (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold absolute top-1.5 right-4 ring-2 ring-[var(--bg-main)] flex items-center justify-center animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : hasUnreadChats ? (
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--secondary)] absolute top-2 right-6 ring-2 ring-[var(--bg-main)]" />
          ) : null}
        </button>

        {/* TAB 3: Стаи / Групи (Groups / Rooms) */}
        <button
          type="button"
          id="mob-tab-groups"
          onClick={() => onSelectTab('groups')}
          className={`flex-1 flex items-center justify-center py-2.5 rounded-[var(--radius-sm)] transition-all relative cursor-pointer ${
            activeTab === 'groups'
              ? 'bg-[var(--primary)] text-white shadow-md'
              : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface)]'
          }`}
          title={lang === 'bg' ? 'Стаи / Групи' : 'Rooms & Groups'}
          aria-label={lang === 'bg' ? 'Стаи / Групи' : 'Rooms & Groups'}
        >
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {(pendingRequestsCount + unacceptedInvitesCount > 0) && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold absolute top-1.5 right-4 ring-2 ring-[var(--bg-main)] flex items-center justify-center animate-bounce">
              {pendingRequestsCount + unacceptedInvitesCount}
            </span>
          )}
        </button>
      </div>

      {/* ──────────────── MODAL DRAWER MENU ──────────────── */}
      {/* Contains everything outside chat: Keys/backups/donations, Profile/settings, Chat settings */}
      {showDrawerMenu && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xs h-full bg-[var(--bg-surface)] border-l border-[#2F2F42] shadow-2xl flex flex-col p-4 animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2B38] mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">⚙️</span>
                <h3 className="text-sm font-bold text-white">
                  {lang === 'bg' ? 'Меню и Настройки' : 'Menu & Settings'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDrawerMenu(false)}
                className="text-[var(--text-muted)] hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {/* Option 1: Настройки на ключове, папки и бекъпи */}
              <button
                type="button"
                onClick={() => {
                  setShowDrawerMenu(false);
                  onOpenKeysAndBackups();
                }}
                className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-[#262638] border border-[#2E2E40] text-left transition-colors flex items-center gap-3 cursor-pointer group shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30 text-sm">
                  🔑
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                    {lang === 'bg' ? 'Ключове, папки и бекъпи' : 'Keys, Folders & Backups'}
                  </h4>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {lang === 'bg' ? 'Защита, архивиране и дарение за сървъри' : 'Key security, vault backups & server donations'}
                  </p>
                </div>
              </button>

              {/* Option 2: Профил */}
              <button
                type="button"
                onClick={() => {
                  setShowDrawerMenu(false);
                  onOpenProfileSettings();
                }}
                className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-[#262638] border border-[#2E2E40] text-left transition-colors flex items-center gap-3 cursor-pointer group shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--primary)]/20 text-[var(--primary-hover)] flex items-center justify-center shrink-0 border border-[var(--primary)]/30 text-sm">
                  👤
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-[var(--primary-hover)] transition-colors">
                    {lang === 'bg' ? 'Профил' : 'Profile'}
                  </h4>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {lang === 'bg' ? 'Снимки, ориентация, описание и данни' : 'Photos, orientation, bio and details'}
                  </p>
                </div>
              </button>

              {/* Option 3: Настройки на чата */}
              <button
                type="button"
                onClick={() => {
                  setShowDrawerMenu(false);
                  onOpenChatSettings();
                }}
                className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-[#262638] border border-[#2E2E40] text-left transition-colors flex items-center justify-between cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 text-sm">
                    💬⚙️
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {lang === 'bg' ? 'Настройки на чата' : 'Chat Settings'}
                    </h4>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {lang === 'bg' ? 'Цветове, звуци, шрифтове и напомняния' : 'Themes, sounds, fonts & reminders'}
                    </p>
                  </div>
                </div>
                {(unreadCount + pendingRequestsCount + unacceptedInvitesCount > 0) && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold">
                    {unreadCount + pendingRequestsCount + unacceptedInvitesCount}
                  </span>
                )}
              </button>

              {/* Option 4: Образователен панел: Как работи този чат? */}
              {onOpenHowItWorks && (
                <button
                  type="button"
                  id="btn-mobile-how-it-works"
                  onClick={() => {
                    setShowDrawerMenu(false);
                    onOpenHowItWorks();
                  }}
                  className="w-full p-3 rounded-[var(--radius-sm)] bg-amber-950/20 hover:bg-amber-900/30 border border-amber-500/30 text-left transition-colors flex items-center gap-3 cursor-pointer group shadow-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30 text-base">
                    💡
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300 group-hover:text-amber-200 transition-colors">
                      {lang === 'bg' ? 'Как работи този чат?' : 'How Does This Chat Work?'}
                    </h4>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {lang === 'bg' ? 'NOSTR мрежа, релета, криптиране и Tor' : 'NOSTR, relays, encryption & Tor anonymity'}
                    </p>
                  </div>
                </button>
              )}

              {/* Option 5: Инсталирай приложението (PWA) - видима само ако е инсталируемо */}
              <PWAInstallButton lang={lang} variant="menu-item" />
            </div>

            <div className="pt-3 border-t border-[#262636] flex justify-end">
              <button
                type="button"
                onClick={() => setShowDrawerMenu(false)}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-main)] text-xs text-white"
              >
                {lang === 'bg' ? 'Затвори' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── PROFILE ACTIONS MODAL (Row 2 right) ──────────────── */}
      {/* New profile / Switch profile / Delete profile / Logout */}
      {showProfileActionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333348] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3D]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full overflow-hidden border border-[#3E3E52]">
                  <img src={getEffectiveAvatar(myProfile)} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white truncate max-w-[170px]">
                    {myProfile?.name || `Anon_${identity?.npub.slice(-4)}`}
                  </h4>
                  <span className="text-[9px] font-mono text-[var(--text-muted)]">
                    {identity?.npub.slice(0, 8)}...{identity?.npub.slice(-4)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileActionsModal(false)}
                className="text-[var(--text-muted)] hover:text-white text-base p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {/* Option 1: Нов профил */}
              <button
                type="button"
                onClick={() => {
                  setShowProfileActionsModal(false);
                  onNewProfile();
                }}
                className="w-full p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-[#272738] border border-[#323246] flex items-center gap-3 transition-colors text-white font-medium cursor-pointer"
              >
                <span className="text-base">➕</span>
                <span>{lang === 'bg' ? 'Нов профил (Нова самоличност)' : 'New Profile (New Identity)'}</span>
              </button>

              {/* Option 2: Смяна на профил */}
              <button
                type="button"
                onClick={() => {
                  setShowProfileActionsModal(false);
                  setShowSwitchModal(true);
                }}
                className="w-full p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-[#272738] border border-[#323246] flex items-center justify-between transition-colors text-white font-medium cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base">🔄</span>
                  <span>{lang === 'bg' ? 'Смяна на профил' : 'Switch Profile'}</span>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#2E2E40] text-[var(--text-muted)]">
                  {savedAccounts.length}
                </span>
              </button>

              {/* Option 3: Изтриване на профил от списъка */}
              <button
                type="button"
                onClick={() => {
                  setShowProfileActionsModal(false);
                  setShowDeleteAccountModal(true);
                }}
                className="w-full p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-rose-900/20 border border-rose-500/30 flex items-center gap-3 transition-colors text-rose-300 font-medium cursor-pointer"
              >
                <span className="text-base">🗑️</span>
                <span>{lang === 'bg' ? 'Изтриване на профил' : 'Delete Profile'}</span>
              </button>

              {/* Option 4: Излизане от профила */}
              <button
                type="button"
                onClick={() => {
                  setShowProfileActionsModal(false);
                  onLogout();
                }}
                className="w-full p-2.5 rounded-[var(--radius-sm)] bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 flex items-center gap-3 transition-colors text-rose-200 font-bold cursor-pointer"
              >
                <span className="text-base">🚪</span>
                <span>{lang === 'bg' ? 'Излизане от профила' : 'Log Out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── SWITCH ACCOUNT MODAL ──────────────── */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333348] p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C3D]">
              <h4 className="text-xs font-bold text-white">
                {lang === 'bg' ? 'Изберете профил за превключване:' : 'Select account to switch to:'}
              </h4>
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Direct Create New Profile Button */}
            <button
              type="button"
              onClick={() => {
                setShowSwitchModal(false);
                onNewProfile();
              }}
              className="w-full p-2.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow"
            >
              <span className="text-sm">➕</span>
              <span>{lang === 'bg' ? '+ Нов / Друг профил' : '+ New / Another Profile'}</span>
            </button>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-0.5">
              {savedAccounts.map((acc) => {
                const isCurrent = acc.identity.pubKeyHex === identity?.pubKeyHex;
                return (
                  <div
                    key={acc.identity.pubKeyHex}
                    className={`w-full p-2 rounded-[var(--radius-sm)] border transition-colors flex items-center justify-between gap-2 ${
                      isCurrent
                        ? 'bg-[var(--primary)]/15 border-[var(--primary)]/40 text-white'
                        : 'bg-[var(--bg-main)] border-[#313145] text-white/90'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-[#444458]">
                        <img src={getEffectiveAvatar(acc.profile)} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">
                          {acc.profile?.name || `Anon_${acc.identity.npub.slice(-4)}`}
                        </div>
                        <div className="text-[9px] font-mono text-[var(--text-muted)] truncate">
                          {acc.identity.npub.slice(0, 8)}...{acc.identity.npub.slice(-4)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCurrent ? (
                        <span className="px-2 py-1 rounded text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                          {lang === 'bg' ? '✓ Активен' : '✓ Active'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onSwitchAccount(acc.identity);
                            setShowSwitchModal(false);
                          }}
                          className="px-2.5 py-1 rounded text-[10px] font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white cursor-pointer transition-colors"
                        >
                          {lang === 'bg' ? 'Смени' : 'Switch'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onDeleteSavedAccount(acc.identity.pubKeyHex);
                        }}
                        className="p-1.5 rounded bg-rose-950/40 hover:bg-rose-900 border border-rose-800/40 text-rose-300 hover:text-white transition-colors cursor-pointer text-xs"
                        title={lang === 'bg' ? 'Изтрий профил от устройството' : 'Delete profile from device'}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#2C2C3D] flex justify-end">
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[#2A2A38] text-xs text-white"
              >
                {lang === 'bg' ? 'Затвори' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── DELETE ACCOUNT MODAL ──────────────── */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-rose-500/40 p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C3D]">
              <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <span>🗑️</span>
                <span>{lang === 'bg' ? 'Изтрий профил от устройството' : 'Delete profile from device'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-[var(--text-muted)]">
              {lang === 'bg'
                ? 'Изберете кой профил да премахнете от съхранените на това устройство.'
                : 'Select which profile to remove from stored accounts on this device.'}
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
              {savedAccounts.map((acc) => (
                <div
                  key={acc.identity.pubKeyHex}
                  className="p-2 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#313145] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-[#444458]">
                      <img src={getEffectiveAvatar(acc.profile)} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-white truncate">
                        {acc.profile?.name || `Anon_${acc.identity.npub.slice(-4)}`}
                      </div>
                      <div className="text-[9px] font-mono text-[var(--text-muted)] truncate">
                        {acc.identity.npub.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteSavedAccount(acc.identity.pubKeyHex);
                      if (savedAccounts.length <= 1) {
                        setShowDeleteAccountModal(false);
                      }
                    }}
                    className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    {lang === 'bg' ? 'Изтрий' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#2C2C3D] flex justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[#2A2A38] text-xs text-white"
              >
                {lang === 'bg' ? 'Затвори' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
