import React from 'react';
import { Language } from '../types';

interface HowItWorksModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  onOpenKeysModal?: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({
  lang,
  isOpen,
  onClose,
  onOpenKeysModal
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
      <div className="w-full max-w-2xl rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333348] p-4 sm:p-6 shadow-2xl space-y-5 relative my-4 sm:my-8 text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2B2B38]">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{lang === 'bg' ? 'Как работи този чат?' : 'How Does This Chat Work?'}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[var(--primary)]/20 text-[var(--primary-hover)] border border-[var(--primary)]/30">
                  NOSTR P2P
                </span>
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {lang === 'bg'
                  ? 'Кратки и разбираеми разяснения за свободата, сигурността и анонимността'
                  : 'Clear and simple guide to your freedom, cryptography, and privacy'}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-how-it-works"
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

        {/* 5 Clear Educational Cards */}
        <div className="space-y-3.5 text-xs sm:text-sm">
          {/* 1. Какво е NOSTR? */}
          <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] space-y-1.5 hover:border-[var(--primary)]/40 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">🌐</span>
              <h4 className="font-bold text-white text-xs sm:text-sm">
                {lang === 'bg' ? '1. Какво е NOSTR?' : '1. What is NOSTR?'}
              </h4>
              <span className="text-[10px] text-emerald-400 font-mono ml-auto bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {lang === 'bg' ? 'Свободна мрежа' : 'Open Protocol'}
              </span>
            </div>
            <p className="text-[var(--text-muted)] leading-relaxed text-xs">
              {lang === 'bg'
                ? 'Глобална, свободна и децентрализирана мрежа без централна компания, собственик или държавен контрол. Тук никой не може да блокира акаунта ти, да ти наложи цензура или да спре приложението.'
                : 'A global, open and censorship-resistant protocol with no central company or CEO. Nobody can ban your account, censor your profile, or shut down the network.'}
            </p>
          </div>

          {/* 2. Какво са Релетата? */}
          <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] space-y-1.5 hover:border-[var(--primary)]/40 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">📡</span>
              <h4 className="font-bold text-white text-xs sm:text-sm">
                {lang === 'bg' ? '2. Какво са Релетата (Relays)?' : '2. What are Relays?'}
              </h4>
              <span className="text-[10px] text-cyan-400 font-mono ml-auto bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {lang === 'bg' ? 'Доброволци по света' : 'Global Volunteers'}
              </span>
            </div>
            <p className="text-[var(--text-muted)] leading-relaxed text-xs">
              {lang === 'bg'
                ? 'Релетата са сървъри, поддържани от независими доброволци и общности по целия свят. Те не знаят кой си – единствената им задача е да препращат криптираните пакети към твоя събеседник. Ако едно реле падне, чатът автоматично продължава през останалите.'
                : 'Relays are independent servers run by volunteers and enthusiasts worldwide. They simply route encrypted packets without knowing identities. If one relay goes offline, communication automatically flows through others.'}
            </p>
          </div>

          {/* 3. Как работи криптирането и NIP-17 Gift Wrap? */}
          <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] space-y-1.5 hover:border-[var(--primary)]/40 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">🔒</span>
              <h4 className="font-bold text-white text-xs sm:text-sm">
                {lang === 'bg' ? '3. Криптиране и NIP-17 Gift Wrap (Защита на метаданните)' : '3. Encryption & NIP-17 Gift Wrap (Metadata Privacy)'}
              </h4>
              <span className="text-[10px] text-purple-400 font-mono ml-auto bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                {lang === 'bg' ? 'NIP-17 Gift Wrap' : 'NIP-17 Private'}
              </span>
            </div>
            <p className="text-[var(--text-muted)] leading-relaxed text-xs">
              {lang === 'bg'
                ? 'Личните съобщения се криптират по стандарта NIP-17 (Gift Wrap). За разлика от обикновения чат, съобщението се обвива с еднократен случаен ключ (ефемерен ключ) – релетата НЕ знаят кой изпраща съобщението и метаданните са напълно скрити! Единствено получателят може да го разопакова и прочете.'
                : 'Direct messages use the NIP-17 Gift Wrap standard. Messages are wrapped inside throwaway random ephemeral keys so relays cannot identify who is messaging whom. Metadata is completely protected!'}
            </p>
          </div>

          {/* 4. Защита на снимките: EXIF Stripping (Без GPS и данни за телефона) */}
          <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] space-y-1.5 hover:border-[var(--primary)]/40 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">🛡️</span>
              <h4 className="font-bold text-white text-xs sm:text-sm">
                {lang === 'bg' ? '4. Защита на снимките: EXIF Stripping' : '4. Photo Privacy: EXIF Stripping'}
              </h4>
              <span className="text-[10px] text-emerald-400 font-mono ml-auto bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {lang === 'bg' ? 'Без GPS локация' : 'No GPS Tags'}
              </span>
            </div>
            <p className="text-[var(--text-muted)] leading-relaxed text-xs">
              {lang === 'bg'
                ? 'Преди всяко качване на снимка в чата или профила, браузърът автоматично прерисува изображението през HTML Canvas. Това необратимо изчиства всички EXIF метаданни: точни GPS координати на дома ти, модел на телефона, дата и час на заснемане.'
                : 'Before any photo is uploaded, it is automatically redrawn via an in-memory HTML Canvas. This strips all EXIF metadata: exact GPS home coordinates, phone model, and capture timestamps.'}
            </p>
          </div>

          {/* 4. Къде живеят данните? */}
          <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] space-y-1.5 hover:border-[var(--primary)]/40 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">💾</span>
              <h4 className="font-bold text-white text-xs sm:text-sm">
                {lang === 'bg' ? '5. Къде живеят данните?' : '5. Where Does Your Data Live?'}
              </h4>
              <span className="text-[10px] text-amber-400 font-mono ml-auto bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {lang === 'bg' ? 'На твоето устройство' : 'On Your Device'}
              </span>
            </div>
            <p className="text-[var(--text-muted)] leading-relaxed text-xs">
              {lang === 'bg'
                ? 'Базата данни (твоята кореспонденция, снимки и контакти) се съхранява в локалната памет на твоя телефон или компютър (IndexedDB). Релетата служат единствено като временна пощенска кутия за доставка – след като получиш писмото, то си остава само при теб.'
                : 'Your database, message history, contacts, and media live directly on your own device storage (IndexedDB). Relays act merely as temporary post boxes to pass sealed envelopes.'}
            </p>
          </div>

          {/* 6. Анонимен гласов разговор: Voice over Nostr Relays (VoNR) */}
          <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2B2B38] space-y-1.5 hover:border-emerald-500/50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">🎙️</span>
              <h4 className="font-bold text-white text-xs sm:text-sm">
                {lang === 'bg' ? '6. Анонимен глас без размяна на IP адреси (VoNR)' : '6. Anonymous Voice Without IP Trace (VoNR)'}
              </h4>
              <span className="text-[10px] text-emerald-400 font-mono ml-auto bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {lang === 'bg' ? '0% P2P WebRTC' : 'Zero WebRTC'}
              </span>
            </div>
            <p className="text-[var(--text-muted)] leading-relaxed text-xs">
              {lang === 'bg'
                ? 'За разлика от стандартните разговори, тук НЕ се използва директна P2P WebRTC връзка, за да не се разкриват IP адресите на събеседниците. Аудио пакетите се нарязват на кратки 16 kbps Opus фрагменти, криптират се с публичния ключ на получателя и преминават транзитно през Nostr релетата чрез краткотрайни събития (Kind 20042 Ephemeral), които релетата веднага изтриват.'
                : 'Unlike ordinary VoIP, NO direct peer-to-peer WebRTC connection is opened, ensuring neither party reveals their IP address. Audio chunks are encoded with 16 kbps Opus, encrypted with recipient key, and broadcast as transient Ephemeral Nostr events (Kind 20042) that relays drop instantly.'}
            </p>
          </div>

          {/* 5. Tor Browser за 100% анонимност */}
          <div className="p-3.5 rounded-[var(--radius-sm)] bg-amber-950/20 border border-amber-500/40 space-y-2 hover:border-amber-400 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">🧅</span>
              <h4 className="font-bold text-amber-300 text-xs sm:text-sm">
                {lang === 'bg' ? '5. Tor Browser за 100% анонимност' : '5. Tor Browser for 100% Anonymity'}
              </h4>
              <span className="text-[10px] text-amber-300 font-bold ml-auto bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                {lang === 'bg' ? 'Максимална защита' : 'Max Privacy'}
              </span>
            </div>
            <p className="text-amber-100/90 leading-relaxed text-xs">
              {lang === 'bg'
                ? 'Ползването на приложението през Tor Browser скрива напълно твоя истински IP адрес и прави местоположението ти непроследимо.'
                : 'Using this app via Tor Browser completely masks your real IP address and makes your physical location untraceable.'}
            </p>
            <div className="p-2.5 rounded bg-black/40 border border-amber-500/30 text-amber-200 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <span>⚠️</span>
                <span>{lang === 'bg' ? 'Важно правило за Tor:' : 'Crucial Tor Rule:'}</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {lang === 'bg'
                  ? 'Tor изтрива абсолютно всичко от браузъра при всяко затваряне на прозореца. Винаги си запазвай своя частен ключ (nsec...) или бекъп файла на сигурно място, за да можеш да влезеш в профила си следващия път! Малко по-ангажиращо, но напълно сигурно.'
                  : 'Tor purges all session cookies and local storage when closed. Always copy and save your private key (nsec...) or downloaded backup file so you can log back into your profile! Slightly more deliberate, but 100% secure.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-[#2B2B38] gap-3">
          {onOpenKeysModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenKeysModal();
              }}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5 cursor-pointer underline"
            >
              <span>🔑</span>
              <span>{lang === 'bg' ? 'Прегледай своите ключове и бекъп' : 'View your keys & backup file'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all cursor-pointer shadow ml-auto"
          >
            {lang === 'bg' ? 'Разбрах, благодаря!' : 'Got it, thank you!'}
          </button>
        </div>
      </div>
    </div>
  );
};
