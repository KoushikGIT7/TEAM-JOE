import React, { useState, useEffect } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';

interface SmoothImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  quality?: number;
}

/**
 * SmoothImage - Production-grade Image Loader
 * Features:
 * 1. Progressive loading (LQIP effect)
 * 2. Skeleton states / Spinner while loading
 * 3. Fallback to default on error
 * 4. Lazy loading support
 * 5. Optimal sizing for Unsplash images
 */
const SmoothImage: React.FC<SmoothImageProps> = ({ 
  src, 
  alt, 
  className = "", 
  containerClassName = "",
  quality = 400
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  // Optimize Unsplash source if detected
  const optimizedSrc = src.includes('unsplash.com') 
    ? src.split('?')[0] + `?auto=format&fit=crop&q=80&w=${quality}`
    : src;

  const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400';

  useEffect(() => {
    // Reset state when src changes
    setIsLoaded(false);
    setError(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* Skeleton / Initial Loader */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      )}

      {/* Error Fallback */}
      {error && (
        <img 
           src={DEFAULT_IMAGE}
           alt="Fallback"
           className={`w-full h-full object-cover ${className}`}
        />
      )}

      {/* Primary Image */}
      {!error && (
        <img
          src={optimizedSrc}
          alt={alt}
          loading="lazy"
          className={`
            transition-all duration-700 ease-out
            ${isLoaded ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-105 blur-lg'}
            ${className}
          `}
          onLoad={() => setIsLoaded(true)}
          onError={() => setError(true)}
        />
      )}
    </div>
  );
};

export default SmoothImage;
