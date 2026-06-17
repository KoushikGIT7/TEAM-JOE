
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'text-xl sm:text-2xl',
    md: 'text-3xl sm:text-4xl',
    lg: 'text-5xl sm:text-6xl',
    xl: 'text-6xl sm:text-7xl md:text-8xl',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5 sm:w-2 sm:h-2',
    md: 'w-2.5 h-2.5 sm:w-3 sm:h-3',
    lg: 'w-3.5 h-3.5 sm:w-4 sm:h-4',
    xl: 'w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6',
  };

  return (
    <div className={`flex items-center font-bold tracking-tighter text-primary ${sizes[size]} ${className}`}>
      <span>CSE</span>
      <div className={`bg-accent rounded-full ml-1 ${dotSizes[size]}`} />
    </div>
  );
};

export default Logo;
