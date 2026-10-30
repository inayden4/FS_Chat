import React, { useState, useRef, useEffect } from 'react';
import { UI_TRANSLATIONS, Language, NostrIdentity, RelayInfo } from '../types';
import { createFreshIdentity, parseAndValidateKey, DEFAULT_RELAYS, testRelayConnections } from '../services/nostr';
import * as db from '../services/db';
import { BackupLocationModal } from './BackupLocationModal';
import {
  selectBackupDirectory,
  getBackupInfo,
  isFileSystemAccessSupported,
  executeAutoBackup,
  clearDirectoryHandle
} from '../services/autoBackup';
import { NostrDonationSection } from './NostrDonationSection';

interface SecurityWarningModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  onIdentityEstablished: (identity: NostrIdentity) => void;
  currentIdentity: NostrIdentity | null;
  onLogout?: () => void;
}

export const SecurityWarningModal: React.FC<SecurityWarningModalProps> = ({
  lang,
  isOpen,
  onClose,
  onIdentityEstablished,
  currentIdentity,
  onLogout
}) => {
  const t = UI_TRANSLATIONS[lang];
  const [loginMode, setLoginMode] = useState<'none' | 'inputKey'>('none');
  const [keyInput, setKeyInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showNsec, setShowNsec] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Backup Folder State
  const [backupDirName, setBackupDirName] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(null);
  const [showBackupLocationModal, setShowBackupLocationModal] = useState(false);
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [isExecutingBackup, setIsExecutingBackup] = useState(false);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState(false);
  const isFolderSupported = isFileSystemAccessSupported();

  // Relays State
  const [relays, setRelays] = useState<string[]>(DEFAULT_RELAYS);
  const [relaysStatus, setRelaysStatus] = useState<RelayInfo[]>([]);
  const [newRelayUrl, setNewRelayUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    getBackupInfo().then(info => {
      setBackupDirName(info.dirName);
      setLastBackupTime(info.lastBackupTime);
    });

    testRelayConnections(relays).then(setRelaysStatus);

    const handleBackupSaved = (e: Event) => {
      const customEvent = e as CustomEvent<{ timestamp: number; dirName?: string }>;
      if (customEvent.detail) {
        setLastBackupTime(customEvent.detail.timestamp);
        if (customEvent.detail.dirName !== undefined) {
          setBackupDirName(customEvent.detail.dirName);
        }
      }
    };

    window.addEventListener('nostr-backup-saved', handleBackupSaved);
    return () => window.removeEventListener('nostr-backup-saved', handleBackupSaved);
  }, [isOpen, relays]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, type: 'npub' | 'nsec') => {
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadKeyFile = () => {
    if (!currentIdentity) return;
    const content = `NOSTR PRIVATE CREDENTIALS\nGenerated: ${new Date().toISOString()}\nPublic Key (npub): ${currentIdentity.npub}\nPublic Key (hex): ${currentIdentity.pubKeyHex}\nPrivate Key (nsec): ${currentIdentity.nsec}\n\nKEEP THIS FILE SECURE AND PRIVATE!`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nostr-identity-${currentIdentity.npub.slice(-6)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBackup = async () => {
    const fullBackup = await db.exportFullBackup();
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nostr-dating-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTriggerImmediateBackup = async () => {
    setIsExecutingBackup(true);
    try {
      const res = await executeAutoBackup(true);
      if (res.success) {
        setLastBackupTime(res.timestamp);
        setBackupSuccessMsg(true);
        setTimeout(() => setBackupSuccessMsg(false), 4000);
      }
    } finally {
      setIsExecutingBackup(false);
    }
  };

  const handleDisconnectBackupFolder = async () => {
    await clearDirectoryHandle();
    setBackupDirName(null);
  };

  const handleAddRelay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelayUrl.trim().startsWith('wss://')) return;
    if (!relays.includes(newRelayUrl.trim())) {
      const updated = [...relays, newRelayUrl.trim()];
      setRelays(updated);
      setNewRelayUrl('');
      testRelayConnections(updated).then(setRelaysStatus);
    }
  };

  const handleQuickStart = async () => {
    try {
      const freshIdentity = createFreshIdentity();
      await db.saveIdentity(freshIdentity);

      const basicProfile = {
        pubkey: freshIdentity.pubKeyHex,
        name: `Anon_${freshIdentity.npub.slice(-4)}`,
        age: 25,
        location: 'София / Sofia',
        updatedAt: Date.now()
      };
      await db.saveMyProfile(basicProfile);
      await executeAutoBackup(true);

      onIdentityEstablished(freshIdentity);
      onClose();
    } catch (e) {
      setErrorMessage((e as Error).message);
    }
  };

  const handleLoginWithKey = async () => {
    if (!keyInput.trim()) {
      setLoginMode('inputKey');
      return;
    }

    try {
      setErrorMessage('');
      const identity = parseAndValidateKey(keyInput);
      await db.saveIdentity(identity);
      onIdentityEstablished(identity);
      onClose();
    } catch {
      setErrorMessage(t.INVALID_NSEC);
    }
  };

  const handleKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const matchNsec = text.match(/nsec1[0-9a-z]{58}/);
        const matchHex = text.match(/[0-9a-fA-F]{64}/);
        const candidate = matchNsec ? matchNsec[0] : (matchHex ? matchHex[0] : text.trim());
        
        const identity = parseAndValidateKey(candidate);
        await db.saveIdentity(identity);
        onIdentityEstablished(identity);
        onClose();
      } catch {
        setErrorMessage(t.INVALID_NSEC);
      }
    };
    reader.readAsText(file);
  };

  const handleBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const success = await db.importFullBackup(parsed);
        if (success && parsed.identity) {
          onIdentityEstablished(parsed.identity);
          onClose();
        } else {
          setErrorMessage('Invalid backup.json file');
        }
      } catch {
        setErrorMessage('Could not parse backup.json');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
      <div className="w-full max-w-2xl rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333345] shadow-2xl p-4 sm:p-6 relative my-4 sm:my-8 space-y-6">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3D]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔑</span>
            <h2 className="text-base font-bold text-white">
              {lang === 'bg' ? 'Ключове, папки и бекъпи' : 'Keys, Folders & Backups'}
            </h2>
          </div>
          {onClose && (
            <button
              type="button"
              id="btn-close-security-modal"
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
          )}
        </div>

        {/* 1. Critical Security Warning Card */}
        <div className="rounded-[var(--radius-sm)] border border-[var(--status-danger)]/50 bg-[var(--status-danger)]/10 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-[var(--status-danger)]/20 text-[var(--status-danger)] shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--status-danger)]">
                {t.SECURITY_WARNING_TITLE}
              </h3>
              <p className="mt-1 text-xs text-white/90 leading-relaxed font-medium">
                {t.SECURITY_WARNING_TEXT}
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--status-danger)]/20 border border-[var(--status-danger)] text-xs text-white font-medium">
            {errorMessage}
          </div>
        )}

        {/* 2. Cryptographic Keys Management (when identity is present) */}
        {currentIdentity && (
          <div className="rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2D2D3E] p-4 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="m21 2-9.6 9.6" />
                <path d="m15.5 7.5 3 3L22 7l-3-3" />
              </svg>
              <span>{t.KEYS_MANAGEMENT}</span>
            </h3>

            {/* Public Key */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)] font-semibold">{t.PUBLIC_KEY}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(currentIdentity.npub, 'npub')}
                  className="text-[var(--primary-hover)] hover:underline font-mono cursor-pointer"
                >
                  {copiedKey === 'npub' ? t.COPIED : t.COPY_KEY}
                </button>
              </div>
              <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#333345] text-xs font-mono text-white/90 break-all select-all">
                {currentIdentity.npub}
              </div>
            </div>

            {/* Private Key */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--status-danger)] font-semibold">{t.PRIVATE_KEY}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNsec(!showNsec)}
                    className="text-xs text-[var(--text-muted)] hover:text-white cursor-pointer"
                  >
                    {showNsec ? 'Скрий' : 'Покажи'}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentIdentity.nsec, 'nsec')}
                    className="text-[var(--primary-hover)] hover:underline font-mono cursor-pointer"
                  >
                    {copiedKey === 'nsec' ? t.COPIED : t.COPY_KEY}
                  </button>
                </div>
              </div>
              <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#333345] text-xs font-mono text-[var(--status-danger)] break-all select-all">
                {showNsec ? currentIdentity.nsec : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
              </div>
            </div>

            {/* Key File Actions */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadKeyFile}
                title={t.DOWNLOAD_KEY}
                className="px-3.5 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] hover:bg-[#343448] border border-[#3A3A4E] text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>💾</span>
                <span>{t.DOWNLOAD_KEY}</span>
              </button>

              <button
                type="button"
                onClick={handleExportBackup}
                title={t.EXPORT_BACKUP}
                className="px-3.5 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] hover:bg-[#343448] border border-[#3A3A4E] text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>📦</span>
                <span>{t.EXPORT_BACKUP}</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Automatic Local Backup Card */}
        <div className="rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2D2D3E] p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <span>📂</span>
                <span>{t.AUTO_BACKUP_TITLE}</span>
              </h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 max-w-xl">
                {t.AUTO_BACKUP_DESC}
              </p>
            </div>
            <span
              className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              title="Автоматичният бекъп се изпълнява на момента при всяка промяна"
            >
              {t.AUTO_BACKUP_ACTIVE}
            </span>
          </div>

          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#333345] space-y-2">
            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
              <span className="text-[var(--text-muted)]">{t.BACKUP_FOLDER_LABEL}:</span>
              <span className="font-mono text-white font-semibold">
                {backupDirName ? `📁 ${backupDirName}` : t.NO_FOLDER_SELECTED}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
              <span className="text-[var(--text-muted)]">{t.LAST_AUTO_BACKUP}:</span>
              <span className="font-mono text-emerald-400">
                {lastBackupTime ? new Date(lastBackupTime).toLocaleTimeString() : 'На момента (Live)'}
              </span>
            </div>
          </div>

          {backupSuccessMsg && (
            <div className="p-2.5 rounded-[var(--radius-sm)] bg-emerald-500/20 border border-emerald-500/50 text-xs text-emerald-300 font-medium">
              ✓ {t.BACKUP_SAVED_SUCCESS}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              id="btn-settings-select-folder"
              onClick={() => setShowBackupLocationModal(true)}
              className="px-3.5 py-2 rounded-[var(--radius-sm)] bg-[#2B2B3E] hover:bg-[#36364D] border border-[#3E3E54] text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow"
              title={backupDirName ? `${t.CHANGE_BACKUP_FOLDER}: ${backupDirName}` : t.SELECT_BACKUP_FOLDER}
            >
              <span>📂</span>
              <span>{backupDirName ? t.CHANGE_BACKUP_FOLDER : t.SELECT_BACKUP_FOLDER}</span>
            </button>

            <button
              type="button"
              id="btn-backup-now"
              onClick={handleTriggerImmediateBackup}
              disabled={isExecutingBackup}
              className="px-3.5 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-xs font-bold text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>💾</span>
              <span>{isExecutingBackup ? 'Запис...' : t.BACKUP_NOW}</span>
            </button>

            {backupDirName && (
              <button
                type="button"
                id="btn-disconnect-folder"
                onClick={handleDisconnectBackupFolder}
                className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-rose-900/30 border border-[#3E3E54] hover:border-rose-700/50 text-xs font-semibold text-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>✖</span>
                <span>{t.DISCONNECT_BACKUP_FOLDER}</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. Switch or Login with Another Key */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-white uppercase tracking-wider">
            {lang === 'bg' ? 'Вход, смяна или импорт на ключ' : 'Login, Switch or Import Key'}
          </div>

          {/* Key Input Section */}
          {loginMode === 'inputKey' && (
            <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#3A3A4E] space-y-3">
              <label className="block text-xs font-semibold text-white">
                {t.BTN_LOGIN_KEY} (nsec1... / Hex)
              </label>
              <input
                id="input-key-nsec"
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="nsec1..."
                className="w-full px-3 py-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#3A3A4E] text-white text-xs font-mono focus:border-[var(--primary)] focus:outline-none transition-colors"
              />
              <button
                id="btn-submit-key"
                onClick={handleLoginWithKey}
                className="w-full py-2.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
              >
                {t.BTN_LOGIN_KEY}
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              id="btn-quick-start"
              onClick={handleQuickStart}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs uppercase tracking-wider shadow transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-amber-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span>{t.BTN_QUICK_START}</span>
            </button>

            <button
              id="btn-login-key"
              onClick={() => setLoginMode(loginMode === 'inputKey' ? 'none' : 'inputKey')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-[#323242] border border-[#3D3D52] text-white font-semibold text-xs tracking-wide transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-[var(--secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="15" r="4" />
                <line x1="10.85" y1="12.15" x2="19" y2="4" />
                <line x1="18" y1="5" x2="20" y2="7" />
                <line x1="15" y1="8" x2="17" y2="10" />
              </svg>
              <span>{t.BTN_LOGIN_KEY}</span>
            </button>

            <button
              id="btn-load-key-file"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-[#323242] border border-[#3D3D52] text-white font-semibold text-xs tracking-wide transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <span>{t.BTN_LOAD_KEY_FILE}</span>
            </button>

            <button
              id="btn-restore-backup"
              onClick={() => backupInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-[#323242] border border-[#3D3D52] text-white font-semibold text-xs tracking-wide transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-[var(--status-online)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{t.BTN_RESTORE_BACKUP}</span>
            </button>
          </div>
        </div>

        {/* 5. NOSTR Relays Manager */}
        <div className="rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2D2D3E] p-4 space-y-3">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              {t.RELAY_STATUS}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {t.ACTIVE_RELAYS}
            </p>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
            {relaysStatus.map((r) => (
              <div
                key={r.url}
                className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#333345] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 font-mono text-white/90 truncate mr-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'connected' ? 'bg-[var(--status-online)]' : 'bg-[var(--status-danger)]'}`} />
                  <span className="truncate">{r.url}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.latency !== undefined && (
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">{r.latency}ms</span>
                  )}
                  <span className="text-[10px] uppercase font-bold text-emerald-400">
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Add Relay Form */}
          <form onSubmit={handleAddRelay} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newRelayUrl}
              onChange={(e) => setNewRelayUrl(e.target.value)}
              placeholder="wss://relay.example.com"
              className="flex-1 px-3 py-1.5 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)] font-mono"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold uppercase transition-colors shadow cursor-pointer shrink-0"
            >
              {t.ADD_RELAY}
            </button>
          </form>
        </div>

        {/* 6. Nostr Relay Donation Section */}
        <NostrDonationSection lang={lang} />

        {/* 7. Danger Zone: Logout and Wipe Keys */}
        {onLogout && currentIdentity && (
          <div className="rounded-[var(--radius-sm)] bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-[var(--status-danger)] uppercase tracking-wider">
                {t.LOGOUT_CLEAR}
              </h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {t.CONFIRM_LOGOUT}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              title={t.LOGOUT_CLEAR}
              className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--status-danger)] hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow shrink-0 cursor-pointer"
            >
              {t.LOGOUT_CLEAR}
            </button>
          </div>
        )}

        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleKeyFileUpload}
          accept=".txt,.json,.key"
          className="hidden"
        />
        <input
          type="file"
          ref={backupInputRef}
          onChange={handleBackupUpload}
          accept=".json"
          className="hidden"
        />

        {/* Bottom Close Button */}
        {onClose && (
          <div className="pt-3 border-t border-[#282838] flex justify-end">
            <button
              type="button"
              id="btn-bottom-close-security-modal"
              onClick={onClose}
              className="px-5 py-2 rounded-[var(--radius-sm)] bg-[#262638] hover:bg-[#34344C] text-white text-xs font-bold transition-colors cursor-pointer border border-[#3C3C52]"
            >
              {lang === 'bg' ? 'Затвори' : 'Close'}
            </button>
          </div>
        )}

        {/* Backup Location Selection Modal */}
        <BackupLocationModal
          lang={lang}
          isOpen={showBackupLocationModal}
          onClose={() => setShowBackupLocationModal(false)}
          currentDirName={backupDirName}
          onLocationSelected={(name) => {
            setBackupDirName(name);
            setLastBackupTime(Date.now());
            setBackupSuccessMsg(true);
            setTimeout(() => setBackupSuccessMsg(false), 4000);
          }}
        />
      </div>
    </div>
  );
};
