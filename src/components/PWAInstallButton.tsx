import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { UI_TRANSLATIONS, Language } from '../types';

interface PWAInstallButtonProps {
  lang: Language;
  className?: string;
  variant?: 'button' | 'menu-item' | 'icon-only';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang,
  className = '',
  variant = 'button'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const t = UI_TRANSLATIONS[lang];

  // 1. By default, hidden if already installed as standalone PWA or if neither installable nor iOS
  if (isInstalled || (!isInstallable && !isIOS)) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      // 2. Trigger native browser installation prompt (Android / PC / Chrome / Edge)
      await install();
    } else if (isIOS) {
      // 3. Special iOS Safari flow (since iOS does not support beforeinstallprompt)
      setShowIOSModal(true);
    }
  };

  const label = t.INSTALL_APP || (lang === 'bg' ? 'Инсталирай приложението' : 'Install App');

  return (
    <>
      {variant === 'menu-item' ? (
        <button
          type="button"
          id="btn-install-pwa-menu"
          onClick={handleClick}
          title={label}
          className={`w-full p-3 rounded-[var(--radius-sm)] bg-gradient-to-r from-[var(--primary)]/15 via-[var(--primary)]/10 to-transparent hover:from-[var(--primary)]/25 hover:to-[var(--primary)]/5 border border-[var(--primary)]/40 text-left transition-all flex items-center justify-between cursor-pointer group shadow-sm ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--primary)]/20 text-[var(--primary-hover)] flex items-center justify-center shrink-0 border border-[var(--primary)]/30 text-sm shadow">
              {/* Screen / Download Icon */}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
                <path d="M12 7v5m-2-2 2 2 2-2" />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white group-hover:text-[var(--primary-hover)] transition-colors flex items-center gap-1.5">
                <span>{label}</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[var(--primary)] text-white uppercase tracking-wider">
                  PWA
                </span>
              </h4>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {lang === 'bg'
                  ? 'Бърз достъп, известия и работа офлайн'
                  : 'Fast access, alerts & offline readiness'}
              </p>
            </div>
          </div>
          <span className="text-xs text-[var(--primary-hover)] font-bold">📲</span>
        </button>
      ) : variant === 'icon-only' ? (
        <button
          type="button"
          id="btn-install-pwa-icon"
          onClick={handleClick}
          title={label}
          aria-label={label}
          className={`p-2 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-md transition-colors cursor-pointer flex items-center justify-center ${className}`}
        >
          {/* Download into Screen Icon */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <path d="M12 7v5m-2-2 2 2 2-2" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          id="btn-install-pwa"
          onClick={handleClick}
          title={label}
          aria-label={label}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-md transition-all cursor-pointer select-none active:scale-95 ${className}`}
        >
          {/* Device Screen with Download Arrow Icon */}
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <path d="M12 7v5m-2-2 2 2 2-2" />
          </svg>
          <span className="truncate">{label}</span>
        </button>
      )}

      {/* ──────────────── iOS SAFARI INSTRUCTION MODAL / TOOLTIP ──────────────── */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in select-none">
          <div className="w-full max-w-sm rounded-[var(--radius-md)] bg-[var(--bg-surface)] p-5 border border-[#3A3A4E] shadow-2xl relative space-y-4 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2D2D3E]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--primary)]/20 text-[var(--primary-hover)] flex items-center justify-center font-bold text-sm">
                  📱
                </div>
                <h3 className="text-sm font-bold text-white">
                  {t.INSTALL_IOS_GUIDE}
                </h3>
              </div>
              <button
                type="button"
                id="btn-close-ios-modal-x"
                onClick={() => setShowIOSModal(false)}
                className="text-[var(--text-muted)] hover:text-white text-base p-1 cursor-pointer transition-colors"
                title={t.CLOSE}
                aria-label={t.CLOSE}
              >
                ✕
              </button>
            </div>

            {/* Instruction Body - Exact wording requested by user */}
            <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2F2F40] text-xs leading-relaxed text-white space-y-2">
              <p className="font-semibold text-amber-300 flex items-center gap-1.5">
                <span>💡</span>
                <span>{lang === 'bg' ? 'Инструкция за iPhone / iPad:' : 'Instructions for iPhone / iPad:'}</span>
              </p>
              <p className="text-[var(--text-main)] font-medium">
                {t.IOS_INSTALL_INSTRUCTION || (lang === 'bg'
                  ? "За инсталация: Натиснете бутона 'Сподели' (Share) в браузъра и изберете 'Добавяне към началния екран' (Add to Home Screen)."
                  : "To install: Tap the 'Share' button in your browser and select 'Add to Home Screen'.")}
              </p>
            </div>

            {/* Step-by-step visual helpers */}
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5 p-2 rounded bg-[var(--bg-main)]/60 border border-[#272736]">
                <div className="w-6 h-6 rounded bg-[#2A2A3C] text-white flex items-center justify-center shrink-0 text-xs">
                  {/* Share Icon */}
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  <strong className="text-white">1.</strong> {t.IOS_STEP_1}
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded bg-[var(--bg-main)]/60 border border-[#272736]">
                <div className="w-6 h-6 rounded bg-[#2A2A3C] text-white flex items-center justify-center shrink-0 text-xs">
                  {/* Plus Icon / Add to Home */}
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  <strong className="text-white">2.</strong> {t.IOS_STEP_2}
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              id="btn-close-ios-modal"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow"
            >
              {lang === 'bg' ? 'Разбрах' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
