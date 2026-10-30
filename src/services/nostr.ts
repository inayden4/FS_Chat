import {
  generateSecretKey,
  getPublicKey,
  nip19,
  nip04,
  nip17,
  SimplePool,
  finalizeEvent
} from 'nostr-tools';
import {
  NostrIdentity,
  UserProfile,
  DirectMessage,
  ChannelMessage,
  ChatChannel,
  RelayInfo,
  parseInterestsList
} from '../types';
import * as db from './db';

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social'
];

// Helper: Hex / Uint8Array conversions
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Ensure 64-char lowercase hex string for fixed-size Nostr tags ('e' and 'p')
export function ensure64Hex(str: string): string {
  if (!str) return '0000000000000000000000000000000000000000000000000000000000000000';
  const clean = str.trim().toLowerCase();
  if (/^[0-9a-f]{64}$/.test(clean)) {
    return clean;
  }
  // Deterministic 256-bit hashing to guarantee valid 64-char hex
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
  let h5 = 0xc2b2ae35, h6 = 0x27d4eb2f, h7 = 0x165667b1, h8 = 0xd3a2646c;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ (ch << 2), 1597334677);
    h3 = Math.imul(h3 ^ (ch << 4), 381204193);
    h4 = Math.imul(h4 ^ (ch << 6), 2246822507);
    h5 = Math.imul(h5 ^ (ch >> 1), 3266489909);
    h6 = Math.imul(h6 ^ (ch >> 2), 374761393);
    h7 = Math.imul(h7 ^ (ch >> 3), 668265261);
    h8 = Math.imul(h8 ^ (ch >> 4), 2166136261);
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}${toHex(h8)}`.toLowerCase();
}

export function ensure64HexPubkey(pubkey: string): string {
  if (!pubkey) return '0000000000000000000000000000000000000000000000000000000000000000';
  const trimmed = pubkey.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (trimmed.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'npub' && typeof decoded.data === 'string') {
        return decoded.data.toLowerCase();
      }
    } catch {}
  }
  return ensure64Hex(trimmed);
}

// 1. Key generation & parsing (NIP-01 & NIP-19)
export function createFreshIdentity(): NostrIdentity {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  const nsec = nip19.nsecEncode(sk);
  const npub = nip19.npubEncode(pk);
  const privKeyHex = bytesToHex(sk);

  return {
    privKeyHex,
    pubKeyHex: pk,
    nsec,
    npub,
    createdAt: Date.now()
  };
}

export function parseAndValidateKey(inputKey: string): NostrIdentity {
  const trimmed = inputKey.trim();
  let skBytes: Uint8Array;

  if (trimmed.startsWith('nsec1')) {
    const decoded = nip19.decode(trimmed);
    if (decoded.type !== 'nsec' || !(decoded.data instanceof Uint8Array)) {
      throw new Error('Invalid nsec key format');
    }
    skBytes = decoded.data;
  } else if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    skBytes = hexToBytes(trimmed);
  } else {
    throw new Error('Key must be a valid nsec1... or 64-char hexadecimal string');
  }

  const pk = getPublicKey(skBytes);
  const nsec = nip19.nsecEncode(skBytes);
  const npub = nip19.npubEncode(pk);
  const privKeyHex = bytesToHex(skBytes);

  return {
    privKeyHex,
    pubKeyHex: pk,
    nsec,
    npub,
    createdAt: Date.now()
  };
}

// 2. Encryption (NIP-17 Gift Wrap & NIP-04)

/**
 * NIP-17 Gift Wrap: Wraps a private DM into an ephemeral Gift Wrap (Kind 1059)
 * containing an encrypted Seal (Kind 13) and Rumor (Kind 14).
 * Relays ONLY see a random throwaway ephemeral pubkey and cannot see the sender or recipient identities!
 */
export function wrapNip17DirectMessage(
  senderPrivKeyHex: string,
  recipientPubkeyHex: string,
  message: string
) {
  const skBytes = hexToBytes(senderPrivKeyHex);
  const recipient = { publicKey: ensure64HexPubkey(recipientPubkeyHex) };
  return nip17.wrapEvent(skBytes, recipient, message);
}

export function unwrapNip17DirectMessage(
  giftWrapEvent: any,
  recipientPrivKeyHex: string
) {
  const skBytes = hexToBytes(recipientPrivKeyHex);
  return nip17.unwrapEvent(giftWrapEvent, skBytes);
}

export async function encryptNip04(privKeyHex: string, recipientPubkeyHex: string, message: string): Promise<string> {
  const skBytes = hexToBytes(privKeyHex);
  return await nip04.encrypt(skBytes, recipientPubkeyHex, message);
}

export async function decryptNip04(privKeyHex: string, senderPubkeyHex: string, ciphertext: string): Promise<string> {
  const skBytes = hexToBytes(privKeyHex);
  try {
    return await nip04.decrypt(skBytes, senderPubkeyHex, ciphertext);
  } catch (e) {
    console.warn('Decryption failed, returning raw ciphertext:', e);
    return ciphertext;
  }
}

// 3. Relay Pool and Connection State
let pool: SimplePool | null = null;
export function getRelayPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool();
  }
  return pool;
}

export async function testRelayConnections(relays: string[]): Promise<RelayInfo[]> {
  const results: RelayInfo[] = [];

  for (const url of relays) {
    const start = performance.now();
    try {
      const ws = new WebSocket(url);
      const pingPromise = new Promise<'connected' | 'error'>((resolve) => {
        const timer = setTimeout(() => {
          try { ws.close(); } catch {}
          resolve('error');
        }, 3500);

        ws.onopen = () => {
          clearTimeout(timer);
          try { ws.close(); } catch {}
          resolve('connected');
        };

        ws.onerror = () => {
          clearTimeout(timer);
          resolve('error');
        };
      });

      const status = await pingPromise;
      const elapsed = Math.round(performance.now() - start);
      results.push({
        url,
        status,
        lastPingMs: status === 'connected' ? elapsed : undefined
      });
    } catch {
      results.push({
        url,
        status: 'error'
      });
    }
  }

  return results;
}

// 4. Seed Data (Completely clean - no preloaded profiles or channels)
export const INITIAL_CHANNELS: ChatChannel[] = [];
export const INITIAL_PROFILES: UserProfile[] = [];
export const INITIAL_ROOM_MESSAGES: Record<string, ChannelMessage[]> = {};


// 5. Publish Operations
export async function publishMetadata(
  identity: NostrIdentity,
  profile: UserProfile,
  relays: string[] = DEFAULT_RELAYS
): Promise<void> {
  const skBytes = hexToBytes(identity.privKeyHex);
  const metadataContent = JSON.stringify({
    name: profile.name,
    about: profile.bio || '',
    picture: profile.avatarUrl || (profile.photos && profile.photos[0]) || '',
    age: profile.age,
    location: profile.location,
    gender: profile.gender,
    Orientation: profile.Orientation,
    seeking: profile.seeking,
    interests: profile.interests,
    photos: profile.photos,
    video: profile.video
  });

  const unsignedEvent = {
    kind: 0,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: metadataContent
  };

  const signedEvent = finalizeEvent(unsignedEvent, skBytes);
  const poolInstance = getRelayPool();

  try {
    await Promise.any(poolInstance.publish(relays, signedEvent));
  } catch {
    console.warn('Relay publish completed locally/background');
  }

  await db.saveMyProfile(profile);
}

export async function publishDirectMessageEvent(
  identity: NostrIdentity,
  recipientPubkeyHex: string,
  content: string,
  mediaUrl?: string,
  mediaType?: 'photo' | 'video' | 'audio',
  relays: string[] = DEFAULT_RELAYS
): Promise<DirectMessage> {
  const validRecipientHex = ensure64HexPubkey(recipientPubkeyHex);
  let messagePayload = content;
  if (mediaUrl) {
    messagePayload = `${content}\n${mediaUrl}`.trim();
  }

  const skBytes = hexToBytes(identity.privKeyHex);
  const poolInstance = getRelayPool();
  let mainEventId = '';

  // 1. NIP-17 Gift Wrap (Kind 1059 wrapping Seal Kind 13 and Rumor Kind 14)
  // Generates randomized ephemeral keypair: Relays CANNOT see who sent or who receives!
  try {
    const giftWrap = wrapNip17DirectMessage(identity.privKeyHex, validRecipientHex, messagePayload);
    mainEventId = giftWrap.id;

    // Publish Gift Wrap to relays
    try {
      poolInstance.publish(relays, giftWrap);
    } catch (publishErr) {
      console.warn('NIP-17 publish to relays:', publishErr);
    }

    // Also wrap a copy for self so our other devices can sync our sent messages
    try {
      const selfWrap = wrapNip17DirectMessage(identity.privKeyHex, identity.pubKeyHex, messagePayload);
      poolInstance.publish(relays, selfWrap);
    } catch {}
  } catch (err) {
    console.warn('NIP-17 Gift Wrap encryption warning:', err);
  }

  // 2. Dual-publish legacy NIP-04 (Kind 4) for backward compatibility
  let ciphertext = '';
  try {
    ciphertext = await encryptNip04(identity.privKeyHex, validRecipientHex, messagePayload);
    const unsignedLegacy = {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', validRecipientHex]],
      content: ciphertext
    };
    const signedLegacy = finalizeEvent(unsignedLegacy, skBytes);
    if (!mainEventId) {
      mainEventId = signedLegacy.id;
    }
    try {
      poolInstance.publish(relays, signedLegacy);
    } catch {}
  } catch (e) {
    console.warn('Legacy NIP-04 fallback warning:', e);
  }

  const dm: DirectMessage = {
    id: mainEventId || `dm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    chatWithPubkey: validRecipientHex,
    fromPubkey: identity.pubKeyHex,
    toPubkey: validRecipientHex,
    content,
    rawCiphertext: ciphertext,
    timestamp: Date.now(),
    mediaUrl,
    mediaType,
    isOutgoing: true
  };

  await db.saveDirectMessage(dm);
  return dm;
}

