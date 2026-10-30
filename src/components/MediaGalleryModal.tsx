import React, { useState } from 'react';
import { UI_TRANSLATIONS, Language } from '../types';

interface MediaItem {
  url: string;
  type: 'photo' | 'video';
  caption?: string;
  sender?: string;
}

interface MediaGalleryModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  mediaItems: MediaItem[];
  title?: string;
}

export const MediaGalleryModal: React.FC<MediaGalleryModalProps> = ({
  lang,
  isOpen,
  onClose,
  mediaItems,
  title
}) => {
  const t = UI_TRANSLATIONS[lang];
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const currentItem = selectedIdx !== null ? mediaItems[selectedIdx] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#2B2B38] overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2B2B38]">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <h3 className="text-sm md:text-base font-bold text-white">
              {title || t.MEDIA_GALLERY} ({mediaItems.length})
            </h3>
          </div>
          <button
            onClick={() => {
              if (selectedIdx !== null) {
                setSelectedIdx(null);
              } else {
                onClose();
              }
            }}
            className="p-1 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {mediaItems.length === 0 ? (
            <div className="py-16 text-center text-xs text-[var(--text-muted)] font-mono">
              Няма споделени снимки или видеа в този чат.
            </div>
          ) : selectedIdx !== null && currentItem ? (
            /* Single Media View */
            <div className="flex flex-col items-center justify-center min-h-[400px]">
              <div className="relative max-h-[65vh] flex items-center justify-center">
                {currentItem.type === 'video' ? (
                  <video
                    src={currentItem.url}
                    controls
                    autoPlay
                    className="max-h-[60vh] max-w-full rounded-[var(--radius-sm)] border border-[#3A3A4E]"
                  />
                ) : (
                  <img
                    src={currentItem.url}
                    alt={currentItem.caption || 'Shared Media'}
                    className="max-h-[60vh] max-w-full object-contain rounded-[var(--radius-sm)] border border-[#3A3A4E]"
                  />
                )}
              </div>
              {currentItem.caption && (
                <p className="mt-3 text-xs text-[var(--text-muted)] text-center max-w-md">
                  {currentItem.caption}
                </p>
              )}
              <div className="flex items-center gap-4 mt-4">
                <button
                  disabled={selectedIdx <= 0}
                  onClick={() => setSelectedIdx(selectedIdx - 1)}
                  className="px-3 py-1.5 text-xs rounded bg-[var(--bg-surface-hover)] text-white disabled:opacity-30"
                >
                  ← Предишна
                </button>
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  {selectedIdx + 1} / {mediaItems.length}
                </span>
                <button
                  disabled={selectedIdx >= mediaItems.length - 1}
                  onClick={() => setSelectedIdx(selectedIdx + 1)}
                  className="px-3 py-1.5 text-xs rounded bg-[var(--bg-surface-hover)] text-white disabled:opacity-30"
                >
                  Следваща →
                </button>
              </div>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {mediaItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className="group relative aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-[var(--bg-main)] border border-[#2B2B38] cursor-pointer hover:border-[var(--primary)] transition-all"
                >
                  {item.type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-black/40">
                      <video src={item.url} className="w-full h-full object-cover opacity-75" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-9 h-9 rounded-full bg-[var(--secondary)]/90 flex items-center justify-center text-white shadow-lg">
                          <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={item.caption || `Media ${idx}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  {item.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 text-[10px] text-white truncate">
                      {item.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
