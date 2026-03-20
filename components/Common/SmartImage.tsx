import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * PRODUCTION-GRADE IMAGE PERFORMANCE ARCHITECTURE
 * Role: Principal Performance Engineer
 * Strategy: Layout Reservation + Async Decoding + Priority Hinting
 */

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | number;
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
  fallbackSrc = 'https://placehold.co/400?text=No+Image',
  placeholderColor = '#f1f5f9',
  variant = 'card',
  ...props
}) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    DECODED_CACHE.has(src) ? 'loaded' : 'loading'
  );
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);

  // 1. Aspect Ratio Reservation (CLS Prevention)
  const ratioStyles = useMemo(() => {
    if (typeof aspectRatio === 'number') return { paddingTop: `${(1 / aspectRatio) * 100}%` };
    const ratios: Record<string, string> = {
      square: '100%',
      video: '56.25%',
      portrait: '133%',
    };
    return { paddingTop: ratios[aspectRatio] || '100%' };
  }, [aspectRatio]);

  // 2. High-Performance Decoding & Priority Hinting
  useEffect(() => {
    if (!src) return;
    if (DECODED_CACHE.has(src)) {
      setStatus('loaded');
      return;
    }

    let isMounted = true;
    const img = document.createElement('img');
    
    // Priority hints for Chromium
    if (priority === 'high' && 'fetchPriority' in img) {
      (img as any).fetchPriority = 'high';
    }

    img.src = src;

    // Hardware-accelerated decoding before state update
    if ('decode' in img) {
      img.decode()
        .then(() => {
          if (isMounted) {
            DECODED_CACHE.add(src);
            setStatus('loaded');
          }
        })
        .catch(() => {
          if (isMounted) setStatus('error');
        });
    } else {
      (img as any).onload = () => { if (isMounted) setStatus('loaded'); };
      (img as any).onerror = () => { if (isMounted) setStatus('error'); };
    }

    return () => { isMounted = false; };
  }, [src, priority]);

  const handleImageError = () => {
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setStatus('error');
    }
  };

  return (
    <div 
      className={`relative overflow-hidden w-full h-0 shadow-sm ${containerClassName}`}
      style={{ ...ratioStyles, backgroundColor: placeholderColor }}
    >
      {/* 🔮 SKELETON / LOADING STATE */}
      {status === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-slate-200 flex items-center justify-center">
          <div className="w-1/4 h-1/4 bg-slate-300 rounded-full opacity-20" />
        </div>
      )}

      {/* 🖼️ ACTUAL IMAGE */}
      <img
        ref={imgRef}
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

      {/* 🔴 ERROR STATE OVERLAY */}
      {status === 'error' && currentSrc === fallbackSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 opacity-50">
          <span className="text-[10px] font-black uppercase text-slate-300 italic">No Content</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(SmartImage);