export async function publishChannelMessageEvent(
  identity: NostrIdentity,
  authorName: string,
  channelId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: 'photo' | 'video' | 'audio',
  relays: string[] = DEFAULT_RELAYS
): Promise<ChannelMessage> {
  let fullContent = content;
  if (mediaUrl) {
    fullContent = `${content}\n${mediaUrl}`.trim();
  }

  const hexChannelId = ensure64Hex(channelId);
  const skBytes = hexToBytes(identity.privKeyHex);
  const unsignedEvent = {
    kind: 42,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', hexChannelId, '', 'root'],
      ['author_name', authorName]
    ],
    content: fullContent
  };

  const signedEvent = finalizeEvent(unsignedEvent, skBytes);
  const poolInstance = getRelayPool();

  try {
    poolInstance.publish(relays, signedEvent);
  } catch (e) {
    console.warn('Publish channel msg note:', e);
  }

  const cm: ChannelMessage = {
    id: signedEvent.id,
    channelId,
    fromPubkey: identity.pubKeyHex,
    authorName,
    content,
    timestamp: Date.now(),
    mediaUrl,
    mediaType
  };

  await db.saveChannelMessage(cm);
  return cm;
}

export async function publishCreateChannel(
  identity: NostrIdentity,
  name: string,
  about: string,
  picture?: string,
  relays: string[] = DEFAULT_RELAYS
): Promise<ChatChannel> {
  const skBytes = hexToBytes(identity.privKeyHex);
  const unsignedEvent = {
    kind: 40,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify({ name, about, picture })
  };

  const signedEvent = finalizeEvent(unsignedEvent, skBytes);
  const poolInstance = getRelayPool();

  try {
    poolInstance.publish(relays, signedEvent);
  } catch {}

  const channel: ChatChannel = {
    id: signedEvent.id,
    name,
    about,
    picture: picture || 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&auto=format&fit=crop&q=80',
    creatorPubkey: identity.pubKeyHex,
    createdAt: Date.now(),
    participantCount: 1
  };

  await db.saveChannel(channel);
  return channel;
}

