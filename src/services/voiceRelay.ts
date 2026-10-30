/**
 * Voice over Nostr Relays (VoNR) Engine & Voice Note Service
 * 
 * 100% ANONYMOUS: Zero P2P WebRTC connection. User IP addresses are NEVER exchanged!
 * Real-time audio chunks are End-to-End Encrypted (NIP-04/NIP-44) and routed
 * strictly through volunteer Nostr relays using Ephemeral Events (Kind 20042 & 20043).
 * Relays broadcast them in real time and drop them immediately without saving to disk.
 */

import { finalizeEvent, SimplePool } from 'nostr-tools';
import { NostrIdentity } from '../types';
import { getRelayPool, hexToBytes, encryptNip04, decryptNip04, ensure64HexPubkey, DEFAULT_RELAYS } from './nostr';

// Ephemeral Nostr Event Kinds for Real-Time Streaming
export const NOSTR_KIND_VOICE_CHUNK = 20042;  // Ephemeral Voice Audio Chunk
export const NOSTR_KIND_VOICE_SIGNAL = 20043; // Ephemeral Voice State / Signaling (start, stop, ping)

// Constraints & Limits
export const MAX_VOICE_DURATION_SEC = 60;        // Max 60 seconds (1 minute) per recording
export const MAX_VOICE_BYTES = 120 * 1024;       // Max ~120 KB at 16 kbps
export const TARGET_BITRATE = 16000;             // 16 kbps low-bitrate mono Opus
export const CHUNK_TIMESLICE_MS = 1200;          // 1.2s per audio packet for responsive low latency

export interface VoiceRecordingState {
  isRecording: boolean;
  isHandsFree: boolean;
  sessionId: string | null;
  targetPubkey: string | null;
  elapsedMs: number;
  totalBytes: number;
  chunksSent: number;
  audioLevel: number; // 0 - 100 volume level for pulsating UI
  maxMs: number;
  maxBytes: number;
  recordedBlob: Blob | null;
}

export interface IncomingVoiceState {
  isPlaying: boolean;
  senderPubkey: string | null;
  sessionId: string | null;
  lastActivity: number;
}

/**
 * Determine best supported browser audio mime type across PC, Android, and iOS
 */
export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }

  const preferredTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac'
  ];

  for (const t of preferredTypes) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }

  return '';
}

/**
 * Convert Blob to Base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      // Extract pure base64 without data URL scheme
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert Base64 string back to Audio Blob
 */
export function base64ToAudioBlob(base64: string, mime: string = 'audio/webm'): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// -------------------------------------------------------------
// Audio Level Analyzer (Web Audio API)
// -------------------------------------------------------------
class AudioVolumeMeter {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;
  private onLevelCallback: ((level: number) => void) | null = null;

  start(stream: MediaStream, onLevel: (level: number) => void) {
    this.onLevelCallback = onLevel;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;
      this.source = this.audioCtx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      const sample = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        // Normalize to 0-100 range
        const level = Math.min(100, Math.round((avg / 128) * 100));
        if (this.onLevelCallback) {
          this.onLevelCallback(level);
        }
        this.animFrameId = requestAnimationFrame(sample);
      };
      this.animFrameId = requestAnimationFrame(sample);
    } catch (e) {
      console.warn('Volume meter failed to init:', e);
    }
  }

  stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    try {
      this.source?.disconnect();
      this.analyser?.disconnect();
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close();
      }
    } catch {}
    this.source = null;
    this.analyser = null;
    this.audioCtx = null;
    this.onLevelCallback = null;
  }
}

// -------------------------------------------------------------
// Live Sequential Audio Queue Player
// -------------------------------------------------------------
export class VoiceAudioQueuePlayer {
  private queue: string[] = []; // Array of object URLs
  private currentAudio: HTMLAudioElement | null = null;
  private isPlayingQueue: boolean = false;
  private onStatusChange?: (isPlaying: boolean) => void;
  private watchdogTimer: any = null;

  constructor(onStatusChange?: (isPlaying: boolean) => void) {
    this.onStatusChange = onStatusChange;
  }

  enqueue(blob: Blob) {
    const url = URL.createObjectURL(blob);
    this.queue.push(url);
    if (!this.isPlayingQueue) {
      this.playNext();
    }
  }

