import React, { useState, useRef, useEffect } from 'react';
import { normalizeMediaUrl } from '../services/mediaUpload';

interface VoiceMessagePlayerProps {
  src: string;
  duration?: number;
  isMine?: boolean;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  src,
  duration: initialDuration,
  isMine = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const safeSrc = normalizeMediaUrl(src);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [safeSrc]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Voice play blocked:', err);
      });
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRate = playbackRate === 1.0 ? 1.5 : playbackRate === 1.5 ? 2.0 : 1.0;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newPercent = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = newPercent * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Waveform bars heights (deterministic decorative shape)
  const waveBars = [
    30, 45, 75, 90, 60, 40, 80, 100, 65, 45, 90, 70, 40, 60, 85, 50, 30, 70, 95, 60, 40, 75, 55, 35
  ];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`rounded-xl p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3 select-none transition-all ${
        isMine
          ? 'bg-white/10 border border-white/15 text-white'
          : 'bg-[#181824] border border-[#2B2B3E] text-white shadow-inner'
      }`}
    >
      <audio ref={audioRef} src={safeSrc} preload="metadata" />

      {/* Play / Pause Circular Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-md transition-all active:scale-95 ${
          isPlaying
            ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
            : isMine
              ? 'bg-white hover:bg-white/90 text-purple-900'
              : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white'
        }`}
        title={isPlaying ? 'Пауза' : 'Пусни гласовото съобщение'}
        aria-label={isPlaying ? 'Pause' : 'Play voice message'}
      >
        {isPlaying ? (
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      {/* Middle: Waveform & Seeker */}
      <div className="flex-1 min-w-[140px] sm:min-w-[180px] space-y-1">
        {/* Clickable Waveform container */}
        <div
          onClick={handleSeek}
          className="h-7 flex items-center gap-[2px] sm:gap-[3px] cursor-pointer group py-1"
          title="Превърти аудиото"
        >
          {waveBars.map((heightPercent, idx) => {
            const barPosPercent = (idx / waveBars.length) * 100;
            const isPlayed = barPosPercent <= progressPercent;

            return (
              <div
                key={idx}
                style={{ height: `${Math.max(20, heightPercent)}%` }}
                className={`flex-1 rounded-full transition-all duration-150 ${
                  isPlayed
                    ? isMine
                      ? 'bg-white'
                      : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                    : 'bg-white/25 group-hover:bg-white/40'
                }`}
              />
            );
          })}
        </div>

        {/* Timers & Status info */}
        <div className="flex items-center justify-between text-[10px] text-white/70 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">
              {isPlaying ? '• На живо' : 'Глас'}
            </span>
            <span>{formatTime(duration)}</span>
          </span>
        </div>
      </div>

      {/* Speed multiplier toggle */}
      <button
        type="button"
        onClick={cycleSpeed}
        className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-white/10 hover:bg-white/20 text-white/90 transition-colors shrink-0 cursor-pointer"
        title="Скорост на възпроизвеждане"
      >
        {playbackRate.toFixed(1)}x
      </button>
    </div>
  );
};
