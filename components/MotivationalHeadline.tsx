import React from 'react';

interface MotivationalHeadlineProps {
  visible: boolean;
  headline: string | null;
  variant?: 'inline' | 'overlay';
}

/**
 * Displays a short motivational headline during waiting moments.
 * No labels — headline text only. Non-blocking (pointer-events-none on overlay).
 */
const MotivationalHeadline: React.FC<MotivationalHeadlineProps> = ({
  visible,
  headline,
  variant = 'inline',
}) => {
  if (!visible || !headline) return null;

  const baseClass =
    'select-none text-center font-semibold tracking-tight transition-opacity duration-500 ease-out';

  if (variant === 'overlay') {
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-transparent" />
        <div
          className="relative px-6 py-4 rounded-2xl bg-black/55 backdrop-blur-md shadow-xl max-w-xl mx-4 motivational-headline-in"
          style={{ animation: 'headlineFadeInUp 0.35s ease-out' }}
        >
          <p
            className={`${baseClass} text-white text-2xl sm:text-3xl md:text-4xl`}
            style={{ animation: 'headlineBreath 3.5s ease-in-out infinite alternate' }}
          >
            {headline}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full flex items-center justify-center py-3 motivational-headline-in"
      style={{ animation: 'headlineFadeInUp 0.35s ease-out' }}
      aria-hidden="true"
    >
      <p
        className={`${baseClass} text-slate-700 text-lg sm:text-xl md:text-2xl`}
        style={{ animation: 'headlineBreath 3.5s ease-in-out infinite alternate' }}
      >
        {headline}
      </p>
    </div>
  );
};

export default MotivationalHeadline;