  private playNext() {
    if (this.queue.length === 0) {
      this.isPlayingQueue = false;
      if (this.onStatusChange) this.onStatusChange(false);
      return;
    }

    this.isPlayingQueue = true;
    if (this.onStatusChange) this.onStatusChange(true);

    const url = this.queue.shift()!;
    const audio = new Audio(url);
    this.currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      this.playNext();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      this.playNext();
    };

    audio.play().catch(err => {
      console.warn('Auto audio chunk play blocked by browser policy:', err);
      URL.revokeObjectURL(url);
      this.playNext();
    });

    // Reset watchdog: if audio hangs or gets stuck, force advance
    clearTimeout(this.watchdogTimer);
    this.watchdogTimer = setTimeout(() => {
      if (this.currentAudio === audio) {
        URL.revokeObjectURL(url);
        this.playNext();
      }
    }, 4000);
  }

  clear() {
    clearTimeout(this.watchdogTimer);
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch {}
      this.currentAudio = null;
    }
    this.queue.forEach(url => URL.revokeObjectURL(url));
    this.queue = [];
    this.isPlayingQueue = false;
    if (this.onStatusChange) this.onStatusChange(false);
  }
}

// -------------------------------------------------------------
// Voice over Nostr Relay Controller Singleton
// -------------------------------------------------------------
export class VoiceRelayManager {
  private static instance: VoiceRelayManager | null = null;

  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private volumeMeter: AudioVolumeMeter = new AudioVolumeMeter();
  private timerInterval: any = null;

  // Active Session details
  private currentSessionId: string | null = null;
  private targetPubkey: string | null = null;
  private myIdentity: NostrIdentity | null = null;
  private currentSeq: number = 0;
  private totalBytesRecorded: number = 0;
  private startTimestamp: number = 0;
  private recordedBlobs: Blob[] = [];
  private selectedMime: string = '';

  // Incoming Voice Subscription
  private activeSub: any = null;
  private incomingQueue: VoiceAudioQueuePlayer;
  private incomingStatusCallbacks: Set<(state: IncomingVoiceState) => void> = new Set();
  private currentIncomingState: IncomingVoiceState = {
    isPlaying: false,
    senderPubkey: null,
    sessionId: null,
    lastActivity: 0
  };

  private constructor() {
    this.incomingQueue = new VoiceAudioQueuePlayer((isPlaying) => {
      this.currentIncomingState.isPlaying = isPlaying;
      if (!isPlaying) {
        this.currentIncomingState.senderPubkey = null;
        this.currentIncomingState.sessionId = null;
      }
      this.notifyIncomingState();
    });
  }

  public static getInstance(): VoiceRelayManager {
    if (!VoiceRelayManager.instance) {
      VoiceRelayManager.instance = new VoiceRelayManager();
    }
    return VoiceRelayManager.instance;
  }

  public onIncomingStateChange(cb: (state: IncomingVoiceState) => void): () => void {
    this.incomingStatusCallbacks.add(cb);
    cb(this.currentIncomingState);
    return () => this.incomingStatusCallbacks.delete(cb);
  }

  private notifyIncomingState() {
    this.incomingStatusCallbacks.forEach(cb => cb({ ...this.currentIncomingState }));
  }

  /**
   * Subscribe to incoming ephemeral voice streams (Kind 20042 & 20043) for the current user
   */
  public startIncomingSubscription(identity: NostrIdentity, relays: string[] = DEFAULT_RELAYS) {
    if (this.activeSub) {
      try { this.activeSub.close(); } catch {}
      this.activeSub = null;
    }

    const pool = getRelayPool();
    const myPubkeyHex = ensure64HexPubkey(identity.pubKeyHex);

    const filter = {
      kinds: [NOSTR_KIND_VOICE_CHUNK, NOSTR_KIND_VOICE_SIGNAL],
      '#p': [myPubkeyHex],
      since: Math.floor(Date.now() / 1000) - 30 // recent
    };

    try {
      this.activeSub = pool.subscribeMany(relays, filter, {
        onevent: async (event: any) => {
          try {
            const senderPubkey = event.pubkey;
            // Ignore self-broadcasts
            if (senderPubkey === myPubkeyHex) return;

            // Decrypt event payload using NIP-04 E2EE
            const decryptedJson = await decryptNip04(identity.privKeyHex, senderPubkey, event.content);
            const payload = JSON.parse(decryptedJson);

            if (event.kind === NOSTR_KIND_VOICE_SIGNAL) {
              if (payload.type === 'start') {
                this.currentIncomingState = {
                  isPlaying: true,
                  senderPubkey,
                  sessionId: payload.session,
                  lastActivity: Date.now()
                };
                this.notifyIncomingState();
              } else if (payload.type === 'stop') {
                this.currentIncomingState.lastActivity = Date.now();
                // Queue will finish remaining and notify
              }
            } else if (event.kind === NOSTR_KIND_VOICE_CHUNK) {
              if (payload.data) {
                this.currentIncomingState.senderPubkey = senderPubkey;
                this.currentIncomingState.sessionId = payload.session;
                this.currentIncomingState.lastActivity = Date.now();
                this.notifyIncomingState();

                const audioBlob = base64ToAudioBlob(payload.data, payload.mime || 'audio/webm');
                this.incomingQueue.enqueue(audioBlob);
              }
            }
          } catch (err) {
            console.warn('Voice chunk processing warning:', err);
          }
        }
      });
    } catch (e) {
      console.warn('Failed to start voice subscription:', e);
    }
  }

