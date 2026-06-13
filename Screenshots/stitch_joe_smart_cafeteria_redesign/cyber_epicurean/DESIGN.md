---
name: Cyber-Epicurean
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#cfc2d6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#988d9f'
  outline-variant: '#4d4354'
  surface-tint: '#ddb7ff'
  primary: '#ddb7ff'
  on-primary: '#490080'
  primary-container: '#b76dff'
  on-primary-container: '#400071'
  inverse-primary: '#842bd2'
  secondary: '#4ae176'
  on-secondary: '#003915'
  secondary-container: '#00b954'
  on-secondary-container: '#004119'
  tertiary: '#adc6ff'
  on-tertiary: '#002e6a'
  tertiary-container: '#4d8eff'
  on-tertiary-container: '#00285d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#f0dbff'
  primary-fixed-dim: '#ddb7ff'
  on-primary-fixed: '#2c0051'
  on-primary-fixed-variant: '#6900b3'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Sora
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Sora
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  container-margin: 20px
  gutter: 16px
---

## Brand & Style
The design system embodies a "Hyper-Premium Digital Canteen" aesthetic, merging the utility of high-end fintech with the sensory vibrance of modern entertainment platforms. It is designed for a Gen-Z audience that values speed, social status, and a "dark-mode-first" lifestyle. 

The style is **Futuristic Glassmorphism** mixed with **High-Contrast Minimalism**. It relies on deep spatial depth created through layered translucency, vibrant neon accents that signal energy, and a rigid 8pt grid that ensures the UI feels like a precision-engineered instrument. The emotional goal is to make ordering food feel as rewarding as completing a level in a game or discovering a new artist on a streaming platform.

## Colors
The palette is rooted in a **Midnight Black (#020617)** base to ensure maximum contrast for the neon accents. 

- **Primary Electric Purple:** Used for main actions, active states, and gamified progress.
- **Secondary Neon Green:** Reserved for "Success" states, health-conscious food tags, and "Ready for Pickup" indicators.
- **Glassmorphism Layers:** Grays are not flat; they are tinted with a hint of navy to maintain a premium, cold-tech feel.
- **Gradients:** Use linear gradients (45-degree angle) from Primary Purple to a deeper Indigo for buttons to create a sense of depth and luminosity.

## Typography
The typography system uses a tri-font approach to balance personality with readability:
1. **Sora** for Display and Headings: Its geometric structure and wide stance provide the "futuristic" tech-brand feel.
2. **Inter** for Body: Ensures high legibility for menu descriptions and nutritional info.
3. **JetBrains Mono** for Labels: Used for metadata (calories, price, time) to evoke a "system/data" aesthetic appropriate for a smart cafeteria.

**Hierarchy Rule:** Large display text should always use a tight letter-spacing (-0.02em) to look "locked-in" and intentional.

## Layout & Spacing
This design system follows a **strictly fluid 8pt grid**. 

- **Mobile First:** Designed primarily for Android (Material 3 logic) with high-reachability in mind.
- **Vertical Rhythm:** Content sections are separated by `lg` (40px) or `xl` (64px) units to allow the glassmorphic backgrounds to "breathe."
- **Safe Areas:** All interactive cards must maintain a `container-margin` of 20px from the screen edge to avoid accidental bezel touches on curved displays.
- **Touch Targets:** No interactive element should be smaller than 48x48px.

## Elevation & Depth
Depth is created through **Backdrop Blurs** rather than traditional drop shadows.

- **Level 1 (Base):** Midnight Black background.
- **Level 2 (Cards):** Semi-transparent `surface-glass` with a 20px blur and a 1px inner border (stroke) at 10% white to define the edge.
- **Level 3 (Floating Actions):** High-opacity surfaces with a subtle glow (outer shadow) using the `primary-neon` color at 15% opacity.
- **Micro-shadows:** For buttons, use a 0px 10px 20px shadow that matches the button's accent color to simulate light emission.

## Shapes
The shape language is dominated by **extra-large corner radii** to counteract the coldness of the dark mode.

- **Standard Cards:** 24px (rounded-lg)
- **Buttons & Chips:** Fully pill-shaped (rounded-full)
- **Container Sheets:** 32px top-radius for bottom sheets.
- **Inner Elements:** Elements inside a 24px card should use 12px or 16px to maintain nested concentricity.

## Components

### Buttons
- **Primary:** Gradient fill (Purple to Indigo), pill-shaped, white text, subtle glow on hover/active.
- **Secondary:** Ghost style with a 1px primary-color border and backdrop blur.
- **Floating Action (FAB):** Circular, 64px diameter, containing high-contrast icons.

### Cards
- **Food Item:** Vertical stack. High-res imagery at the top (aspect ratio 4:5), followed by text info on a glassmorphic base.
- **Gamified Badge:** Small, 120px wide cards with holographic gradients and `label-caps` typography.

### Input Fields
- **Search:** Fully pill-shaped, dark-gray background with a "glass" stroke. Icons should use the `secondary-neon` color.

### Bottom Sheets (Mobile Navigation)
- Used for checkout and food customization. Sheets should have a handle bar at the top and a heavy backdrop blur (30px+) behind them to isolate the task.

### Progress Bars
- High-energy "Neon" fill. The bar should have a slight outer glow to look like a light-tube. Use for daily calorie tracking or streak progress.

### Navigation Bar
- Floating, detached navigation bar (not pinned to the bottom edge). Glassmorphic background with active states indicated by a small neon dot below the icon.