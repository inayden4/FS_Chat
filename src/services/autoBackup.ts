import * as db from './db';
import { AppBackupData } from '../types';

const DB_NAME = 'NostrAutoBackupStore';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'backup_directory_handle';

let cachedDirHandle: any = null;
let debounceTimeout: any = null;

// Open IndexedDB to persist FileSystemDirectoryHandle
function openBackupDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Get saved Directory Handle from IndexedDB
export async function getSavedDirectoryHandle(): Promise<any> {
  if (cachedDirHandle) return cachedDirHandle;
  try {
    const idb = await openBackupDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => {
        cachedDirHandle = req.result || null;
        resolve(cachedDirHandle);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Error reading saved directory handle:', err);
    return null;
  }
}

// Save Directory Handle to IndexedDB
async function saveDirectoryHandle(handle: any): Promise<void> {
  cachedDirHandle = handle;
  try {
    const idb = await openBackupDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error persisting directory handle:', err);
  }
}

// Clear Directory Handle
export async function clearDirectoryHandle(): Promise<void> {
  cachedDirHandle = null;
  try {
    localStorage.removeItem('nostr_backup_dir_name');
    const idb = await openBackupDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

// Check if File System Access API is supported
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// Set and store backup directory name
export function setBackupDirectoryName(dirName: string): void {
  localStorage.setItem('nostr_backup_dir_name', dirName);
  const now = Date.now();
  localStorage.setItem('nostr_last_backup_time', String(now));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nostr-backup-saved', {
      detail: { timestamp: now, dirName }
    }));
  }
}

// Direct download backup file to disk / Downloads folder
export async function downloadBackupFileToDisk(): Promise<{ success: boolean; filename: string }> {
  try {
    const backupData = await db.exportFullBackup();
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `nostr-dating-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const now = Date.now();
    localStorage.setItem('nostr_last_backup_time', String(now));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nostr-backup-saved', {
        detail: { timestamp: now, dirName: 'Сваляния / Downloads' }
      }));
    }
    return { success: true, filename };
  } catch (err) {
    console.error('Failed to download backup file:', err);
    return { success: false, filename: '' };
  }
}

// User selects directory or falls back gracefully to download if iframe/browser blocks it
export async function selectBackupDirectory(): Promise<{
  success: boolean;
  dirName?: string;
  isFallbackDownload?: boolean;
  error?: string;
  cancelled?: boolean;
}> {
  // Try File System Access API first if available
  if (isFileSystemAccessSupported()) {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });

      if (handle) {
        await saveDirectoryHandle(handle);
        const dirName = handle.name || 'Selected Folder';
        localStorage.setItem('nostr_backup_dir_name', dirName);

        // Run initial backup right away
        await executeAutoBackup(true);

        return {
          success: true,
          dirName
        };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, cancelled: true };
      }
      // If blocked by cross-origin iframe security or permission error, proceed to fallback download below
      console.warn('showDirectoryPicker unavailable or blocked by iframe, falling back to direct download:', err);
    }
  }

  // Fallback: Directly download the backup file to device (Downloads folder)
  const dlRes = await downloadBackupFileToDisk();
  if (dlRes.success) {
    const dirName = 'Сваляния / Downloads';
    localStorage.setItem('nostr_backup_dir_name', dirName);
    return {
      success: true,
      dirName,
      isFallbackDownload: true
    };
  }

  return {
    success: false,
    error: 'Неуспешен запис на бекъп'
  };
}

// Get current backup info
export async function getBackupInfo(): Promise<{
  hasDirectory: boolean;
  dirName: string | null;
  lastBackupTime: number | null;
  isSupported: boolean;
}> {
  const isSupported = isFileSystemAccessSupported();
  const dirName = localStorage.getItem('nostr_backup_dir_name');
  const lastBackupStr = localStorage.getItem('nostr_last_backup_time');
  const lastBackupTime = lastBackupStr ? parseInt(lastBackupStr, 10) : null;
  const handle = await getSavedDirectoryHandle();

  return {
    hasDirectory: Boolean(handle && dirName),
    dirName: dirName || null,
    lastBackupTime,
    isSupported
  };
}

// Write backup file directly into directory handle
async function writeBackupToDirectory(handle: any, backupData: AppBackupData): Promise<boolean> {
  try {
    // Verify or request permission if needed
    if (handle.queryPermission) {
      let perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && handle.requestPermission) {
        perm = await handle.requestPermission({ mode: 'readwrite' });
      }
      if (perm !== 'granted') {
        return false;
      }
    }

    const fileHandle = await handle.getFileHandle('nostr-dating-backup.json', { create: true });
    const writable = await fileHandle.createWritable();
    const jsonStr = JSON.stringify(backupData, null, 2);
    await writable.write(jsonStr);
    await writable.close();
    return true;
  } catch (err) {
    console.warn('Could not write backup to local folder handle:', err);
    return false;
  }
}

// Main execution function
export async function executeAutoBackup(immediate = false): Promise<{
  success: boolean;
  timestamp: number;
  dirName?: string;
}> {
  try {
    const backupData = await db.exportFullBackup();
    const now = Date.now();

    // 1. Always store to local-first backup cache slot
    try {
      localStorage.setItem('nostr_auto_backup_latest', JSON.stringify({
        timestamp: now,
        data: backupData
      }));
    } catch {
      // Ignore quota errors if storage full
    }

    let writtenToFolder = false;
    const handle = await getSavedDirectoryHandle();
    const dirName = localStorage.getItem('nostr_backup_dir_name') || undefined;

    if (handle) {
      writtenToFolder = await writeBackupToDirectory(handle, backupData);
    }

    localStorage.setItem('nostr_last_backup_time', String(now));

    // Dispatch custom event so UI components can update timestamp live
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nostr-backup-saved', {
        detail: {
          timestamp: now,
          dirName,
          writtenToFolder
        }
      }));
    }

    return {
      success: true,
      timestamp: now,
      dirName
    };
  } catch (err) {
    console.error('executeAutoBackup failed:', err);
    return {
      success: false,
      timestamp: Date.now()
    };
  }
}

// Debounced auto-backup for frequent operations
export function scheduleAutoBackup(): void {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  debounceTimeout = setTimeout(() => {
    executeAutoBackup(false);
  }, 400);
}

// Automatically trigger auto-backup whenever any change is made to the local database
db.onDatabaseChange(() => {
  scheduleAutoBackup();
});

