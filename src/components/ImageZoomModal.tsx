import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language, UI_TRANSLATIONS } from '../types';
import { normalizeMediaUrl } from '../services/mediaUpload';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  src?: string;
  images?: string[];
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  title?: string;
  lang?: Language;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  isOpen,
  onClose,
  src,
  images,
  currentIndex = 0,
  onIndexChange,
  title,
  lang = 'bg'
}) => {
  const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.bg;

  // Active image URL resolution
  const activeUrl = images && images.length > 0
    ? normalizeMediaUrl(images[currentIndex] || '')
    : normalizeMediaUrl(src || '');

  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);
  // 'fit' means contained within viewport; 'original' / numeric scale is zoomed
  const [zoomMode, setZoomMode] = useState<'fit' | 'original' | 'custom'>('fit');
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset zoom on image change or open
  useEffect(() => {
    if (isOpen) {
      setZoomMode('fit');
      setZoomScale(1);
      setPanPosition({ x: 0, y: 0 });
      setNaturalDimensions(null);
    }
  }, [isOpen, activeUrl]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && images && images.length > 1 && onIndexChange) {
        onIndexChange((currentIndex + 1) % images.length);
      } else if (e.key === 'ArrowLeft' && images && images.length > 1 && onIndexChange) {
        onIndexChange((currentIndex - 1 + images.length) % images.length);
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images, onIndexChange, onClose]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    setNaturalDimensions({
      width: target.naturalWidth,
      height: target.naturalHeight
    });
  };

  const handleSetFit = () => {
    setZoomMode('fit');
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleSetOriginal = () => {
    setZoomMode('original');
    setZoomScale(1); // 1 = 100% natural resolution
    setPanPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoomMode('custom');
    setZoomScale(prev => Math.min(prev + 0.25, 4));
  };

  const handleZoomOut = () => {
    setZoomMode('custom');
    setZoomScale(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleResetZoom = () => {
    setZoomMode('fit');
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
  };

  // Drag-to-pan handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoomMode === 'fit') return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panPosition.x,
      panY: panPosition.y
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setPanPosition({
      x: dragStartRef.current.panX + deltaX,
      y: dragStartRef.current.panY + deltaY
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom in
      setZoomMode('custom');
      setZoomScale(prev => Math.min(prev + 0.15, 4));
    } else {
      // Zoom out
      setZoomMode('custom');
      setZoomScale(prev => Math.max(prev - 0.15, 0.3));
    }
  }, []);

  if (!isOpen || !activeUrl) return null;

  const isNavigable = images && images.length > 1;

  return (
    <div
      className="fixed inset-0 z-70 bg-black/95 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none"
      onClick={onClose}
    >
      {/* Top Controls Toolbar */}
      <div
        className="w-full bg-[#111118]/90 border-b border-[#262633] px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Title & Resolution */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 text-white text-xs sm:text-sm font-bold truncate">
            <svg className="w-4 h-4 text-[var(--primary)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <span className="truncate">{title || (lang === 'bg' ? 'Преглед на изображение' : 'Image Viewer')}</span>
          </div>

          {naturalDimensions && (
            <span className="px-2 py-0.5 rounded-[var(--radius-full)] bg-[#242436] border border-[#3A3A4E] text-[10px] text-emerald-400 font-mono shrink-0">
              {naturalDimensions.width} × {naturalDimensions.height} px
              {naturalDimensions.width >= 2160 || naturalDimensions.height >= 2160 ? ' (4K)' : ''}
            </span>
          )}

          {isNavigable && (
            <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0">
              {currentIndex + 1} / {images!.length}
            </span>
          )}
        </div>

        {/* Center / Right: Zoom Controls */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {/* Fit Button */}
          <button
            type="button"
            onClick={handleSetFit}
            className={`px-2.5 py-1 text-xs rounded-[var(--radius-sm)] border transition-colors cursor-pointer font-medium ${
              zoomMode === 'fit'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'bg-[#1D1D28] text-[var(--text-muted)] hover:text-white border-[#333345]'
            }`}
            title={lang === 'bg' ? 'Побиране на целия екран' : 'Fit to screen'}
          >
            {lang === 'bg' ? 'Побиране' : 'Fit'}
          </button>

          {/* 100% Original Button */}
          <button
            type="button"
            onClick={handleSetOriginal}
            className={`px-2.5 py-1 text-xs rounded-[var(--radius-sm)] border transition-colors cursor-pointer font-medium flex items-center gap-1 ${
              zoomMode === 'original'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-[#1D1D28] text-[var(--text-muted)] hover:text-white border-[#333345]'
            }`}
            title={lang === 'bg' ? 'Оригинален размер (100% реална резолюция)' : 'Original Size (100% pixels)'}
          >
            <span>100%</span>
            <span>{lang === 'bg' ? 'Оригинален' : 'Original'}</span>
          </button>

          {/* Zoom Out Button */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] bg-[#1D1D28] hover:bg-[#2B2B38] text-white border border-[#333345] text-xs font-bold cursor-pointer transition-colors"
            title={lang === 'bg' ? 'Намали (-)' : 'Zoom Out'}
          >
            -
          </button>

          {/* Current Scale Display */}
          <span className="px-1.5 text-[11px] font-mono text-[var(--text-muted)] min-w-[42px] text-center">
            {zoomMode === 'fit' ? (lang === 'bg' ? 'Екран' : 'Fit') : `${Math.round(zoomScale * 100)}%`}
          </span>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] bg-[#1D1D28] hover:bg-[#2B2B38] text-white border border-[#333345] text-xs font-bold cursor-pointer transition-colors"
            title={lang === 'bg' ? 'Увеличи (+)' : 'Zoom In'}
          >
            +
          </button>

          {/* Reset Zoom Button */}
          {(zoomMode !== 'fit' || zoomScale !== 1) && (
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2 py-1 text-xs rounded-[var(--radius-sm)] bg-[#1D1D28] hover:bg-[#2B2B38] text-[var(--text-muted)] hover:text-white border border-[#333345] cursor-pointer transition-colors"
              title={lang === 'bg' ? 'Нулирай' : 'Reset'}
            >
              ↺
            </button>
          )}

          {/* Open in new tab / download */}
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-[var(--radius-sm)] bg-[#1D1D28] hover:bg-[#2B2B38] text-[var(--text-muted)] hover:text-white border border-[#333345] transition-colors"
            title={lang === 'bg' ? 'Отвори оригинала в нов прозорец' : 'Open original in new tab'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>

          {/* Close Button */}
          <button
            type="button"
            id="btn-close-zoom-modal"
            onClick={onClose}
            className="px-3 py-1 rounded-[var(--radius-sm)] bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold transition-colors border border-rose-500/50 flex items-center gap-1 cursor-pointer ml-1"
            title={lang === 'bg' ? 'Затвори (Esc)' : 'Close (Esc)'}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span className="hidden sm:inline">{t.CLOSE}</span>
          </button>
        </div>
      </div>

      {/* Main Image Viewport Area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className={`relative flex-1 w-full flex items-center justify-center overflow-auto p-2 sm:p-4 ${
          zoomMode !== 'fit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        onClick={(e) => {
          // If clicking backdrop area, close
          if (e.target === containerRef.current) onClose();
        }}
      >
        {/* Navigation Arrow Previous */}
        {isNavigable && onIndexChange && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((currentIndex - 1 + images!.length) % images!.length);
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 flex items-center justify-center text-lg font-bold transition-all shadow-xl hover:scale-105 cursor-pointer"
            title={lang === 'bg' ? 'Предишна снимка' : 'Previous photo'}
          >
            ‹
          </button>
        )}

        {/* The Image Container */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: zoomMode !== 'fit' ? `translate3d(${panPosition.x}px, ${panPosition.y}px, 0)` : undefined,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
          className="flex items-center justify-center max-w-full max-h-full"
        >
          {zoomMode === 'fit' ? (
            <img
              ref={imgRef}
              src={activeUrl}
              alt="Zoomed"
              onLoad={handleImageLoad}
              className="max-w-full max-h-[82vh] object-contain rounded-[var(--radius-sm)] border border-[#333345] shadow-2xl transition-all"
            />
          ) : zoomMode === 'original' ? (
            <img
              ref={imgRef}
              src={activeUrl}
              alt="Original full resolution"
              onLoad={handleImageLoad}
              style={{
                width: naturalDimensions ? `${naturalDimensions.width}px` : 'auto',
                height: naturalDimensions ? `${naturalDimensions.height}px` : 'auto',
                maxWidth: 'none',
                maxHeight: 'none'
              }}
              className="rounded-[var(--radius-sm)] border border-[#333345] shadow-2xl transition-none"
            />
          ) : (
            <img
              ref={imgRef}
              src={activeUrl}
              alt="Custom scaled"
              onLoad={handleImageLoad}
              style={{
                width: naturalDimensions ? `${naturalDimensions.width * zoomScale}px` : `${zoomScale * 100}%`,
                height: naturalDimensions ? `${naturalDimensions.height * zoomScale}px` : 'auto',
                maxWidth: 'none',
                maxHeight: 'none'
              }}
              className="rounded-[var(--radius-sm)] border border-[#333345] shadow-2xl transition-none"
            />
          )}
        </div>

        {/* Navigation Arrow Next */}
        {isNavigable && onIndexChange && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((currentIndex + 1) % images!.length);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 flex items-center justify-center text-lg font-bold transition-all shadow-xl hover:scale-105 cursor-pointer"
            title={lang === 'bg' ? 'Следваща снимка' : 'Next photo'}
          >
            ›
          </button>
        )}
      </div>

      {/* Bottom Hint Bar */}
      <div
        className="w-full bg-[#111118]/80 border-t border-[#262633] px-4 py-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <span>
          {zoomMode !== 'fit'
            ? (lang === 'bg' ? 'Плъзнете с мишката/пръста за придвижване из изображението' : 'Drag to pan around the image')
            : (lang === 'bg' ? 'Кликнете "100% Оригинален" или "+" за максимална резолюция' : 'Click "100% Original" or "+" to zoom to full resolution')}
        </span>
        <span className="hidden sm:inline">
          {lang === 'bg' ? 'Esc = Затвори • Стрелки ← → = Смяна' : 'Esc = Close • Keys ← → = Switch'}
        </span>
      </div>
    </div>
  );
};