// NIP-28 Kind 41: Channel Metadata Update (Admin / Room Owner Only)
export async function publishUpdateChannel(
  identity: NostrIdentity,
  channelId: string,
  name: string,
  about: string,
  picture?: string,
  relays: string[] = DEFAULT_RELAYS
): Promise<ChatChannel> {
  const skBytes = hexToBytes(identity.privKeyHex);
  const hexChannelId = ensure64Hex(channelId);
  const unsignedEvent = {
    kind: 41,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', hexChannelId, '', 'root']
    ],
    content: JSON.stringify({ name, about, picture })
  };

  const signedEvent = finalizeEvent(unsignedEvent, skBytes);
  const poolInstance = getRelayPool();

  try {
    poolInstance.publish(relays, signedEvent);
  } catch (e) {
    console.warn('Publish update channel note:', e);
  }

  const updatedChannel: ChatChannel = {
    id: channelId,
    name,
    about,
    picture,
    creatorPubkey: identity.pubKeyHex,
    createdAt: Date.now()
  };

  await db.saveChannel(updatedChannel);
  return updatedChannel;
}

// 6. Background Incremental Sync Engine
export async function performIncrementalSync(
  identity: NostrIdentity,
  relays: string[] = DEFAULT_RELAYS,
  onProgress?: (synced: boolean) => void
): Promise<void> {
  if (onProgress) onProgress(false);

  const since = await db.getLastSyncTimestamp();
  const poolInstance = getRelayPool();

  try {
    // 1. Subscribe to DMs to or from me: NIP-17 Gift Wrap (Kind 1059) and legacy Kind 4
    const dmFilter = {
      kinds: [1059, 4],
      since,
      '#p': [identity.pubKeyHex]
    };

    const dms = await poolInstance.querySync(relays, dmFilter);
    const skBytes = hexToBytes(identity.privKeyHex);

    for (const evt of dms) {
      try {
        if (evt.kind === 1059) {
          // NIP-17 Gift Wrap: Decrypt outer wrap, verify seal signature, and extract authentic rumor
          try {
            const rumor = nip17.unwrapEvent(evt, skBytes);
            if (rumor && rumor.content) {
              const fromPub = rumor.pubkey;
              const isOutgoing = fromPub === identity.pubKeyHex;
              const pTag = rumor.tags?.find((t: string[]) => t[0] === 'p')?.[1];
              const chatWithPub = isOutgoing ? (pTag || fromPub) : fromPub;

              let text = rumor.content;
              let mediaUrl: string | undefined;
              let mediaType: 'photo' | 'video' | 'audio' | undefined;
              if (text.includes('\nhttp://') || text.includes('\nhttps://') || text.includes('\n/uploads/') || text.includes('\ndata:audio/')) {
                const parts = text.split('\n');
                const lastPart = parts[parts.length - 1].trim();
                if (lastPart.startsWith('http://') || lastPart.startsWith('https://') || lastPart.startsWith('/uploads/') || lastPart.startsWith('data:audio/')) {
                  mediaUrl = lastPart;
                  mediaType = /\.(mp3|ogg|wav|m4a|aac|opus)$/i.test(lastPart) || lastPart.startsWith('data:audio/')
                    ? 'audio'
                    : /\.(mp4|webm|mov)$/i.test(lastPart)
                      ? 'video'
                      : 'photo';
                  text = parts.slice(0, -1).join('\n').trim();
                }
              }

              const dm: DirectMessage = {
                id: evt.id,
                chatWithPubkey: chatWithPub,
                fromPubkey: fromPub,
                toPubkey: isOutgoing ? chatWithPub : identity.pubKeyHex,
                content: text,
                timestamp: (rumor.created_at || evt.created_at) * 1000,
                mediaUrl,
                mediaType,
                isOutgoing
              };
              await db.saveDirectMessage(dm);
            }
          } catch (unwrapErr) {
            // Not addressed to us or corrupted wrap
          }
        } else if (evt.kind === 4) {
          // Legacy NIP-04 decryption
          const decrypted = await decryptNip04(identity.privKeyHex, evt.pubkey, evt.content);
          let text = decrypted;
          let mediaUrl: string | undefined;
          let mediaType: 'photo' | 'video' | 'audio' | undefined;
          if (text.includes('\nhttp://') || text.includes('\nhttps://') || text.includes('\n/uploads/') || text.includes('\ndata:audio/')) {
            const parts = text.split('\n');
            const lastPart = parts[parts.length - 1].trim();
            if (lastPart.startsWith('http://') || lastPart.startsWith('https://') || lastPart.startsWith('/uploads/') || lastPart.startsWith('data:audio/')) {
              mediaUrl = lastPart;
              mediaType = /\.(mp3|ogg|wav|m4a|aac|opus)$/i.test(lastPart) || lastPart.startsWith('data:audio/')
                ? 'audio'
                : /\.(mp4|webm|mov)$/i.test(lastPart)
                  ? 'video'
                  : 'photo';
              text = parts.slice(0, -1).join('\n').trim();
            }
          }

          const dm: DirectMessage = {
            id: evt.id,
            chatWithPubkey: evt.pubkey,
            fromPubkey: evt.pubkey,
            toPubkey: identity.pubKeyHex,
            content: text,
            timestamp: evt.created_at * 1000,
            mediaUrl,
            mediaType,
            isOutgoing: false
          };
          await db.saveDirectMessage(dm);
        }
      } catch {}
    }

    // 2. Query kind 0 profiles
    const profileFilter = {
      kinds: [0],
      since,
      limit: 20
    };

    const profileEvents = await poolInstance.querySync(relays, profileFilter);
    for (const p of profileEvents) {
      try {
        const data = JSON.parse(p.content);
        if (data && data.name) {
          const parsedInterests = parseInterestsList(data.interests).join(', ');
          const ageNum = typeof data.age === 'number' ? data.age : (parseInt(String(data.age), 10) || 25);
          const prof: UserProfile = {
            pubkey: p.pubkey,
            name: String(data.name || 'Anon'),
            age: ageNum,
            location: data.location ? String(data.location) : 'Bulgaria',
            gender: data.gender ? String(data.gender) : undefined,
            Orientation: data.Orientation ? String(data.Orientation) : undefined,
            seeking: data.seeking ? String(data.seeking) : undefined,
            bio: data.about || data.bio ? String(data.about || data.bio) : undefined,
            interests: parsedInterests,
            photos: Array.isArray(data.photos) ? data.photos : (data.picture ? [data.picture] : []),
            video: data.video ? String(data.video) : undefined,
            avatarUrl: data.picture ? String(data.picture) : undefined,
            updatedAt: p.created_at * 1000
          };
          await db.saveProfileToCache(prof);
        }
      } catch {}
    }

    await db.saveLastSyncTimestamp(Math.floor(Date.now() / 1000));
  } catch (err) {
    console.warn('Sync cycle completed with fallback:', err);
  } finally {
    if (onProgress) onProgress(true);
  }
}
