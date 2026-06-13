/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ChefHat, Leaf, Coffee, Moon, Sparkles, Award, Star, 
  Bolt, Lock, Timer, CheckCircle2, ChevronRight, HelpCircle
} from 'lucide-react';

export const QuestsView: React.FC = () => {
  const { quests, studentPoints } = useApp();
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [filterTag, setFilterTag] = useState<'ALL' | 'MEALS' | 'STREAKS'>('ALL');

  // Filter tag configs
  const filterTags = [
    { label: 'ALL', id: 'ALL' },
    { label: 'MEALS', id: 'MEALS' },
    { label: 'STREAKS', id: 'STREAKS' }
  ];

  // Map badge string to Lucide icon beautifully
  const getQuestIcon = (badge?: string) => {
    switch (badge) {
      case 'restaurant': return ChefHat;
      case 'eco': return Leaf;
      case 'local_cafe': return Coffee;
      case 'nightlight': return Moon;
      default: return Bolt;
    };
  };

  // Filter elements
  const displayedQuests = quests.filter(q => {
    if (q.type !== activeTab) return false;
    if (filterTag === 'ALL') return true;
    if (filterTag === 'MEALS') {
      return q.id === 'q_1' || q.id === 'q_2'; // Ramen and Salad are meals
    }
    if (filterTag === 'STREAKS') {
      return q.id === 'q_3' || q.id === 'q_4'; // Caffeine tracker & late night
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-surface-lowest pb-24 text-on-surface">
      {/* View Header */}
      <header className="sticky top-0 z-50 flex flex-col justify-end px-5 h-20 w-full bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5 select-none">
        <div className="flex items-center justify-between pb-3.5">
          <div className="flex flex-col">
            <span className="font-mono text-[9px] tracking-widest text-[#a3b8cc] font-extrabold uppercase leading-none">
              CAMPUS CHALLENGES
            </span>
            <h1 className="font-display text-lg font-black text-white leading-none mt-1">
              Active Quests
            </h1>
          </div>

          <div className="flex bg-[#1e293b]/70 p-1 rounded-full border border-white/5">
            <button
              onClick={() => setActiveTab('ACTIVE')}
              className={`px-3 py-1 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase transition-all ${
                activeTab === 'ACTIVE' 
                  ? 'bg-brand-purple text-surface-lowest shadow-md' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab('ARCHIVED')}
              className={`px-3 py-1 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase transition-all ${
                activeTab === 'ARCHIVED' 
                  ? 'bg-brand-purple text-surface-lowest shadow-md' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Archive
            </button>
          </div>
        </div>
      </header>

      {/* Main Quests stream */}
      <main className="px-5 mt-4 space-y-5 max-w-lg mx-auto">
        
        {/* Filter tags panel matching design patterns */}
        <div className="flex gap-2 select-none overflow-x-auto hide-scrollbar pb-1">
          {filterTags.map(tag => (
            <button
              key={tag.id}
              onClick={() => setFilterTag(tag.id as any)}
              className={`px-3.5 py-1.5 rounded-xl font-mono text-[9px] font-extrabold tracking-widest ${
                filterTag === tag.id
                  ? 'bg-[#1e293b] border border-brand-purple text-white shadow-lg'
                  : 'bg-[#1e293b]/40 border border-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* Quests listing display */}
        <section className="space-y-3.5">
          {displayedQuests.length === 0 ? (
            <div className="text-center p-12 glass-bg rounded-2xl select-none text-zinc-500 font-sans text-xs flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-zinc-600 mb-1" />
              <span>No {activeTab.toLowerCase()} quests found matching filter.</span>
            </div>
          ) : (
            displayedQuests.map((quest) => {
              const IconComp = getQuestIcon(quest.badge);
              const progressPercentage = Math.min(100, (quest.progress / quest.target) * 100);
              const isCompleted = quest.progress === quest.target;

              return (
                <div 
                  key={quest.id}
                  className={`group relative rounded-2xl glass-stroke border border-transparent p-5 transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-brand-purple/5 border-brand-purple/20' 
                      : 'glass-bg'
                  }`}
                >
                  <div className="flex gap-4 items-start">
                    {/* Badge Icon */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center border shrink-0 select-none ${
                      isCompleted 
                        ? 'bg-brand-purple/10 border-brand-purple/30 text-brand-purple-light' 
                        : 'bg-white/5 border-white/5 text-brand-purple'
                    }`}>
                      <IconComp className="w-5.5 h-5.5" />
                    </div>

                    {/* Quest Details info */}
                    <div className="flex-grow space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-display text-xs font-black text-white leading-none">
                            {quest.title}
                          </h4>
                          <p className="text-[10px] text-zinc-400 font-sans mt-1">
                            {quest.description}
                          </p>
                        </div>
                        
                        {/* Custom status tag if badgeColor is specified (Rare badge, etc.) */}
                        {quest.badgeColor && (
                          <span className="font-mono text-[7px] bg-brand-green/10 text-brand-green border border-brand-green/20 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 font-extrabold select-none">
                            {quest.badgeColor}
                          </span>
                        )}
                      </div>

                      {/* Progress Horizontal Slider */}
                      <div className="pt-3">
                        <div className="flex justify-between text-[9px] font-mono font-bold leading-none select-none">
                          <span className={`${isCompleted ? 'text-brand-purple-light' : 'text-zinc-400'}`}>
                            {quest.progress} / {quest.target} Complete
                          </span>
                          <span className="text-zinc-500">
                            {progressPercentage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full mt-1.5 overflow-hidden border border-white/5">
                          <div 
                            className={`h-full rounded-full transition-all duration-700 ${
                              isCompleted 
                                ? 'bg-gradient-to-r from-brand-purple to-brand-green' 
                                : 'bg-brand-purple'
                            }`}
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer Actions / deadlines */}
                      <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/5 font-mono text-[9px] select-none">
                        {quest.endsIn && !isCompleted ? (
                          <div className="flex items-center gap-1.5 text-amber-300">
                            <Timer className="w-3.5 h-3.5 shrink-0" />
                            <span>Ends in: {quest.endsIn}</span>
                          </div>
                        ) : isCompleted ? (
                          <div className="flex items-center gap-1 text-brand-green">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Completed {quest.completedAt || 'Recently'}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500">Continuous Quest</span>
                        )}

                        <span className={`font-black tracking-widest ${isCompleted ? 'text-zinc-500 line-through' : 'text-[#f4f4f5]'}`}>
                          +{quest.points} PTS
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Informational Quest card banner rules */}
        <article className="p-4 bg-[#171f33]/30 border border-white/5 rounded-2xl flex gap-3 select-none">
          <HelpCircle className="w-5 h-5 text-brand-purple shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <h5 className="font-display font-extrabold text-xs text-white">How Quests work?</h5>
            <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
              Quests are campus-wide food challenges that reward you with major Loyalty Points. Point accrual and task incrementation is synced instantly upon checkout. Use earned points in the **Campus Store** for free dinners, special merchandise, and skip-the-line privileges!
            </p>
          </div>
        </article>

      </main>
    </div>
  );
};
