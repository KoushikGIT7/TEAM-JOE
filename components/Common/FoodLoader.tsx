import React, { useState, useEffect } from 'react';

const FOOD_EMOJIS = ['🍛', '🥗', '🍜', '🥘', '🍱', '☕'];

export const FoodLoader: React.FC = () => {
  const [fi, setFi] = useState(0);
  
  useEffect(() => {
    const iv = setInterval(() => setFi(f => (f + 1) % FOOD_EMOJIS.length), 420);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className="text-5xl select-none"
        style={{ animation: 'foodSpin 0.42s ease-in-out' }}
        key={fi}
      >
        {FOOD_EMOJIS[fi]}
      </div>
      <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Loading...</p>
      <style>{`
        @keyframes foodSpin {
          0%   { opacity: 0; transform: scale(0.6) rotate(-15deg); }
          50%  { opacity: 1; transform: scale(1.15) rotate(5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  );
};

export default FoodLoader;
