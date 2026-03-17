import { useState, useMemo } from 'react';
import { Order } from '../types';
import { REVENGE_QUOTES } from '../motivationalHeadlines';

export const useSmartQuote = (order: Order | null, orderCount: number, forceRevenge: boolean = false) => {
  const quoteData = useMemo(() => {
    if (!order) return { quote: '', isSpecial: false, loading: true };

    // -- ISSUE 3: INSTANT REVENGE QUOTES --
    if (forceRevenge) {
      const idx = Math.floor(Math.random() * REVENGE_QUOTES.length);
      return { 
        quote: REVENGE_QUOTES[idx], 
        isSpecial: true, 
        loading: false 
      };
    }

    // -- RULE 1: VIRAL SCREENSHOT MOMENTS (5% chance) --
    if (Math.random() < 0.05) {
      const viralQuotes = [
        "Main character energy.",
        "You just unlocked legendary status.",
        "This order deserves a screenshot.",
        "Future billionaire fueling up.",
        "Champions eat first."
      ];
      return {
        quote: viralQuotes[Math.floor(Math.random() * viralQuotes.length)],
        isSpecial: true,
        loading: false
      };
    }

    // -- RULE 2: ORDER NUMBER MILESTONES --
    let milestoneQuote: string | null = null;
    if (orderCount === 1) milestoneQuote = "Welcome. Let's start strong.";
    else if (orderCount === 5) milestoneQuote = "Consistency builds legends.";
    else if (orderCount === 10) milestoneQuote = "Top 10 orders. Respect.";
    else if (orderCount === 25) milestoneQuote = "You are officially a regular.";
    else if (orderCount === 50) milestoneQuote = "Half century. Legendary appetite.";
    
    if (milestoneQuote) {
      return { quote: milestoneQuote, isSpecial: true, loading: false };
    }

    // -- RULE 3: USER BEHAVIOR --
    const totalItems = order.items.reduce((acc, item) => acc + item.quantity, 0);
    if (order.totalAmount > 500 || totalItems >= 4) {
      return { quote: "Feeding the whole squad.", isSpecial: false, loading: false };
    } 

    const hour = new Date(order.createdAt).getHours();
    if (hour >= 21 || hour < 4) {
       return { quote: "Late grind needs fuel.", isSpecial: false, loading: false };
    }

    // -- RULE 4: RANDOM FALLBACK FROM REVENGE --
    // Use revenge section as default for student experience
    const fbQuote = REVENGE_QUOTES[Math.floor(Math.random() * REVENGE_QUOTES.length)];
    return { quote: fbQuote, isSpecial: false, loading: false };
    
  }, [order?.id, orderCount, forceRevenge]);

  return quoteData;
};
