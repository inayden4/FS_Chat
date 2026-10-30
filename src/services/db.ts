import {
  NostrIdentity,
  UserProfile,
  DirectMessage,
  ChannelMessage,
  ChatChannel,
  AppBackupData
} from '../types';

const DB_NAME = 'FS_Chat_DB';
const DB_VERSION = 1;

type DatabaseChangeListener = () => void;
const dbChangeListeners: DatabaseChangeListener[] = [];

export function onDatabaseChange(listener: DatabaseChangeListener): () => void {
  dbChangeListeners.push(listener);
  return () => {
    const idx = dbChangeListeners.indexOf(listener);
    if (idx !== -1) dbChangeListeners.splice(idx, 1);
  };
}

export function notifyDatabaseChange(): void {
  for (const listener of dbChangeListeners) {
    try {
      listener();
    } catch (e) {
      console.warn('Error in db change listener:', e);
    }
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('identity')) {
        db.createObjectStore('identity', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('my_profile')) {
        db.createObjectStore('my_profile', { keyPath: 'pubkey' });
      }
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'pubkey' });
      }
      if (!db.objectStoreNames.contains('direct_messages')) {
        const dmStore = db.createObjectStore('direct_messages', { keyPath: 'id' });
        dmStore.createIndex('chatWithPubkey', 'chatWithPubkey', { unique: false });
        dmStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('channel_messages')) {
        const cmStore = db.createObjectStore('channel_messages', { keyPath: 'id' });
        cmStore.createIndex('channelId', 'channelId', { unique: false });
        cmStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('channels')) {
        db.createObjectStore('channels', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('friends')) {
        db.createObjectStore('friends', { keyPath: 'pubkey' });
      }
      if (!db.objectStoreNames.contains('blocked')) {
        db.createObjectStore('blocked', { keyPath: 'pubkey' });
      }
      if (!db.objectStoreNames.contains('hidden')) {
        db.createObjectStore('hidden', { keyPath: 'pubkey' });
      }
      if (!db.objectStoreNames.contains('sync_state')) {
        db.createObjectStore('sync_state', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

// Generic transaction helpers
async function getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await getDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// Identity
export async function loadIdentity(): Promise<NostrIdentity | null> {
  try {
    const store = await getStore('identity', 'readonly');
    return new Promise((resolve) => {
      const req = store.get('current');
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    const local = localStorage.getItem('nostr_identity');
    return local ? JSON.parse(local) : null;
  }
}

export interface SavedAccount {
  identity: NostrIdentity;
  profile?: UserProfile;
  lastUsed: number;
}

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const local = localStorage.getItem('nostr_saved_accounts');
    if (local) {
      return JSON.parse(local);
    }
  } catch {}
  return [];
}

export async function saveAccountToVault(identity: NostrIdentity, profile?: UserProfile): Promise<void> {
  try {
    const accounts = await getSavedAccounts();
    const idx = accounts.findIndex(a => a.identity.pubKeyHex === identity.pubKeyHex);
    const existing = idx >= 0 ? accounts[idx] : null;
    const updated: SavedAccount = {
      identity,
      profile: profile || existing?.profile,
      lastUsed: Date.now()
    };
    if (idx >= 0) {
      accounts[idx] = updated;
    } else {
      accounts.push(updated);
    }
    localStorage.setItem('nostr_saved_accounts', JSON.stringify(accounts));
    notifyDatabaseChange();
  } catch (e) {
    console.warn('Failed saving account to vault:', e);
  }
}

export async function removeSavedAccount(pubkey: string): Promise<void> {
  try {
    const accounts = (await getSavedAccounts()).filter(a => a.identity.pubKeyHex !== pubkey);
    localStorage.setItem('nostr_saved_accounts', JSON.stringify(accounts));
    notifyDatabaseChange();
  } catch {}
}

export async function saveIdentity(identity: NostrIdentity): Promise<void> {
  try {
    localStorage.setItem('nostr_identity', JSON.stringify(identity));
    const store = await getStore('identity', 'readwrite');
    store.put({ id: 'current', data: identity });
    await saveAccountToVault(identity);
    notifyDatabaseChange();
  } catch (e) {
    console.warn('Could not save identity in IDB:', e);
  }
}

export async function clearIdentity(): Promise<void> {
  localStorage.removeItem('nostr_identity');
  try {
    const store = await getStore('identity', 'readwrite');
    store.delete('current');
    notifyDatabaseChange();
  } catch {}
}

// User Profile
export async function loadMyProfile(pubkey: string): Promise<UserProfile | null> {
  try {
    const store = await getStore('my_profile', 'readonly');
    return new Promise((resolve) => {
      const req = store.get(pubkey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    const local = localStorage.getItem(`nostr_profile_${pubkey}`);
    return local ? JSON.parse(local) : null;
  }
}

export async function saveMyProfile(profile: UserProfile): Promise<void> {
  try {
    localStorage.setItem(`nostr_profile_${profile.pubkey}`, JSON.stringify(profile));
    const store = await getStore('my_profile', 'readwrite');
    store.put(profile);

    // Update profile in saved accounts vault
    const accounts = await getSavedAccounts();
    const idx = accounts.findIndex(a => a.identity.pubKeyHex === profile.pubkey);
    if (idx >= 0) {
      accounts[idx].profile = profile;
      localStorage.setItem('nostr_saved_accounts', JSON.stringify(accounts));
    }

    notifyDatabaseChange();
  } catch (e) {
    console.warn('Failed saving profile:', e);
  }
}

// Profiles Cache
export async function getAllProfiles(): Promise<UserProfile[]> {
  try {
    const store = await getStore('profiles', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveProfileToCache(profile: UserProfile): Promise<void> {
  try {
    const store = await getStore('profiles', 'readwrite');
    store.put(profile);
  } catch {}
}

export async function deleteProfile(pubkey: string): Promise<void> {
  try {
    const store = await getStore('profiles', 'readwrite');
    store.delete(pubkey);
  } catch {}
}

export async function clearProfilesCache(): Promise<void> {
  try {
    const store = await getStore('profiles', 'readwrite');
    store.clear();
  } catch {}
}

// Direct Messages
export async function getDirectMessages(chatWithPubkey?: string): Promise<DirectMessage[]> {
  try {
    const store = await getStore('direct_messages', 'readonly');
    return new Promise((resolve) => {
      if (chatWithPubkey) {
        const index = store.index('chatWithPubkey');
        const req = index.getAll(chatWithPubkey);
        req.onsuccess = () => {
          const msgs: DirectMessage[] = req.result || [];
          msgs.sort((a, b) => a.timestamp - b.timestamp);
          resolve(msgs);
        };
        req.onerror = () => resolve([]);
      } else {
        const req = store.getAll();
        req.onsuccess = () => {
          const msgs: DirectMessage[] = req.result || [];
          msgs.sort((a, b) => a.timestamp - b.timestamp);
          resolve(msgs);
        };
        req.onerror = () => resolve([]);
      }
    });
  } catch {
    return [];
  }
}

export async function saveDirectMessage(msg: DirectMessage): Promise<void> {
  try {
    const store = await getStore('direct_messages', 'readwrite');
    store.put(msg);
    notifyDatabaseChange();
  } catch (e) {
    console.warn('Error storing DM:', e);
  }
}

export async function deleteDirectMessage(id: string): Promise<void> {
  try {
    const store = await getStore('direct_messages', 'readwrite');
    store.delete(id);
    notifyDatabaseChange();
  } catch (e) {
    console.warn('Error deleting DM:', e);
  }
}

export async function updateDirectMessage(msg: DirectMessage): Promise<void> {
  try {
    const store = await getStore('direct_messages', 'readwrite');
    store.put(msg);
    notifyDatabaseChange();
  } catch (e) {
    console.warn('Error updating DM:', e);
  }
}

export async function clearAllDirectMessages(): Promise<void> {
  try {
    const store = await getStore('direct_messages', 'readwrite');
    store.clear();
    notifyDatabaseChange();
  } catch (e) {
    console.warn('Error clearing all DMs:', e);
  }
}

// Channel Messages (NIP-28)
export async function getChannelMessages(channelId: string): Promise<ChannelMessage[]> {
  try {
    const store = await getStore('channel_messages', 'readonly');
    const index = store.index('channelId');
    return new Promise((resolve) => {
      const req = index.getAll(channelId);
      req.onsuccess = () => {
        const msgs: ChannelMessage[] = req.result || [];
        msgs.sort((a, b) => a.timestamp - b.timestamp);
        resolve(msgs);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveChannelMessage(msg: ChannelMessage): Promise<void> {
  try {
    const store = await getStore('channel_messages', 'readwrite');
    store.put(msg);
    notifyDatabaseChange();
  } catch (e) {
    console.warn('Error storing room msg:', e);
  }
}

export async function deleteChannelMessage(id: string): Promise<void> {
  try {
    const store = await getStore('channel_messages', 'readwrite');
    store.delete(id);
    notifyDatabaseChange();
  } catch (e) {
    console.warn('Error deleting room msg:', e);
  }
}

export async function updateChannelMessage(msg: ChannelMessage): Promise<void> {
  try {
    const store = await getStore('channel_messages', 'readwrite');
    store.put(msg);
    notifyDatabaseChange();
  } catch (e) {
    console.warn('Error updating room msg:', e);
  }
}

// Channels
export async function getAllChannels(): Promise<ChatChannel[]> {
  try {
    const store = await getStore('channels', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveChannel(channel: ChatChannel): Promise<void> {
  try {
    const store = await getStore('channels', 'readwrite');
    store.put(channel);
    notifyDatabaseChange();
  } catch {}
}

export async function deleteChannel(channelId: string): Promise<void> {
  try {
    const store = await getStore('channels', 'readwrite');
    store.delete(channelId);
    notifyDatabaseChange();
  } catch {}
}

// Friends / Contact List (NIP-02)
export async function getFriends(): Promise<string[]> {
  try {
    const store = await getStore('friends', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).map((r: { pubkey: string }) => r.pubkey));
      req.onerror = () => resolve([]);
    });
  } catch {
    const local = localStorage.getItem('nostr_friends');
    return local ? JSON.parse(local) : [];
  }
}

export async function toggleFriend(pubkey: string): Promise<boolean> {
  const current = await getFriends();
  const isFriend = current.includes(pubkey);
  const updated = isFriend ? current.filter(p => p !== pubkey) : [...current, pubkey];
  
  localStorage.setItem('nostr_friends', JSON.stringify(updated));
  try {
    const store = await getStore('friends', 'readwrite');
    if (isFriend) {
      store.delete(pubkey);
    } else {
      store.put({ pubkey, addedAt: Date.now() });
    }
    notifyDatabaseChange();
  } catch {}
  return !isFriend;
}

// Blocked & Hidden
export async function getBlocked(): Promise<string[]> {
  try {
    const store = await getStore('blocked', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).map((r: { pubkey: string }) => r.pubkey));
      req.onerror = () => resolve([]);
    });
  } catch {
    const local = localStorage.getItem('nostr_blocked');
    return local ? JSON.parse(local) : [];
  }
}

export async function toggleBlocked(pubkey: string): Promise<boolean> {
  const current = await getBlocked();
  const isBlocked = current.includes(pubkey);
  const updated = isBlocked ? current.filter(p => p !== pubkey) : [...current, pubkey];
  
  localStorage.setItem('nostr_blocked', JSON.stringify(updated));
  try {
    const store = await getStore('blocked', 'readwrite');
    if (isBlocked) {
      store.delete(pubkey);
    } else {
      store.put({ pubkey, blockedAt: Date.now() });
    }
    notifyDatabaseChange();
  } catch {}
  return !isBlocked;
}

export async function getHidden(): Promise<string[]> {
  try {
    const store = await getStore('hidden', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).map((r: { pubkey: string }) => r.pubkey));
      req.onerror = () => resolve([]);
    });
  } catch {
    const local = localStorage.getItem('nostr_hidden');
    return local ? JSON.parse(local) : [];
  }
}

export async function toggleHidden(pubkey: string): Promise<boolean> {
  const current = await getHidden();
  const isHidden = current.includes(pubkey);
  const updated = isHidden ? current.filter(p => p !== pubkey) : [...current, pubkey];
  
  localStorage.setItem('nostr_hidden', JSON.stringify(updated));
  try {
    const store = await getStore('hidden', 'readwrite');
    if (isHidden) {
      store.delete(pubkey);
    } else {
      store.put({ pubkey, hiddenAt: Date.now() });
    }
    notifyDatabaseChange();
  } catch {}
  return !isHidden;
}

// Sync State (since timestamp)
export async function getLastSyncTimestamp(): Promise<number> {
  try {
    const store = await getStore('sync_state', 'readonly');
    return new Promise((resolve) => {
      const req = store.get('last_sync');
      req.onsuccess = () => resolve(req.result ? req.result.timestamp : Math.floor(Date.now() / 1000) - 86400 * 7);
      req.onerror = () => resolve(Math.floor(Date.now() / 1000) - 86400 * 7);
    });
  } catch {
    return Math.floor(Date.now() / 1000) - 86400 * 7;
  }
}

export async function saveLastSyncTimestamp(ts: number): Promise<void> {
  try {
    const store = await getStore('sync_state', 'readwrite');
    store.put({ key: 'last_sync', timestamp: ts });
  } catch {}
}

// Full Backup Export & Import
export async function exportFullBackup(): Promise<AppBackupData> {
  const identity = await loadIdentity();
  const profile = identity ? await loadMyProfile(identity.pubKeyHex) : null;
  const friends = await getFriends();
  const blocked = await getBlocked();
  const hidden = await getHidden();
  const directMessages = await getDirectMessages();
  const channels = await getAllChannels();
  
  // Collect all channel messages
  let channelMessages: ChannelMessage[] = [];
  for (const c of channels) {
    const msgs = await getChannelMessages(c.id);
    channelMessages = channelMessages.concat(msgs);
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    identity: identity as NostrIdentity,
    profile: (profile || {
      pubkey: identity?.pubKeyHex || '',
      name: 'Nostr User',
      age: 25,
      location: 'Sofia, BG',
      updatedAt: Date.now()
    }),
    friends,
    blocked,
    hidden,
    directMessages,
    channelMessages,
    channels
  };
}

export async function importFullBackup(backup: AppBackupData): Promise<boolean> {
  try {
    if (!backup.identity || !backup.identity.privKeyHex) {
      throw new Error('Invalid backup structure');
    }

    await saveIdentity(backup.identity);
    if (backup.profile) {
      await saveMyProfile(backup.profile);
    }

    if (Array.isArray(backup.friends)) {
      localStorage.setItem('nostr_friends', JSON.stringify(backup.friends));
      const store = await getStore('friends', 'readwrite');
      for (const f of backup.friends) {
        store.put({ pubkey: f, addedAt: Date.now() });
      }
    }

    if (Array.isArray(backup.blocked)) {
      localStorage.setItem('nostr_blocked', JSON.stringify(backup.blocked));
      const store = await getStore('blocked', 'readwrite');
      for (const b of backup.blocked) {
        store.put({ pubkey: b, blockedAt: Date.now() });
      }
    }

    if (Array.isArray(backup.hidden)) {
      localStorage.setItem('nostr_hidden', JSON.stringify(backup.hidden));
      const store = await getStore('hidden', 'readwrite');
      for (const h of backup.hidden) {
        store.put({ pubkey: h, hiddenAt: Date.now() });
      }
    }

    if (Array.isArray(backup.directMessages)) {
      for (const dm of backup.directMessages) {
        await saveDirectMessage(dm);
      }
    }

    if (Array.isArray(backup.channels)) {
      for (const ch of backup.channels) {
        await saveChannel(ch);
      }
    }

    if (Array.isArray(backup.channelMessages)) {
      for (const cm of backup.channelMessages) {
        await saveChannelMessage(cm);
      }
    }

    return true;
  } catch (e) {
    console.error('Failed importing backup:', e);
    return false;
  }
}
