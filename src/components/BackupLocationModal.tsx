import React, { useState, useRef } from 'react';
import { Language, UI_TRANSLATIONS } from '../types';
import {
  setBackupDirectoryName,
  downloadBackupFileToDisk,
  executeAutoBackup,
  isFileSystemAccessSupported
} from '../services/autoBackup';

interface BackupLocationModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  currentDirName: string | null;
  onLocationSelected: (dirName: string) => void;
}

export const BackupLocationModal: React.FC<BackupLocationModalProps> = ({
  lang,
  isOpen,
  onClose,
  currentDirName,
  onLocationSelected
}) => {
  const t = UI_TRANSLATIONS[lang];
  const [customPath, setCustomPath] = useState(currentDirName || '');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileFolderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const presets = [
    { id: 'downloads', label: lang === 'bg' ? '📁 Папка Сваляния (Downloads)' : '📁 Downloads Folder', name: 'Downloads (Сваляния)' },
    { id: 'documents', label: lang === 'bg' ? '📁 Документи (Documents/NostrBackup)' : '📁 Documents/NostrBackup', name: 'Documents/NostrBackup' },
    { id: 'desktop', label: lang === 'bg' ? '📁 Работен плот (Desktop/NostrVault)' : '📁 Desktop/NostrVault', name: 'Desktop/NostrVault' },
    { id: 'custom_vault', label: lang === 'bg' ? '📁 Nostr-Encrypted-Vault' : '📁 Nostr-Encrypted-Vault', name: 'Nostr-Encrypted-Vault' }
  ];

  const handleApplyLocation = async (dirName: string) => {
    if (!dirName.trim()) return;
    setIsProcessing(true);
    try {
      setBackupDirectoryName(dirName.trim());
      await executeAutoBackup(true);
      await downloadBackupFileToDisk();
      
      setStatusMessage(lang === 'bg' 
        ? `✓ Папката "${dirName}" е избрана успешно! Направен е моментален бекъп.`
        : `✓ Folder "${dirName}" successfully configured! Instant backup saved.`
      );

      onLocationSelected(dirName.trim());
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 1200);
    } catch (e) {
      console.error('Failed applying backup location:', e);
      setIsProcessing(false);
    }
  };

  // Trigger native browser directory picker input (HTML5 webkitdirectory)
  const handleOpenNativeDirectoryPicker = () => {
    fileFolderInputRef.current?.click();
  };

  // Handle selected folder from webkitdirectory file input
  const handleFolderInputSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      let chosenName = 'Selected_Folder';
      if ((firstFile as any).webkitRelativePath) {
        const parts = (firstFile as any).webkitRelativePath.split('/');
        if (parts.length > 0 && parts[0]) {
          chosenName = parts[0];
        }
      } else {
        chosenName = firstFile.name || 'Local_Folder';
      }
      await handleApplyLocation(chosenName);
    } else {
      // If user selected an empty folder or cancelled
      await handleApplyLocation('Selected_Folder');
    }
    if (fileFolderInputRef.current) {
      fileFolderInputRef.current.value = '';
    }
  };

  // Try modern File System API if available
  const handleTryFileSystemApi = async () => {
    if (isFileSystemAccessSupported()) {
      try {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        if (handle && handle.name) {
          await handleApplyLocation(handle.name);
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('showDirectoryPicker unavailable or blocked, falling back to input:', err);
      }
    }
    // Fallback to native folder input
    handleOpenNativeDirectoryPicker();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333345] shadow-2xl p-6 relative">
        {/* Hidden directory picker input */}
        <input
          type="file"
          ref={fileFolderInputRef}
          onChange={handleFolderInputSelected}
          // @ts-ignore
          webkitdirectory="true"
          directory="true"
          multiple
          className="hidden"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3D]">
          <div className="flex items-center gap-2">
            <span className="text-xl" title="Локален бекъп">📂</span>
            <div>
              <h3 className="text-sm font-bold text-white">
                {lang === 'bg' ? 'Избор на папка за автоматичен бекъп' : 'Select Backup Location'}
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                {lang === 'bg' ? 'Автоматичен запис при всяка промяна в реално време' : 'Automatic real-time backup on every change'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-white text-lg p-1 cursor-pointer"
            title={t.CLOSE}
            aria-label={t.CLOSE}
          >
            ✕
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className="mt-3 p-2.5 rounded-[var(--radius-sm)] bg-emerald-500/20 border border-emerald-500/50 text-xs text-emerald-300 font-semibold">
            {statusMessage}
          </div>
        )}

        <div className="mt-4 space-y-4">
          {/* Main Action: Open Native Folder Picker */}
          <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#3A3A4E] hover:border-[var(--primary)] transition-colors">
            <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
              <span>🖥️</span>
              <span>{lang === 'bg' ? 'Избери папка от компютъра / устройството' : 'Browse folder from your computer'}</span>
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] mb-3">
              {lang === 'bg' 
                ? 'Отваря системния файлов диалог за избор на произволна папка от вашия диск.'
                : 'Opens native system directory dialog to pick any folder on your drive.'}
            </p>
            <button
              type="button"
              onClick={handleTryFileSystemApi}
              disabled={isProcessing}
              className="w-full py-2.5 px-4 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              title={lang === 'bg' ? 'Отвори файлов мениджър за избор на папка' : 'Open system directory browser'}
            >
              <span>📂</span>
              <span>{lang === 'bg' ? 'Отвори избор на папка...' : 'Browse Folder...'}</span>
            </button>
          </div>

          {/* Preset Standard Directories */}
          <div>
            <label className="block text-xs font-bold text-white mb-2">
              {lang === 'bg' ? 'Или избери бърза стандартна локация:' : 'Or choose a preset standard location:'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyLocation(preset.name)}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-[var(--radius-sm)] text-left text-xs font-semibold border transition-all cursor-pointer flex items-center justify-between ${
                    currentDirName === preset.name
                      ? 'bg-[var(--primary)]/20 border-[var(--primary)] text-white'
                      : 'bg-[var(--bg-main)] border-[#323246] hover:border-[#4B4B66] text-white/90'
                  }`}
                  title={`Задай папка: ${preset.name}`}
                >
                  <span className="truncate">{preset.label}</span>
                  {currentDirName === preset.name && (
                    <span className="text-emerald-400 font-bold ml-1 text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Folder Path Input */}
          <div className="pt-2 border-t border-[#2C2C3D]">
            <label className="block text-xs font-bold text-white mb-1.5">
              {lang === 'bg' ? 'Или въведи име / път на папка ръчно:' : 'Or enter custom folder / path manually:'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder={lang === 'bg' ? 'Напр. D:/Nostr_Backups или ~/NostrVault' : 'e.g. D:/Nostr_Backups or ~/NostrVault'}
                className="flex-1 px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)] font-mono"
              />
              <button
                type="button"
                onClick={() => handleApplyLocation(customPath)}
                disabled={isProcessing || !customPath.trim()}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[#2C2C3E] hover:bg-[#393952] border border-[#3F3F56] text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                title={lang === 'bg' ? 'Запази тази папка и направи бекъп' : 'Save folder and backup'}
              >
                {lang === 'bg' ? 'Запази' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 pt-3 border-t border-[#2C2C3D] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>{lang === 'bg' ? 'Бекъп файлът е криптиран/JSON съвместим' : 'Backup file is JSON compatible'}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-[#2F2F40] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {t.CLOSE}
          </button>
        </div>
      </div>
    </div>
  );
};
