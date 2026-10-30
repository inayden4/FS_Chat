import React, { useState } from 'react';
import { Language, UI_TRANSLATIONS } from '../types';
import * as db from '../services/db';
import {
  useChatPreferences,
  CHAT_THEMES,
  ChatThemeId,
  ChatFontSize,
  getChatFontSizeClasses
} from '../services/chatPreferences';
import {
  playTextMessageSound,
  playJoinRequestSound,
  playVoiceMessageSound,
  playReminderAlertSound
} from '../services/soundEffects';
import {
  BrowserId,
  AVAILABLE_BROWSERS,
  getBrowserConfig,
  saveBrowserConfig,
  BrowserConfig
} from '../services/browserConfig';

interface ChatSettingsModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  blockedCount: number;
  onOpenBlockedUsers: () => void;
  onHistoryCleared?: () => void;
  onOpenHowItWorks?: () => void;
  unreadCount?: number;
  pendingRequestsCount?: number;
  unacceptedInvitesCount?: number;
}

export const ChatSettingsModal: React.FC<ChatSettingsModalProps> = ({
  lang,
  isOpen,
  onClose,
  blockedCount,
  onOpenBlockedUsers,
  onHistoryCleared,
  onOpenHowItWorks,
  unreadCount = 0,
  pendingRequestsCount = 0,
  unacceptedInvitesCount = 0
}) => {
  const t = UI_TRANSLATIONS[lang];
  const [prefs, setPrefs] = useChatPreferences();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearedMsg, setClearedMsg] = useState(false);
  const [appliedToast, setAppliedToast] = useState(false);
  const [activeTab, setActiveTab] = useState<'appearance' | 'sounds' | 'reminders' | 'privacy' | 'launcher' | 'howItWorks'>('appearance');

  // Desktop Startup Browser State
  const [browserConfig, setBrowserConfigState] = useState<BrowserConfig>({
    browser: 'auto',
    rememberChoice: true,
  });
  const [browserSavedToast, setBrowserSavedToast] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      getBrowserConfig().then((cfg) => {
        setBrowserConfigState(cfg);
      });
    }
  }, [isOpen]);

  const handleSelectBrowser = async (bId: BrowserId) => {
    const updated = await saveBrowserConfig(bId, browserConfig.rememberChoice);
    setBrowserConfigState(updated.config);
    setBrowserSavedToast(true);
    setTimeout(() => setBrowserSavedToast(false), 3500);
  };

  const handleApplyTheme = () => {
    setPrefs({ theme: prefs.theme, fontSize: prefs.fontSize });
    setAppliedToast(true);
    setTimeout(() => setAppliedToast(false), 3000);
  };

  if (!isOpen) return null;

  const currentTheme = CHAT_THEMES[prefs.theme];
  const fontSizeInfo = getChatFontSizeClasses(prefs.fontSize);

  const handleClearAllHistory = async () => {
    try {
      await db.clearAllDirectMessages();
      setShowClearConfirm(false);
      setClearedMsg(true);
      onHistoryCleared?.();
      setTimeout(() => setClearedMsg(false), 3000);
    } catch (e) {
      console.warn('Error clearing history:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
      <div className="w-full max-w-2xl rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333348] p-4 sm:p-6 shadow-2xl space-y-5 relative my-4 sm:my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2B2B38]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">💬⚙️</span>
            <div>
              <h3 className="text-base font-bold text-white">
                {lang === 'bg' ? 'Настройки на чата' : 'Chat Settings'}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {lang === 'bg' ? 'Цветови теми, звуци, напомняния и размер на шрифта' : 'Color themes, sound signals, reminders & typography'}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-chat-settings-top"
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#222230] hover:bg-[#323244] text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer border border-[#333348]"
            title={lang === 'bg' ? 'Затвори' : 'Close'}
            aria-label="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Live Visualizer / Preview Card */}
        <div className="p-3.5 rounded-[var(--radius-sm)] border border-[#35354A] space-y-2.5 shadow-inner" style={{ backgroundColor: currentTheme.previewBg }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
              <span>👁️</span>
              <span>{lang === 'bg' ? 'Интерактивен предварителен преглед' : 'Live Interactive Preview'}</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-white/90 border border-white/10">
              {currentTheme[lang === 'bg' ? 'nameBg' : 'nameEn']} • {fontSizeInfo.label}
            </span>
          </div>

          <div className="space-y-2.5 py-1">
            {/* Incoming message bubble */}
            <div className="flex items-end gap-2 max-w-[85%]">
              <div className="w-6 h-6 rounded-full bg-[#35354A] flex items-center justify-center text-xs shrink-0 border border-white/20">
                👩
              </div>
              <div className={`p-2.5 rounded-2xl rounded-bl-xs ${currentTheme.receivedBubbleClass}`}>
                <p className={fontSizeInfo.messageText}>
                  {lang === 'bg' ? 'Здравей! Ще се радвам да се запознаем по-късно довечера? ✨' : 'Hey! Would love to connect and chat later tonight? ✨'}
                </p>
                <div className="text-[10px] text-white/50 text-right mt-1 font-mono">19:42</div>
              </div>
            </div>

            {/* Outgoing sent bubble */}
            <div className="flex items-end justify-end gap-2 max-w-[85%] ml-auto">
              <div className={`p-2.5 rounded-2xl rounded-br-xs ${currentTheme.sentBubbleClass}`}>
                <p className={fontSizeInfo.messageText}>
                  {lang === 'bg' ? 'Разбира се, пиши ми тук! Всичко е надеждно криптирано 💋' : 'Sure, message me here! Everything is end-to-end encrypted 💋'}
                </p>
                <div className="text-[10px] text-white/70 text-right mt-1 font-mono flex items-center justify-end gap-1">
                  <span>19:43</span>
                  <span>✓✓</span>
                </div>
              </div>
            </div>

            {/* Mock incoming voice message bubble */}
            <div className="flex items-end gap-2 max-w-[80%]">
              <div className="w-6 h-6 rounded-full bg-[#35354A] flex items-center justify-center text-xs shrink-0 border border-white/20">
                👩
              </div>
              <div className={`p-2.5 rounded-2xl rounded-bl-xs flex items-center gap-2.5 ${currentTheme.receivedBubbleClass}`}>
                <button
                  type="button"
                  onClick={playVoiceMessageSound}
                  className="w-7 h-7 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs shadow cursor-pointer hover:scale-105 transition-transform"
                  title="Тествай гласово съобщение"
                >
                  ▶
                </button>
                <div className="flex-1 min-w-[120px]">
                  <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--primary)] w-2/5 rounded-full" />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/60 font-mono mt-1">
                    <span>{lang === 'bg' ? 'Гласово съобщение' : 'Voice note'}</span>
                    <span>0:14</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs inside Settings */}
        <div className="flex border-b border-[#2C2C3D] gap-2 overflow-x-auto no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`pb-2 px-2.5 font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'appearance'
                ? 'border-[var(--primary)] text-white'
                : 'border-transparent text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <span>🎨</span>
            <span>{lang === 'bg' ? 'Цветове и шрифт' : 'Theme & Font'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sounds')}
            className={`pb-2 px-2.5 font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'sounds'
                ? 'border-[var(--primary)] text-white'
                : 'border-transparent text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <span>🔊</span>
            <span>{lang === 'bg' ? 'Звукови сигнали' : 'Sound Signals'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reminders')}
            className={`pb-2 px-2.5 font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 whitespace-nowrap relative ${
              activeTab === 'reminders'
                ? 'border-[var(--primary)] text-white'
                : 'border-transparent text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <span>🔔</span>
            <span>{lang === 'bg' ? 'Напомняния и статус' : 'Reminders'}</span>
            {(unreadCount > 0 || pendingRequestsCount > 0 || unacceptedInvitesCount > 0) && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`pb-2 px-2.5 font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'border-[var(--primary)] text-white'
                : 'border-transparent text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <span>🔒</span>
            <span>{lang === 'bg' ? 'Сигурност и чистене' : 'Privacy & Reset'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('launcher')}
            className={`pb-2 px-2.5 font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'launcher'
                ? 'border-[var(--primary)] text-white'
                : 'border-transparent text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <span>🖥️</span>
            <span>{lang === 'bg' ? 'Стартиране и Браузър' : 'Launch & Browser'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('howItWorks')}
            className={`pb-2 px-2.5 font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'howItWorks'
                ? 'border-[var(--primary)] text-white'
                : 'border-transparent text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <span>💡</span>
            <span>{lang === 'bg' ? 'Как работи?' : 'How It Works?'}</span>
          </button>
        </div>

        {/* ── TAB 1: APPEARANCE (Themes + Font Size) ── */}
        {activeTab === 'appearance' && (
          <div className="space-y-4 text-xs">
            {/* 1. Theme Selection */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-white uppercase tracking-wider">
                {lang === 'bg' ? '1. Избери цветова тема за чата (5 варианта):' : '1. Select Chat Color Scheme (5 Variants):'}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {(Object.keys(CHAT_THEMES) as ChatThemeId[]).map((themeKey) => {
                  const tInfo = CHAT_THEMES[themeKey];
                  const isSelected = prefs.theme === themeKey;
                  return (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => setPrefs({ theme: themeKey })}
                      className={`p-3 rounded-[var(--radius-sm)] border text-left transition-all cursor-pointer relative flex flex-col justify-between h-24 ${
                        isSelected
                          ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/50 scale-[1.01]'
                          : 'border-[#333348] hover:border-white/50'
                      }`}
                      style={{ backgroundColor: tInfo.previewBg }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">
                          {lang === 'bg' ? tInfo.nameBg : tInfo.nameEn}
                        </span>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-[var(--primary)] text-white text-[10px] flex items-center justify-center font-bold">
                            ✓
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className={`h-4 w-12 rounded-full bg-gradient-to-r ${tInfo.previewSentGradient}`} />
                        <div className="h-4 w-6 rounded-full bg-white/15" />
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-white/20 ml-auto"
                          style={{ backgroundColor: tInfo.accentColor }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Explicit Apply Theme Button */}
              <div className="flex items-center justify-between p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2D2D3E] mt-2">
                <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                  <span>🎨</span>
                  <span>
                    {lang === 'bg'
                      ? `Текущо избрана: ${currentTheme.nameBg}`
                      : `Selected: ${currentTheme.nameEn}`}
                  </span>
                </span>
                <button
                  type="button"
                  id="btn-apply-theme-tab"
                  onClick={handleApplyTheme}
                  className="px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>✓</span>
                  <span>{lang === 'bg' ? 'Приложи цветовата схема' : 'Apply Color Scheme'}</span>
                </button>
              </div>
            </div>

            {/* 2. Font Size Selection (12, 13, 14, 15, 16, 17, 18) */}
            <div className="space-y-2.5 pt-3 border-t border-[#2B2B38]">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-white uppercase tracking-wider">
                  {lang === 'bg' ? '2. Размер на шрифта (12, 13, 14, 15, 16, 17, 18):' : '2. Chat Font Size (12, 13, 14, 15, 16, 17, 18):'}
                </label>
                <span className="text-xs font-mono font-bold text-[var(--primary-hover)] px-2 py-0.5 rounded bg-[var(--primary)]/15 border border-[var(--primary)]/30">
                  {fontSizeInfo.label}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {(['12', '13', '14', '15', '16', '17', '18'] as const).map((sz) => {
                  const isSelected =
                    String(prefs.fontSize) === sz ||
                    (sz === '12' && prefs.fontSize === 'small') ||
                    (sz === '14' && prefs.fontSize === 'medium') ||
                    (sz === '16' && prefs.fontSize === 'large') ||
                    (sz === '18' && prefs.fontSize === 'xlarge');
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setPrefs({ fontSize: sz })}
                      className={`py-2 px-1 rounded-[var(--radius-sm)] border text-center font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-md ring-1 ring-white/30 scale-105'
                          : 'bg-[var(--bg-main)] text-white/80 border-[#333348] hover:border-white/40 hover:text-white'
                      }`}
                    >
                      <span className="block text-xs sm:text-sm font-mono">{sz}</span>
                      <span className="text-[9px] text-white/60 block -mt-0.5">px</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: SOUND SIGNALS ── */}
        {activeTab === 'sounds' && (
          <div className="space-y-3 text-xs">
            {/* Text message sound toggle */}
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] flex items-center justify-between gap-3">
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">💬</span>
                  <span className="font-bold text-white block">
                    {lang === 'bg' ? 'Получаване на текстово съобщение' : 'Incoming Text Message Signal'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {lang === 'bg' ? 'Ясен, чист двутонов звуков сигнал' : 'Crisp modern two-tone chime upon new direct or room text'}
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={playTextMessageSound}
                  className="px-2 py-1 rounded bg-[#2D2D40] hover:bg-[#3D3D54] text-white text-[11px] font-semibold border border-[#3E3E52] transition-colors cursor-pointer flex items-center gap-1"
                  title="Тествай звука"
                >
                  <span>🔊</span>
                  <span>{lang === 'bg' ? 'Тест' : 'Test'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPrefs(prev => ({
                      ...prev,
                      sounds: { ...prev.sounds, textMessageSound: !prev.sounds.textMessageSound }
                    }))
                  }
                  className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                    prefs.sounds.textMessageSound ? 'bg-[var(--primary)]' : 'bg-[#333345]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      prefs.sounds.textMessageSound ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Join request sound toggle */}
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] flex items-center justify-between gap-3">
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">🤝</span>
                  <span className="font-bold text-white block">
                    {lang === 'bg' ? 'Молба за присъединяване към стая/група' : 'Room Join Request Notification'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {lang === 'bg' ? 'Троен възходящ фанфарен сигнал при нова заявка' : 'Tri-tone fanfare chime when someone asks to join your room'}
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={playJoinRequestSound}
                  className="px-2 py-1 rounded bg-[#2D2D40] hover:bg-[#3D3D54] text-white text-[11px] font-semibold border border-[#3E3E52] transition-colors cursor-pointer flex items-center gap-1"
                  title="Тествай звука"
                >
                  <span>🔊</span>
                  <span>{lang === 'bg' ? 'Тест' : 'Test'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPrefs(prev => ({
                      ...prev,
                      sounds: { ...prev.sounds, joinRequestSound: !prev.sounds.joinRequestSound }
                    }))
                  }
                  className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                    prefs.sounds.joinRequestSound ? 'bg-[var(--primary)]' : 'bg-[#333345]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      prefs.sounds.joinRequestSound ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Voice message sound toggle (distinct signal) */}
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] flex items-center justify-between gap-3">
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎙️</span>
                  <span className="font-bold text-white block">
                    {lang === 'bg' ? 'Получаване на гласово съобщение' : 'Incoming Voice Message Tone'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {lang === 'bg' ? 'Специален мек каплевиден тон, различен от текстовия' : 'Soft fluid harmonic chime distinct from text messages'}
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={playVoiceMessageSound}
                  className="px-2 py-1 rounded bg-[#2D2D40] hover:bg-[#3D3D54] text-white text-[11px] font-semibold border border-[#3E3E52] transition-colors cursor-pointer flex items-center gap-1"
                  title="Тествай звука"
                >
                  <span>🔊</span>
                  <span>{lang === 'bg' ? 'Тест' : 'Test'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPrefs(prev => ({
                      ...prev,
                      sounds: { ...prev.sounds, voiceMessageSound: !prev.sounds.voiceMessageSound }
                    }))
                  }
                  className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                    prefs.sounds.voiceMessageSound ? 'bg-[var(--primary)]' : 'bg-[#333345]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      prefs.sounds.voiceMessageSound ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: REMINDERS & SIGNALING SYSTEM ── */}
        {activeTab === 'reminders' && (
          <div className="space-y-3.5 text-xs">
            {/* Live Status Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2F2F44] space-y-1">
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                  {lang === 'bg' ? 'Непрочетени DMs' : 'Unread DMs'}
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-extrabold text-white">{unreadCount}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${unreadCount > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                </div>
              </div>

              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2F2F44] space-y-1">
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                  {lang === 'bg' ? 'Покани за стаи' : 'Room Invites'}
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-extrabold text-white">{unacceptedInvitesCount}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${unacceptedInvitesCount > 0 ? 'bg-[var(--primary)] animate-pulse' : 'bg-emerald-400'}`} />
                </div>
              </div>

              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2F2F44] space-y-1">
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                  {lang === 'bg' ? 'Чакащи молби за вас' : 'Pending Requests'}
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-extrabold text-white">{pendingRequestsCount}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${pendingRequestsCount > 0 ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
                </div>
              </div>
            </div>

            {/* Reminder System Toggle */}
            <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔔</span>
                    <span className="font-bold text-white block">
                      {lang === 'bg' ? 'Периодично звуково напомняне за непрочетени' : 'Periodic Reminder System'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {lang === 'bg'
                      ? 'Издава деликатен звуков сигнал и визуално напомняне, ако имате непрочетени чатове или чакащи молби'
                      : 'Plays a subtle chime if you have pending messages, room invites or join requests'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPrefs(prev => ({
                      ...prev,
                      sounds: { ...prev.sounds, reminderEnabled: !prev.sounds.reminderEnabled }
                    }))
                  }
                  className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer shrink-0 ${
                    prefs.sounds.reminderEnabled ? 'bg-[var(--primary)]' : 'bg-[#333345]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      prefs.sounds.reminderEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Interval Selection */}
              <div className="pt-2 border-t border-[#262635] flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-white/80 font-medium">
                  {lang === 'bg' ? 'Интервал на напомняне:' : 'Reminder Interval:'}
                </span>

                <div className="flex items-center gap-1.5">
                  {[1, 3, 5, 10].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() =>
                        setPrefs(prev => ({
                          ...prev,
                          sounds: { ...prev.sounds, reminderIntervalMinutes: mins }
                        }))
                      }
                      className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                        prefs.sounds.reminderIntervalMinutes === mins
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-[#252535] text-[var(--text-muted)] border-[#36364A] hover:text-white'
                      }`}
                    >
                      {mins} {lang === 'bg' ? 'мин' : 'min'}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={playReminderAlertSound}
                    className="px-2.5 py-1 rounded bg-[#2E2E42] text-white border border-[#3E3E54] text-[11px] font-semibold cursor-pointer ml-1"
                    title="Тест"
                  >
                    🔊 {lang === 'bg' ? 'Тест' : 'Test'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: PRIVACY, BLOCKED & RESET ── */}
        {activeTab === 'privacy' && (
          <div className="space-y-3 text-xs">
            {/* NIP-17 Gift Wrap Encryption status */}
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-white block">
                  {lang === 'bg' ? 'NIP-17 Gift Wrap криптиране' : 'NIP-17 Gift Wrap Encryption'}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {lang === 'bg' ? 'Самоличностите на изпращача и получателя са скрити от релетата' : 'Sender and recipient identities concealed from relays'}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                ✓ NIP-17 Активно
              </span>
            </div>

            {/* EXIF Metadata Stripping status */}
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-white block">
                  {lang === 'bg' ? 'EXIF Stripping (Изчистване на локацията)' : 'EXIF Stripping (Location & GPS Cleaner)'}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {lang === 'bg' ? 'Всички снимки се прерисуват през Canvas преди качване' : 'All photos redrawn via Canvas to purge GPS & device metadata'}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ✓ 100% Защитено
              </span>
            </div>

            {/* Blocked Users */}
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-white block">
                  {lang === 'bg' ? 'Блокирани абонати' : 'Blocked Users'}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {blockedCount} {lang === 'bg' ? 'блокирани профила' : 'blocked contacts'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBlockedUsers();
                }}
                className="px-3 py-1.5 rounded bg-[#2B2B3E] hover:bg-[#36364D] text-white border border-[#3E3E52] transition-colors cursor-pointer text-xs font-semibold"
              >
                {lang === 'bg' ? 'Преглед' : 'Manage'}
              </button>
            </div>

            {/* Clear History */}
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-rose-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-bold text-rose-300 block">
                    {lang === 'bg' ? 'Изчистване на локалната чат история' : 'Clear Local Chat History'}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {lang === 'bg' ? 'Изтрива съхранените чатове от това устройство' : 'Deletes locally stored messages from this device'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {lang === 'bg' ? 'Изчисти' : 'Clear'}
                </button>
              </div>

              {showClearConfirm && (
                <div className="pt-2 border-t border-rose-500/20 space-y-2">
                  <p className="text-[11px] text-rose-200">
                    {lang === 'bg'
                      ? 'Сигурни ли сте? Всички съобщения от локалната памет ще бъдат изтрити.'
                      : 'Are you sure? All local messages will be removed from your device.'}
                  </p>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-1.5 rounded bg-[#2B2B38] text-white font-medium"
                    >
                      {t.CANCEL_ACTION}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllHistory}
                      className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white font-bold"
                    >
                      {lang === 'bg' ? 'Да, изчисти' : 'Yes, Clear'}
                    </button>
                  </div>
                </div>
              )}

              {clearedMsg && (
                <div className="p-2 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold">
                  ✓ {lang === 'bg' ? 'Историята беше успешно изчистена!' : 'History cleared successfully!'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 5: LAUNCHER & STARTUP BROWSER (Desktop & PC) ── */}
        {activeTab === 'launcher' && (
          <div className="space-y-4 text-xs">
            {/* Explanatory Header */}
            <div className="p-3.5 rounded-[var(--radius-sm)] bg-[#191924] border border-[#2F2F44] space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🖥️</span>
                <div>
                  <h4 className="font-bold text-white text-sm">
                    {lang === 'bg' ? 'Избор на браузър за стартиране (FS_Chat Desktop)' : 'Startup Browser Selection (FS_Chat Desktop)'}
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {lang === 'bg'
                      ? 'Ако на компютъра ви има инсталирани няколко браузъра (Chrome, Edge, Brave, Firefox, Opera), изберете кой да отваря FS_Chat.'
                      : 'Choose which browser launches FS_Chat on your desktop computer, or choose to be prompted every time.'}
                  </p>
                </div>
              </div>

              {/* Status Note */}
              <div className="flex items-center gap-2 p-2 rounded bg-indigo-950/40 border border-indigo-700/30 text-[11px] text-indigo-200">
                <span>💡</span>
                <span>
                  {lang === 'bg'
                    ? 'Промяната се записва във файла browser_config.json и ще се приложи автоматично при следващото стартиране на FS_Chat.exe.'
                    : 'Changes persist in browser_config.json and will automatically apply on the next launch of FS_Chat.exe.'}
                </span>
              </div>
            </div>

            {/* Saved Toast Notification */}
            {browserSavedToast && (
              <div className="p-2.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-2 animate-in fade-in">
                <span>✓</span>
                <span>
                  {lang === 'bg'
                    ? 'Настройката за стартиращ браузър е запазена успешно! Ще влезе в сила при следващото пускане на FS_Chat.'
                    : 'Startup browser preference saved! It will apply on your next FS_Chat launch.'}
                </span>
              </div>
            )}

            {/* Browser Options List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-1">
                <span>{lang === 'bg' ? 'Налични опции за стартиране' : 'Startup Options'}</span>
                <span className="text-indigo-400 font-mono">
                  {lang === 'bg' ? 'Текущ избор:' : 'Current:'} {browserConfig.browser}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {AVAILABLE_BROWSERS.map((b) => {
                  const isSelected = browserConfig.browser === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBrowser(b.id)}
                      className={`p-3 rounded-[var(--radius-sm)] border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--primary)]/15 border-[var(--primary)] shadow-[0_0_12px_rgba(157,78,221,0.25)]'
                          : 'bg-[var(--bg-main)] border-[#2D2D3E] hover:border-[#44445E]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{b.icon}</span>
                          <div>
                            <div className="font-bold text-white text-xs flex items-center gap-1.5">
                              <span>{b.name}</span>
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono">
                              {b.vendor}
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 shrink-0">
                            ✓ {lang === 'bg' ? 'Избран' : 'Active'}
                          </span>
                        ) : b.badge ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white/70 bg-white/10 shrink-0">
                            {b.badge}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                        {b.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direct Download Links for Desktop */}
            <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2D2D40] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <span>📥</span>
                  <span>{lang === 'bg' ? 'Сваляне за Компютър (Без нужда от инсталация или Node.js)' : 'Download for Computer (No Node.js needed)'}</span>
                </span>
                <span className="text-[10px] text-[var(--status-online)] font-mono font-bold">
                  {lang === 'bg' ? '✓ Преносимо (Portable)' : '✓ Portable App'}
                </span>
              </div>

              {/* Prominent Windows .EXE Card */}
              <div className="p-3 rounded-[var(--radius-sm)] bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-[var(--primary)]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-start gap-3">
                  <span className="text-3xl p-1.5 rounded-lg bg-[var(--primary)]/20 text-white">🪟</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-bold text-white text-sm">FS_Chat.exe</h5>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                        {lang === 'bg' ? 'ПРЕПОРЪЧИТЕЛНО ЗА WINDOWS' : 'RECOMMENDED FOR WINDOWS'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {lang === 'bg'
                        ? 'Единствен .exe файл. Просто го сваляте, щраквате два пъти и чатът се отваря в отделен прозорец.'
                        : 'Single .exe file. Download, double-click, and chat opens in its own window.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <a
                    href="/downloads/FS_Chat.exe"
                    download="FS_Chat.exe"
                    className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow cursor-pointer active:scale-95"
                    title="Свали директно FS_Chat.exe"
                  >
                    <span>⬇️</span>
                    <span>{lang === 'bg' ? 'Свали FS_Chat.exe' : 'Download FS_Chat.exe'}</span>
                  </a>

                  <a
                    href="/downloads/FS_Chat-Windows.zip"
                    download="FS_Chat-Windows.zip"
                    className="px-3 py-2 rounded-[var(--radius-sm)] bg-[#252538] hover:bg-[#32324A] text-white border border-[#3A3A54] text-xs font-semibold transition-colors flex items-center gap-1 shadow cursor-pointer"
                    title="Свали ZIP архив с FS_Chat.exe и упътване"
                  >
                    <span>📦</span>
                    <span>.ZIP</span>
                  </a>
                </div>
              </div>

              {/* Other Desktop OS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <a
                  href="/downloads/FS_Chat-Mac.zip"
                  download="FS_Chat-Mac.zip"
                  className="p-2.5 rounded bg-[#20202E] hover:bg-[#2C2C40] border border-[#3A3A52] hover:border-[var(--primary)] text-white transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🍎</span>
                    <div className="text-left">
                      <div className="font-bold text-xs">macOS (Apple Mac)</div>
                      <div className="text-[10px] text-[var(--text-muted)]">FS_Chat.command</div>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--primary)] font-bold">Свали ↓</span>
                </a>

                <a
                  href="/downloads/FS_Chat-Linux.tar.gz"
                  download="FS_Chat-Linux.tar.gz"
                  className="p-2.5 rounded bg-[#20202E] hover:bg-[#2C2C40] border border-[#3A3A52] hover:border-[var(--primary)] text-white transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🐧</span>
                    <div className="text-left">
                      <div className="font-bold text-xs">Linux</div>
                      <div className="text-[10px] text-[var(--text-muted)]">FS_Chat.sh</div>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--primary)] font-bold">Свали ↓</span>
                </a>
              </div>
            </div>

            {/* Smartphone Setup & Usage Card */}
            <div className="p-3.5 rounded-[var(--radius-sm)] bg-[#1A1A26] border border-[#2F2F45] space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📱</span>
                <div>
                  <h4 className="font-bold text-white text-sm">
                    {lang === 'bg' ? 'Как се стартира и работи на Смартфон (Android и iPhone)?' : 'How to launch & use on Smartphone (Android & iPhone)?'}
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {lang === 'bg'
                      ? 'На телефон няма нужда да сваляте сложни файлове — приложението се инсталира с 1 докосване като PWA!'
                      : 'No binary downloads needed on mobile — install instantly in 1 tap as a Progressive Web App!'}
                  </p>
                </div>
              </div>

              {/* QR Code Quick Connect - No Typing Needed */}
              <div className="p-3 rounded bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-[#1F1F30] border border-indigo-500/30 flex flex-col sm:flex-row items-center gap-4">
                <div className="bg-[#181824] p-2 rounded-lg border border-indigo-500/40 shrink-0 shadow-lg text-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}&color=255-255-255&bgcolor=24-24-36`}
                    alt="FS_Chat QR Code"
                    className="w-32 h-32 rounded"
                    loading="lazy"
                  />
                  <span className="text-[10px] text-indigo-300 font-mono block mt-1">
                    {lang === 'bg' ? 'Сканирай с камера' : 'Scan with camera'}
                  </span>
                </div>

                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📷</span>
                    <h5 className="font-bold text-white text-xs">
                      {lang === 'bg' ? 'Най-бързият начин за телефон: Сканиране с камера' : 'Fastest for Phone: Scan with Camera'}
                    </h5>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    {lang === 'bg'
                      ? 'Отворете камерата на вашия телефон (Android или iPhone) и я насочете към QR кода вляво. На екрана веднага ще се появи бутон за отваряне — без да въвеждате букви, пароли или линкове!'
                      : 'Open your phone camera (Android or iPhone) and point it at the QR code. A tap prompt will instantly open the chat — no manual typing required!'}
                  </p>
                  <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <span>✓</span>
                    <span>
                      {lang === 'bg' ? 'Работи директно със стандартната камера на всеки смартфон' : 'Works directly with the standard camera app on any smartphone'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Android Card */}
                <div className="p-3 rounded bg-[#212132] border border-[#35354C] space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <span className="text-emerald-400 text-base">🤖</span>
                    <span>Android (Google Chrome / APK)</span>
                  </div>
                  <ol className="text-[11px] text-[var(--text-muted)] space-y-1 list-decimal list-inside leading-relaxed">
                    <li>{lang === 'bg' ? 'Отворете чата или сканирайте QR кода' : 'Open chat or scan QR code'}</li>
                    <li>{lang === 'bg' ? 'Натиснете менюто с 3 точки (⋮) горе вдясно' : 'Tap the 3-dots menu (⋮) top right'}</li>
                    <li>{lang === 'bg' ? 'Изберете "Инсталиране" или "Добави към начален екран"' : 'Choose "Install app" or "Add to Home screen"'}</li>
                    <li>{lang === 'bg' ? 'Иконата на чата се появява на телефона ви и се отваря на цял екран!' : 'The app icon appears on your home screen and launches full screen!'}</li>
                  </ol>
                  <div className="pt-1 border-t border-white/5 text-[10px] text-zinc-400">
                    {lang === 'bg'
                      ? '💡 Алтернатива за Android: Приложението може да се инсталира и като директен .APK файл чрез Bubblewrap/Capacitor без Google Play Store.'
                      : '💡 Android Alternative: Can also be installed as a direct .APK package via Bubblewrap/Capacitor without Google Play Store.'}
                  </div>
                </div>

                {/* iPhone / iPad Card */}
                <div className="p-3 rounded bg-[#212132] border border-[#35354C] space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <span className="text-blue-400 text-base">🍏</span>
                    <span>iPhone / iPad (Apple Safari)</span>
                  </div>
                  <ol className="text-[11px] text-[var(--text-muted)] space-y-1 list-decimal list-inside leading-relaxed">
                    <li>{lang === 'bg' ? 'Сканирайте QR кода с камерата на iPhone' : 'Scan QR code with iPhone camera'}</li>
                    <li>{lang === 'bg' ? 'Натиснете бутона Сподели (квадратче със стрелка ⎋)' : 'Tap the Share button (square with arrow ⎋)'}</li>
                    <li>{lang === 'bg' ? 'Превъртете надолу и изберете "Към началния екран"' : 'Scroll down & select "Add to Home Screen"'}</li>
                    <li>{lang === 'bg' ? 'Потвърдете с "Добави" — работи като самостоятелно iOS приложение!' : 'Confirm "Add" — runs as a fast native iOS app!'}</li>
                  </ol>
                  <div className="pt-1 border-t border-white/5 text-[10px] text-zinc-400">
                    {lang === 'bg'
                      ? '🔒 Apple не разрешава сваляне на външни инсталационни файлове (.ipa) без платен Apple сертификат. Добавянето към началния екран е официалният начин на Apple.'
                      : '🔒 Apple restricts direct .ipa sideloading without developer certificates. Adding to Home Screen is the official Apple method.'}
                  </div>
                </div>
              </div>

              {/* Mobile Voice note */}
              <div className="p-2 rounded bg-indigo-950/40 border border-indigo-700/30 text-[11px] text-indigo-200 flex items-start gap-2">
                <span className="shrink-0 text-sm">🎙️</span>
                <span>
                  {lang === 'bg'
                    ? 'Гласовите съобщения и Push-to-Talk работят перфектно на телефон: просто задръжте пръст върху бутона за запис. Звукът се изпраща криптиран през NOSTR релетата без размяна на реални IP адреси!'
                    : 'Voice messages and Push-to-Talk work seamlessly on mobile: hold finger on the mic button. Audio routes encrypted over NOSTR relays without exposing IP addresses!'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 6: HOW IT WORKS (Full Decentralization Guide) ── */}
        {activeTab === 'howItWorks' && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-[var(--radius-sm)] bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl p-1 bg-amber-500/20 rounded text-amber-300">💡</span>
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      {lang === 'bg' ? 'Как работи децентрализираният чат (FS_Chat)?' : 'How does decentralized FS_Chat work?'}
                    </h4>
                    <span className="text-[10px] font-mono text-amber-300">
                      NOSTR Relays • NIP-17 Gift Wrap • Ephemeral Audio • Local IndexedDB
                    </span>
                  </div>
                </div>

                {onOpenHowItWorks && (
                  <button
                    type="button"
                    onClick={onOpenHowItWorks}
                    className="px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white border border-amber-500/40 font-bold transition-all cursor-pointer"
                  >
                    {lang === 'bg' ? 'Отвори пълното ръководство →' : 'Open full interactive guide →'}
                  </button>
                )}
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded bg-[var(--bg-main)] border border-[#2E2E42] space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold">
                  <span className="text-base">🛡️</span>
                  <span>{lang === 'bg' ? '1. Без централен сървър или база' : '1. Zero Central Servers'}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {lang === 'bg'
                    ? 'Няма централна база данни или корпоративен сървър, който да събира вашите данни, пароли или логове. Цялата комуникация минава през децентрализирани NOSTR релета по света.'
                    : 'No central database or server stores your private logs or credentials. Messages route via independent global Nostr relays.'}
                </p>
              </div>

              <div className="p-3 rounded bg-[var(--bg-main)] border border-[#2E2E42] space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold">
                  <span className="text-base">🔐</span>
                  <span>{lang === 'bg' ? '2. NIP-17 Gift Wrap криптиране' : '2. NIP-17 Gift Wrap Encryption'}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {lang === 'bg'
                    ? 'Личните съобщения се опаковат в трислоен криптиран плик (Kind 1059 / Kind 13 / Kind 14). Дори самите релета виждат само произволен еднократен ключ и нямат представа кой си пише!'
                    : 'Direct messages use 3-layer encrypted envelopes. Relays see only throwaway ephemeral keys and cannot read sender or recipient identities.'}
                </p>
              </div>

              <div className="p-3 rounded bg-[var(--bg-main)] border border-[#2E2E42] space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold">
                  <span className="text-base">🎙️</span>
                  <span>{lang === 'bg' ? '3. Анонимен глас без IP разкриване' : '3. Anonymous Voice (No IP Leak)'}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {lang === 'bg'
                    ? 'НЕ се използва директна P2P WebRTC връзка, за да не се разкрива вашият IP адрес. Аудиото се компресира (Opus 16kbps) и се изпраща през релета с краткотрайни събития (Kind 20000+).'
                    : 'No direct peer-to-peer WebRTC IP leaks. Audio is encrypted with low-bitrate Opus (16kbps) and streams over relays as ephemeral events (Kind 20000+).'}
                </p>
              </div>

              <div className="p-3 rounded bg-[var(--bg-main)] border border-[#2E2E42] space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold">
                  <span className="text-base">💾</span>
                  <span>{lang === 'bg' ? '4. 100% Локално съхранение (IndexedDB)' : '4. 100% Local Device Storage'}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {lang === 'bg'
                    ? 'Вашите профили, ключове и история се съхраняват единствено във вашия браузър/устройство. Можете да правите резервно копие (.json) или да изтриете всичко по всяко време.'
                    : 'Your profiles, keys, and chat history stay exclusively on your local device. Export backups or wipe local storage at any time.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-[#2B2B38] gap-3">
          <div className="min-h-[22px]">
            {appliedToast && (
              <span className="text-emerald-400 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                <span>✓</span>
                <span>{lang === 'bg' ? 'Цветовата схема и настройките са приложени успешно!' : 'Preferences applied successfully!'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              id="btn-apply-chat-settings-footer"
              onClick={handleApplyTheme}
              className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold cursor-pointer transition-all shadow flex items-center gap-1.5 active:scale-95"
            >
              <span>✓</span>
              <span>{lang === 'bg' ? 'Приложи цветовата схема' : 'Apply Color Scheme'}</span>
            </button>

            <button
              type="button"
              id="btn-close-chat-settings-bottom"
              onClick={onClose}
              className="px-5 py-2 rounded-[var(--radius-sm)] bg-[#2B2B38] hover:bg-[#343446] text-white text-xs font-bold cursor-pointer border border-[#3C3C50] transition-colors"
            >
              {t.CLOSE}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
