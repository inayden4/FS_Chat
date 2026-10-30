import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NostrIdentity, Language } from '../types';
import {
  voiceRelay,
  VoiceRecordingState,
  IncomingVoiceState,
  MAX_VOICE_DURATION_SEC,
  MAX_VOICE_BYTES
} from '../services/voiceRelay';

interface VoiceChatBarProps {
  lang: Language;
  identity: NostrIdentity;
  recipientPubkey: string;
  recipientName: string;
  onSendVoiceNote: (audioBlob: Blob, durationSec: number) => void;
  disabled?: boolean;
}

export const VoiceChatBar: React.FC<VoiceChatBarProps> = ({
  lang,
  identity,
  recipientPubkey,
  recipientName,
  onSendVoiceNote,
  disabled = false
}) => {
  const [recordState, setRecordState] = useState<VoiceRecordingState>({
    isRecording: false,
    isHandsFree: false,
    sessionId: null,
    targetPubkey: null,
    elapsedMs: 0,
    totalBytes: 0,
    chunksSent: 0,
    audioLevel: 0,
    maxMs: MAX_VOICE_DURATION_SEC * 1000,
    maxBytes: MAX_VOICE_BYTES,
    recordedBlob: null
  });

  const [incomingState, setIncomingState] = useState<IncomingVoiceState>({
    isPlaying: false,
    senderPubkey: null,
    sessionId: null,
    lastActivity: 0
  });

  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);
  const isPressingRef = useRef<boolean>(false);
  const spacebarDownRef = useRef<boolean>(false);

  // Subscribe to incoming ephemeral voice streams
  useEffect(() => {
    voiceRelay.startIncomingSubscription(identity);
    const unsubscribe = voiceRelay.onIncomingStateChange((incoming) => {
      setIncomingState(incoming);
    });
    return () => {
      unsubscribe();
    };
  }, [identity]);

  // Start Voice Stream
  const handleStartRecording = useCallback(async (handsFree: boolean = false) => {
    if (disabled || recordState.isRecording) return;
    setMicPermissionError(null);

    try {
      await voiceRelay.startRecording(
        identity,
        recipientPubkey,
        handsFree,
        (updated) => {
          setRecordState({ ...updated });
        }
      );
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setMicPermissionError(
        isDenied
          ? (lang === 'bg'
              ? 'Достъпът до микрофона е отказан. Моля, разрешете микрофона в настройките на браузъра.'
              : 'Microphone permission was denied. Please allow microphone in browser settings.')
          : (lang === 'bg'
              ? 'Грешка при достъп до микрофон или аудио уредба.'
              : 'Could not access microphone.')
      );
      isPressingRef.current = false;
    }
  }, [disabled, recordState.isRecording, identity, recipientPubkey, lang]);

  // Stop Voice Stream
  const handleStopRecording = useCallback(async (sendAsVoiceNote: boolean = false) => {
    if (!recordState.isRecording) return;
    isPressingRef.current = false;

    try {
      const res = await voiceRelay.stopRecording((updated) => {
        setRecordState({ ...updated });
      });

      if (sendAsVoiceNote && res.fullBlob && res.fullBlob.size > 500) {
        onSendVoiceNote(res.fullBlob, res.durationSec);
      }
    } catch (err) {
      console.warn('Stop recording note:', err);
    }
  }, [recordState.isRecording, onSendVoiceNote]);

  // Hold-to-Talk Mouse & Touch handlers
  const handleMouseDown = () => {
    if (recordState.isHandsFree) return;
    isPressingRef.current = true;
    handleStartRecording(false);
  };

  const handleMouseUp = () => {
    if (recordState.isHandsFree) return;
    if (isPressingRef.current) {
      handleStopRecording(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (recordState.isHandsFree) return;
    e.preventDefault();
    isPressingRef.current = true;
    handleStartRecording(false);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (recordState.isHandsFree) return;
    e.preventDefault();
    if (isPressingRef.current) {
      handleStopRecording(false);
    }
  };

  // Keyboard Spacebar listener on desktop (when user is not typing in a text field)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag === 'textarea' || activeTag === 'input') {
          return; // Allow normal typing in textarea
        }
        e.preventDefault();
        if (!spacebarDownRef.current && !recordState.isRecording) {
          spacebarDownRef.current = true;
          handleStartRecording(false);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag === 'textarea' || activeTag === 'input') {
          return;
        }
        e.preventDefault();
        if (spacebarDownRef.current) {
          spacebarDownRef.current = false;
          handleStopRecording(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [recordState.isRecording, handleStartRecording, handleStopRecording]);

  // Calculations for progress & max limits
  const elapsedSec = Math.floor(recordState.elapsedMs / 1000);
  const timePercent = Math.min(100, Math.round((recordState.elapsedMs / (MAX_VOICE_DURATION_SEC * 1000)) * 100));
  const bytesPercent = Math.min(100, Math.round((recordState.totalBytes / MAX_VOICE_BYTES) * 100));
  const progressPercent = Math.max(timePercent, bytesPercent);
  const remainingSec = Math.max(0, MAX_VOICE_DURATION_SEC - elapsedSec);
  const currentKb = (recordState.totalBytes / 1024).toFixed(1);
  const maxKb = (MAX_VOICE_BYTES / 1024).toFixed(0);

  // Check if incoming audio is from our active chat counterpart
  const isCounterpartSpeaking = incomingState.isPlaying && incomingState.senderPubkey === recipientPubkey;

  return (
    <div className="w-full space-y-2 select-none">
      {/* 1. Counterpart is speaking animation banner: "Слушате [Име]..." */}
      {isCounterpartSpeaking && (
        <div className="px-3.5 py-2.5 rounded-[var(--radius-md)] bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 shadow-xl backdrop-blur-md flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 shrink-0">
              <span className="text-base animate-pulse">🔊</span>
              <span className="absolute inset-0 rounded-full border border-emerald-400 animate-ping opacity-40" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-white flex items-center gap-1.5 flex-wrap">
                <span>
                  {lang === 'bg' ? `Слушате ${recipientName}...` : `Listening to ${recipientName}...`}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold uppercase">
                  VoNR • Без IP
                </span>
              </div>
              <div className="text-[10px] text-emerald-300/80">
                {lang === 'bg'
                  ? 'Звукът се предава на живо през Nostr релета (Криптирано, NIP-04/Kind 20042)'
                  : 'Live audio via Nostr relays (End-to-End Encrypted, NIP-04/Kind 20042)'}
              </div>
            </div>
          </div>

          {/* Equalizer animation bars */}
          <div className="flex items-center gap-1 shrink-0 h-6">
            <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-3" />
            <span className="w-1 bg-emerald-300 rounded-full animate-[pulse_0.8s_ease-in-out_infinite_0.1s] h-5" />
            <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.2s] h-2" />
            <span className="w-1 bg-emerald-200 rounded-full animate-[pulse_0.7s_ease-in-out_infinite_0.15s] h-6" />
            <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.9s_ease-in-out_infinite_0.25s] h-3" />
          </div>
        </div>
      )}

      {/* 2. Active Recording Overlay & Progress Indicator */}
      {recordState.isRecording && (
        <div className="p-3 rounded-[var(--radius-md)] bg-rose-950/85 border border-rose-500/60 shadow-2xl backdrop-blur-md space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {/* Pulsating Recording Dot */}
              <div
                className="w-4 h-4 rounded-full bg-rose-500 shadow-[0_0_12px_#f43f5e] transition-transform duration-100 flex items-center justify-center shrink-0"
                style={{ transform: `scale(${1 + (recordState.audioLevel / 100) * 0.4})` }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              </div>

              <div>
                <div className="text-xs font-extrabold text-white flex items-center gap-2">
                  <span>{lang === 'bg' ? 'Гласово излъчване на живо...' : 'Live Voice Streaming...'}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase font-mono font-bold">
                    Opus 16 kbps
                  </span>
                  {recordState.isHandsFree && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                      {lang === 'bg' ? 'Свободни ръце' : 'Hands-free'}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-rose-200/80 font-mono">
                  {lang === 'bg'
                    ? `Изпратени ${recordState.chunksSent} пакета директно през релетата (0% IP trace)`
                    : `Sent ${recordState.chunksSent} packets over relays (0% IP trace)`}
                </div>
              </div>
            </div>

            {/* Quick Actions while recording */}
            <div className="flex items-center gap-1.5 shrink-0">
              {recordState.isHandsFree ? (
                <button
                  type="button"
                  onClick={() => handleStopRecording(false)}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow cursor-pointer transition-colors"
                >
                  {lang === 'bg' ? 'Край на разговора' : 'End Call'}
                </button>
              ) : (
                <span className="text-[10px] text-rose-300/80 font-semibold hidden sm:inline">
                  {lang === 'bg' ? 'Отпусни за край' : 'Release to stop'}
                </span>
              )}
              {/* Also save and send as persistent voice note */}
              <button
                type="button"
                onClick={() => handleStopRecording(true)}
                title={lang === 'bg' ? 'Запази и изпрати като гласово съобщение в чата' : 'Send as voice note in chat'}
                className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold shadow flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>💬</span>
                <span>{lang === 'bg' ? 'И в чата' : 'As Note'}</span>
              </button>
            </div>
          </div>

          {/* Progress Bar Displaying Maximum Allowed Time / Megabytes Filling Up */}
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-rose-500/30 p-[1px]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progressPercent > 80
                    ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                    : progressPercent > 50
                      ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                      : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Detailed Filling Up Counter */}
            <div className="flex items-center justify-between text-[10px] font-mono text-rose-200">
              <span className="flex items-center gap-1">
                <span>⏱️</span>
                <span className="font-bold text-white">
                  0:{elapsedSec.toString().padStart(2, '0')}
                </span>
                <span className="text-white/60">/ 1:00 мин</span>
              </span>

              <span className="font-semibold text-rose-300">
                {lang === 'bg' ? `Остава: ${remainingSec} сек` : `Remaining: ${remainingSec}s`}
              </span>

              <span className="flex items-center gap-1">
                <span>📦</span>
                <span className="font-bold text-white">{currentKb} KB</span>
                <span className="text-white/60">/ {maxKb} KB ({progressPercent}%)</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Microphone Permission Error Banner */}
      {micPermissionError && (
        <div className="p-2.5 rounded-[var(--radius-sm)] bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-2 shadow">
          <span>⚠️ {micPermissionError}</span>
          <button
            type="button"
            onClick={() => setMicPermissionError(null)}
            className="text-xs text-white/70 hover:text-white cursor-pointer px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4. Voice Controls Bar (Push-to-Talk button, Hands-Free toggle, Help tooltip) */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)]/80 border border-[#2B2B3E] text-xs">
        {/* Main Push-to-Talk Button */}
        <div className="flex items-center gap-2 flex-1">
          <button
            type="button"
            id="btn-voice-push-to-talk"
            disabled={disabled}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-[var(--radius-sm)] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer select-none shadow active:scale-95 ${
              recordState.isRecording
                ? 'bg-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.7)] animate-pulse'
                : 'bg-emerald-600/90 hover:bg-emerald-500 text-white hover:shadow-[0_0_10px_rgba(52,211,153,0.4)]'
            }`}
            title={
              lang === 'bg'
                ? 'Задръж с мишката/пръста или задръж Spacebar за разговор на живо през Nostr релета'
                : 'Hold mouse/touch or Spacebar to talk live over Nostr relays'
            }
          >
            <span className="text-base">{recordState.isRecording ? '🎙️🔴' : '🎙️'}</span>
            <span>
              {recordState.isRecording
                ? lang === 'bg'
                  ? 'ГОВОРИТЕ (На живо)...'
                  : 'TALKING (Live)...'
                : lang === 'bg'
                  ? 'Задръж за разговор (PTT)'
                  : 'Hold to Talk (PTT)'}
            </span>
          </button>

          {/* Hands-Free Toggle Button */}
          <button
            type="button"
            onClick={() => {
              if (recordState.isRecording) {
                handleStopRecording(false);
              } else {
                handleStartRecording(true);
              }
            }}
            className={`px-3 py-2 rounded-[var(--radius-sm)] border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              recordState.isRecording && recordState.isHandsFree
                ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                : 'bg-[#232333] hover:bg-[#2F2F44] border-[#38384E] text-white/90'
            }`}
            title={
              lang === 'bg'
                ? 'Превключи режим Свободни ръце (Кликни за старт / кликни за стоп)'
                : 'Toggle Hands-Free (Click once to talk, click again to stop)'
            }
          >
            <span>{recordState.isRecording && recordState.isHandsFree ? '⏹️' : '🔒'}</span>
            <span className="hidden sm:inline">
              {recordState.isRecording && recordState.isHandsFree
                ? lang === 'bg'
                  ? 'Спри говора'
                  : 'Stop'
                : lang === 'bg'
                  ? 'Свободни ръце'
                  : 'Hands-free'}
            </span>
          </button>
        </div>

        {/* Info & Privacy guarantee badge */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-medium shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{lang === 'bg' ? '0% IP размяна' : '0% IP trace'}</span>
          <span className="text-[10px] text-white/50 font-mono">• Nostr Relays • E2EE</span>
        </div>
      </div>
    </div>
  );
};
