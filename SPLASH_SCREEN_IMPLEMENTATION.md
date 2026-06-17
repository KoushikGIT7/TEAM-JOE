# Splash Screen Implementation

## Overview

Professional animated splash screen for CSE cafeteria app that displays during app initialization with smooth logo and tagline animations.

## Component Structure

### `components/SplashScreen.tsx`

**Features:**
- ✅ Logo fade-in with subtle scale-up animation
- ✅ Tagline slide-up reveal with delay
- ✅ Subtle glow pulse effect on logo
- ✅ Smooth exit transition
- ✅ Minimum display time (2.5s) to ensure visibility
- ✅ Responsive scaling for mobile and desktop

**Animation Timeline:**
1. **0-700ms**: Logo fades in and scales up (ease-out)
2. **500-1100ms**: Tagline slides up and fades in (ease-out)
3. **700-1500ms**: Accent underline expands
4. **2000-2500ms**: Glow pulse continues (infinite loop)
5. **2500ms+**: Exit animation begins (fade out)

## Integration

### App.tsx Changes

```typescript
// Added state for splash screen
const [showSplash, setShowSplash] = useState(true);

// Splash screen shows before app content
if (showSplash) {
  return <SplashScreen onFinish={handleSplashFinish} minDisplayTime={2500} />;
}
```

**Behavior:**
- Splash shows on every app open/refresh
- Displays for minimum 2.5 seconds (configurable)
- Smoothly transitions to app content after animation completes
- No interruption during app initialization (auth check, menu init, etc.)

## Assets

### Logo File
- **Location**: `public/JeoLogoFinal.png`
- **Reference**: `/JeoLogoFinal.png` (served from public folder)
- **Fallback**: Text-based logo if image fails to load

## Animation Details

### CSS Keyframes

1. **logoEntrance**: Scale from 0.85 to 1.0 with fade-in
2. **taglineEntrance**: Slide up 12px with fade-in
3. **glowPulse**: Subtle opacity and scale pulsing (30% → 50% → 30%)
4. **taglineAccent**: Width expansion from 0 to 64px

### Styling

- **Background**: Dark gradient (`from-[#0A0A0A] via-[#111111] to-[#0F9D58]/10`)
- **Logo Size**: 128px mobile, 160px desktop
- **Tagline**: White text, bold, tracking-tight
- **Accent**: Green underline with subtle opacity

## Performance Optimizations

1. **CSS Animations**: Uses native CSS keyframes (GPU-accelerated)
2. **Minimal Re-renders**: Single state management for visibility
3. **Early Exit**: Can skip if initialization completes before min time
4. **Image Loading**: Graceful fallback if logo fails to load

## Customization

### Adjust Minimum Display Time

```typescript
<SplashScreen onFinish={handleSplashFinish} minDisplayTime={3000} />
```

### Change Animation Speed

Edit animation durations in `SplashScreen.tsx`:
- Logo entrance: `duration-700` (0.7s)
- Tagline entrance: `duration-600` (0.6s)
- Exit transition: `duration-500` (0.5s)

### Modify Colors

Update Tailwind classes:
- Background: `bg-gradient-to-br from-[...]`
- Glow: `bg-primary/20`
- Tagline accent: `bg-accent/60`

## Browser Compatibility

- ✅ Chrome/Edge (modern)
- ✅ Firefox (modern)
- ✅ Safari (modern)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Testing Checklist

- [x] Logo displays correctly
- [x] Animations run smoothly
- [x] Minimum display time enforced
- [x] Exit transition works
- [x] Responsive on mobile/desktop
- [x] Fallback logo shows if image fails
- [x] No layout shift during transitions

## Notes

- Splash shows on **every app open** (intentional for brand reinforcement)
- Animation is **non-blocking** - app continues initializing in background
- Total animation time: ~2.5-3 seconds
- No sound effects (as per requirements)
