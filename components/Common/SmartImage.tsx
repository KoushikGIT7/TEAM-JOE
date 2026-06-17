import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * PRODUCTION-GRADE IMAGE PERFORMANCE ARCHITECTURE
 * Role: Principal Performance Engineer
 * Strategy: Layout Reservation + Async Decoding + Priority Hinting
 */

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'fill' | number;
  priority?: 'high' | 'low' | 'auto';
  className?: string;
  containerClassName?: string;
  fallbackSrc?: string;
  placeholderColor?: string;
  // Variant: thumb (<100px), card (<400px), hero (>800px)
  variant?: 'thumb' | 'card' | 'hero';
}

/**
 * Global cache of successfully decoded/loaded URLs to bypass
 * animation/flicker on subsequent mounts.
 */
const DECODED_CACHE = new Set<string>();

const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  aspectRatio = 'square',
  priority = 'auto',
  className = '',
  containerClassName = '',
  fallbackSrc,
  placeholderColor = '#1e1b4b',
  variant = 'card',
  ...props
}) => {
  // Treat empty/whitespace src as missing immediately — skip loading cycle
  const effectiveSrc = src?.trim() || '';

  const [status, setStatus] = useState<'empty' | 'loading' | 'loaded' | 'error'>(
    !effectiveSrc
      ? 'empty'
      : DECODED_CACHE.has(effectiveSrc)
      ? 'loaded'
      : 'loading'
  );
  const [currentSrc, setCurrentSrc] = useState(effectiveSrc);
  const imgRef = useRef<HTMLImageElement>(null);

  // 1. Aspect Ratio Reservation (CLS Prevention)
  const ratioStyles = useMemo(() => {
    if (aspectRatio === 'fill') return {};
    if (typeof aspectRatio === 'number') return { paddingTop: `${(1 / aspectRatio) * 100}%` };
    const ratios: Record<string, string> = {
      square: '100%',
      video: '56.25%',
      portrait: '133%',
    };
    return { paddingTop: ratios[aspectRatio] || '100%' };
  }, [aspectRatio]);

  // 2. High-Performance Decoding & Priority Hinting + Sync State
  useEffect(() => {
    const trimmed = src?.trim() || '';
    setCurrentSrc(trimmed);

    if (!trimmed) {
      setStatus('empty');
      return;
    }

    if (DECODED_CACHE.has(trimmed)) {
      setStatus('loaded');
      return;
    }

    setStatus('loading');

    let isMounted = true;
    const img = document.createElement('img');

    // Priority hints for Chromium
    if (priority === 'high' && 'fetchPriority' in img) {
      (img as any).fetchPriority = 'high';
    }

    img.onload = () => {
      if (!isMounted) return;
      if ('decode' in img) {
        img.decode()
          .then(() => {
            if (isMounted) {
              DECODED_CACHE.add(trimmed);
              setStatus('loaded');
            }
          })
          .catch(() => {
            if (isMounted) {
              DECODED_CACHE.add(trimmed);
              setStatus('loaded'); // Fallback since onload succeeded
            }
          });
      } else {
        DECODED_CACHE.add(trimmed);
        setStatus('loaded');
      }
    };

    img.onerror = () => {
      if (isMounted) {
        setStatus('error');
      }
    };

    img.src = trimmed;

    return () => {
      isMounted = false;
    };
  }, [src, priority]);

  const handleImageError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    } else {
      setStatus('error');
    }
  };

  return (
    <div
      className={`relative overflow-hidden w-full ${aspectRatio === 'fill' ? 'h-full' : 'h-0'} ${containerClassName}`}
      style={{ ...ratioStyles, backgroundColor: placeholderColor }}
    >
      {/* 🔮 SKELETON / LOADING STATE */}
      {status === 'loading' && (
        <div className="absolute inset-0 animate-pulse flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)' }}>
          <div className="w-8 h-8 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin" />
        </div>
      )}

      {/* 🖼️ ACTUAL IMAGE */}
      {(status === 'loading' || status === 'loaded' || status === 'error') && currentSrc && (
        <img ref={imgRef} loading="lazy" decoding="async"
          src={currentSrc}
          alt={alt}
          onError={handleImageError}
          loading={priority === 'high' ? 'eager' : 'lazy'}
          decoding={priority === 'high' ? 'sync' : 'async'}
          className={`
            absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out
            ${status === 'loaded' ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-105 blur-lg'}
            ${className}
          `}
          style={{ objectPosition: 'center', ...(priority === 'high' ? { zIndex: 1 } : {}) }}
          {...props}
        />
      )}

      {/* 🟣 EMPTY / ERROR STATE — branded purple placeholder */}
      {(status === 'empty' || status === 'error') && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 select-none"
          style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #2e1065 100%)' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-purple-400/50"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          {variant !== 'thumb' && (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-purple-400/40">
              {alt || 'No Image'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(SmartImage);

