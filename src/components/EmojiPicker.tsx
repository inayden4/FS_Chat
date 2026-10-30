import React, { useState, useRef, useEffect } from 'react';
import { Language } from '../types';

interface EmojiCategory {
  id: string;
  nameBg: string;
  nameEn: string;
  icon: string;
  emojis: string[];
}

export const EMOJI_GALLERIES: EmojiCategory[] = [
  {
    id: 'love',
    nameBg: 'Любов и Флирт',
    nameEn: 'Love & Romance',
    icon: '❤️',
    emojis: [
      '❤️', '💜', '💖', '💘', '💝', '💓', '💞', '💕', '💌', '🌹',
      '🥀', '🌺', '🌸', '💋', '🫦', '💍', '🥂', '🍷', '🍾', '🍓',
      '🍒', '🍫', '🧸', '🔥', '✨', '💫', '🕯️', '🛁', '😍', '🥰',
      '😘', '😻', '🤤', '😈', '🌶️', '🍑', '🍆', '👀', '🫠', '🤭'
    ]
  },
  {
    id: 'smileys',
    nameBg: 'Емоции и Настроение',
    nameEn: 'Smileys & Expressions',
    icon: '😄',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🥹', '😇',
      '😉', '😊', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤫',
      '🤔', '🤐', '🤨', '😐', '😑', '😶', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😪', '😴', '😷', '🥵', '🥶', '🥴', '😵', '🤯',
      '🥳', '😎', '🤓', '🧐', '💀', '👻', '💃', '🕺', '🫶', '✌️',
      '🤞', '🤙', '👍', '👏', '🙌', '🤝', '💪', '🙏', '🎉', '🎊'
    ]
  },
  {
    id: 'cypherpunk',
    nameBg: 'Nostr, Cypherpunk & Символи',
    nameEn: 'Nostr & Symbols',
    icon: '⚡️',
    emojis: [
      '⚡️', '₿', '🔒', '🔓', '🔑', '🗝️', '🪐', '🛸', '👾', '🕶️',
      '🚀', '💎', '🛡️', '🔮', '💻', '🌐', '🌙', '☀️', '⭐', '🌟',
      '🍸', '🍺', '🎲', '🎯', '👑', '🏆', '💰', '💸', '📡', '🦾',
      '🦿', '🧠', '👁️', '🧬', '🥽', '🕹️', '♟️', '🎭', '🎨', '🏎️',
      '🏍️', '🏝️', '🏕️', '🏙️', '💡', '🔋', '🔌', '🛰️', '🗺️', '🧭'
    ]
  },
  {
    id: 'activities',
    nameBg: 'Парти, Храна & Развлечения',
    nameEn: 'Party & Leisure',
    icon: '🍾',
    emojis: [
      '🍕', '🍣', '🍔', '🌮', '🥗', '🍦', '🍰', '☕️', '🧃', '🍹',
      '🍻', '🍿', '🎬', '🎧', '🎸', '🎹', '🎷', '🏖️', '🌅', '🎡',
      '🎢', '✈️', '⛵️', '⛺️', '🏕️', '🎈', '🎁', '🎀', '🪄', '🪩'
    ]
  }
];

interface EmojiPickerProps {
  lang: Language;
  onSelectEmoji: (emoji: string) => void;
  onClose?: () => void;
  className?: string;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  lang,
  onSelectEmoji,
  onClose,
  className = ''
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('love');
  const pickerRef = useRef<HTMLDivElement>(null);

  const selectedGallery = EMOJI_GALLERIES.find(g => g.id === activeCategory) || EMOJI_GALLERIES[0];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className={`z-50 w-72 sm:w-80 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333345] shadow-2xl overflow-hidden flex flex-col ${className}`}
    >
      {/* Category Tabs Header */}
      <div className="flex items-center justify-between border-b border-[#2B2B38] bg-[var(--bg-main)]/80 px-2 py-1.5">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {EMOJI_GALLERIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2 py-1 rounded-[var(--radius-sm)] text-xs flex items-center gap-1 transition-colors ${
                activeCategory === cat.id
                  ? 'bg-[var(--primary)] text-white font-bold'
                  : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)]'
              }`}
              title={lang === 'bg' ? cat.nameBg : cat.nameEn}
            >
              <span>{cat.icon}</span>
            </button>
          ))}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-white p-1 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Category Title Banner */}
      <div className="px-3 py-1 bg-[var(--bg-surface-hover)]/40 border-b border-[#252533] text-[10px] text-[var(--text-muted)] font-semibold flex items-center justify-between">
        <span>{lang === 'bg' ? selectedGallery.nameBg : selectedGallery.nameEn}</span>
        <span className="text-[9px] font-mono">{selectedGallery.emojis.length}</span>
      </div>

      {/* Emoji Grid */}
      <div className="p-2.5 grid grid-cols-7 sm:grid-cols-8 gap-1 max-h-48 overflow-y-auto">
        {selectedGallery.emojis.map((emoji, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectEmoji(emoji)}
            className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center text-lg hover:bg-[var(--bg-surface-hover)] hover:scale-120 transition-transform active:scale-95 cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
