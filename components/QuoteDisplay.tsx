import React from 'react';
import { useSmartQuote } from '../hooks/useSmartQuote';
import { Order } from '../types';

interface QuoteDisplayProps {
  order: Order | null;
  orderCount: number;
  forceRevenge?: boolean;
}

const QuoteDisplay: React.FC<QuoteDisplayProps> = ({ order, orderCount, forceRevenge = false }) => {
  const { quote, isSpecial } = useSmartQuote(order, orderCount, forceRevenge);

  if (!quote) return null;

  return (
    <div className="w-full mt-8 flex flex-col items-center justify-center -mb-2">
      <div 
        className={`px-6 py-4 rounded-2xl animate-[quoteEntrance_0.6s_ease-out_both]
          ${isSpecial 
            ? 'bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10 border border-amber-300/30' 
            : 'bg-primary/5'}
        `}
        style={{
          boxShadow: isSpecial ? '0 0 40px -10px rgba(251, 191, 36, 0.3)' : 'none',
          animationDelay: '0.4s'
        }}
      >
        <p 
          className={`text-center font-bold tracking-tight text-[15px] sm:text-[17px] leading-relaxed
            ${isSpecial ? 'text-amber-600 drop-shadow-sm flex items-center gap-2' : 'text-primary'}
          `}
        >
          {isSpecial && <span className="text-lg">✨</span>}
          {quote}
        </p>
      </div>

      <style>{`
        @keyframes quoteEntrance {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default QuoteDisplay;