  /**
   * Start Live Voice over Nostr Recording
   */
  public async startRecording(
    identity: NostrIdentity,
    recipientPubkeyHex: string,
    isHandsFree: boolean,
    onStateUpdate: (state: VoiceRecordingState) => void,
    relays: string[] = DEFAULT_RELAYS
  ): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      return;
    }

    this.myIdentity = identity;
    this.targetPubkey = ensure64HexPubkey(recipientPubkeyHex);
    this.currentSessionId = `vsession-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.currentSeq = 0;
    this.totalBytesRecorded = 0;
    this.recordedBlobs = [];
    this.startTimestamp = Date.now();
    this.selectedMime = getSupportedAudioMimeType();

    // 1. Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 24000
      }
    });
    this.mediaStream = stream;

    // 2. Audio Level Analyzer for real-time waveform pulsation
    let currentAudioLevel = 0;
    this.volumeMeter.start(stream, (level) => {
      currentAudioLevel = level;
      onStateUpdate({
        isRecording: true,
        isHandsFree,
        sessionId: this.currentSessionId,
        targetPubkey: this.targetPubkey,
        elapsedMs: Date.now() - this.startTimestamp,
        totalBytes: this.totalBytesRecorded,
        chunksSent: this.currentSeq,
        audioLevel: currentAudioLevel,
        maxMs: MAX_VOICE_DURATION_SEC * 1000,
        maxBytes: MAX_VOICE_BYTES,
        recordedBlob: null
      });
    });

    // 3. Send Start Signaling Ephemeral Event (Kind 20043)
    this.sendSignalEvent('start', relays).catch(e => console.warn('Start signal warning:', e));

    // 4. Initialize MediaRecorder with Opus 16 kbps
    const options: MediaRecorderOptions = {
      audioBitsPerSecond: TARGET_BITRATE
    };
    if (this.selectedMime) {
      options.mimeType = this.selectedMime;
    }

    const recorder = new MediaRecorder(stream, options);
    this.mediaRecorder = recorder;

    recorder.ondataavailable = async (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        this.recordedBlobs.push(e.data);
        this.totalBytesRecorded += e.data.size;
        this.currentSeq += 1;

        // Broadcast audio chunk to Nostr relays
        try {
          const b64 = await blobToBase64(e.data);
          await this.sendChunkEvent(b64, relays);
        } catch (sendErr) {
          console.warn('Failed to publish voice chunk:', sendErr);
        }

        onStateUpdate({
          isRecording: true,
          isHandsFree,
          sessionId: this.currentSessionId,
          targetPubkey: this.targetPubkey,
          elapsedMs: Date.now() - this.startTimestamp,
          totalBytes: this.totalBytesRecorded,
          chunksSent: this.currentSeq,
          audioLevel: currentAudioLevel,
          maxMs: MAX_VOICE_DURATION_SEC * 1000,
          maxBytes: MAX_VOICE_BYTES,
          recordedBlob: null
        });

        // Auto-stop if reached duration or byte threshold
        const elapsed = Date.now() - this.startTimestamp;
        if (elapsed >= MAX_VOICE_DURATION_SEC * 1000 || this.totalBytesRecorded >= MAX_VOICE_BYTES) {
          this.stopRecording(onStateUpdate, relays);
        }
      }
    };

    // Timer check
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.startTimestamp;
      if (elapsed >= MAX_VOICE_DURATION_SEC * 1000) {
        this.stopRecording(onStateUpdate, relays);
      }
    }, 500);

    // Start slicing chunks every 1200ms
    recorder.start(CHUNK_TIMESLICE_MS);
  }

  /**
   * Stop Recording, send 'stop' signaling, and return complete audio blob
   */
  public async stopRecording(
    onStateUpdate?: (state: VoiceRecordingState) => void,
    relays: string[] = DEFAULT_RELAYS
  ): Promise<{ fullBlob: Blob; durationSec: number; totalBytes: number }> {
    clearInterval(this.timerInterval);
    this.timerInterval = null;

    this.volumeMeter.stop();

    const elapsedMs = Math.max(1000, Date.now() - this.startTimestamp);
    const durationSec = Math.round(elapsedMs / 1000);

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }

    // Stop audio mic tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      this.mediaStream = null;
    }

    // Send Stop Signaling Ephemeral Event
    try {
      await this.sendSignalEvent('stop', relays);
    } catch {}

    // Combine recorded chunks
    const fullBlob = new Blob(this.recordedBlobs, {
      type: this.selectedMime || 'audio/webm'
    });

    const finalState: VoiceRecordingState = {
      isRecording: false,
      isHandsFree: false,
      sessionId: null,
      targetPubkey: null,
      elapsedMs,
      totalBytes: this.totalBytesRecorded,
      chunksSent: this.currentSeq,
      audioLevel: 0,
      maxMs: MAX_VOICE_DURATION_SEC * 1000,
      maxBytes: MAX_VOICE_BYTES,
      recordedBlob: fullBlob
    };

    if (onStateUpdate) {
      onStateUpdate(finalState);
    }

    this.mediaRecorder = null;
    return {
      fullBlob,
      durationSec,
      totalBytes: this.totalBytesRecorded
    };
  }

  /**
   * Send End-to-End Encrypted Ephemeral Voice Chunk (Kind 20042)
   */
  private async sendChunkEvent(base64Data: string, relays: string[]): Promise<void> {
    if (!this.myIdentity || !this.targetPubkey) return;

    const payload = {
      session: this.currentSessionId,
      seq: this.currentSeq,
      type: 'chunk',
      mime: this.selectedMime || 'audio/webm',
      data: base64Data,
      durationMs: CHUNK_TIMESLICE_MS,
      timestamp: Date.now()
    };

    const ciphertext = await encryptNip04(
      this.myIdentity.privKeyHex,
      this.targetPubkey,
      JSON.stringify(payload)
    );

    const unsigned = {
      kind: NOSTR_KIND_VOICE_CHUNK,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', this.targetPubkey],
        ['session', this.currentSessionId || ''],
        ['seq', String(this.currentSeq)]
      ],
      content: ciphertext
    };

    const signed = finalizeEvent(unsigned, hexToBytes(this.myIdentity.privKeyHex));
    const pool = getRelayPool();
    try {
      pool.publish(relays, signed);
    } catch {}
  }

  /**
   * Send End-to-End Encrypted Ephemeral Voice Signal (Kind 20043)
   */
  private async sendSignalEvent(type: 'start' | 'stop', relays: string[]): Promise<void> {
    if (!this.myIdentity || !this.targetPubkey) return;

    const payload = {
      session: this.currentSessionId,
      type,
      timestamp: Date.now()
    };

    const ciphertext = await encryptNip04(
      this.myIdentity.privKeyHex,
      this.targetPubkey,
      JSON.stringify(payload)
    );

    const unsigned = {
      kind: NOSTR_KIND_VOICE_SIGNAL,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', this.targetPubkey],
        ['session', this.currentSessionId || ''],
        ['type', type]
      ],
      content: ciphertext
    };

    const signed = finalizeEvent(unsigned, hexToBytes(this.myIdentity.privKeyHex));
    const pool = getRelayPool();
    try {
      pool.publish(relays, signed);
    } catch {}
  }

  /**
   * Cleanup all resources
   */
  public destroy() {
    this.volumeMeter.stop();
    this.incomingQueue.clear();
    if (this.activeSub) {
      try { this.activeSub.close(); } catch {}
      this.activeSub = null;
    }
  }
}

export const voiceRelay = VoiceRelayManager.getInstance();
