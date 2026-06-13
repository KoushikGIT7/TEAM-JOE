---
name: Electric Bento
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c9ac'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9379'
  outline-variant: '#444933'
  surface-tint: '#abd600'
  primary: '#ffffff'
  on-primary: '#283500'
  primary-container: '#c3f400'
  on-primary-container: '#556d00'
  inverse-primary: '#506600'
  secondary: '#dcb8ff'
  on-secondary: '#480081'
  secondary-container: '#7701d0'
  on-secondary-container: '#dcb7ff'
  tertiary: '#ffffff'
  on-tertiary: '#66002c'
  tertiary-container: '#ffd9e0'
  on-tertiary-container: '#c6005d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c3f400'
  primary-fixed-dim: '#abd600'
  on-primary-fixed: '#161e00'
  on-primary-fixed-variant: '#3c4d00'
  secondary-fixed: '#efdbff'
  secondary-fixed-dim: '#dcb8ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#6700b5'
  tertiary-fixed: '#ffd9e0'
  tertiary-fixed-dim: '#ffb1c3'
  on-tertiary-fixed: '#3f0019'
  on-tertiary-fixed-variant: '#8f0041'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Bricolage Grotesque
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Bricolage Grotesque
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-bold:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  gutter: 12px
  margin-mobile: 16px
---

## Brand & Style

The design system is engineered for the fast-paced, digital-native lifestyle of Gen Z students. It prioritizes high-energy visuals, immediate information density through "Bento Box" modularity, and a "Vibe-First" aesthetic. The brand personality is unapologetically bold, energetic, and playful, yet maintains the structural rigor required for a functional food-ordering experience.

The visual direction combines **High-Contrast Boldness** with **Glassmorphism** accents. It utilizes a dark-mode foundation to make food photography and neon brand colors "pop," creating a cinematic, late-night-dining feel. Surfaces are modular and contained, mimicking the organized chaos of a bento box, while background blurs add depth and a sense of premium craft.

## Colors

The palette is anchored in a deep, "Ink Black" (`#0F0F0F`) to provide maximum contrast for the energetic accent colors. 

- **Primary (Electric Lime):** Used for primary actions, price points, and active states. It is designed to vibrate against the dark background to grab attention instantly.
- **Secondary (Neon Violet):** Used for categorical highlights, special offers, and secondary navigation elements.
- **Tertiary (Cyber Pink):** Reserved for urgent notifications, "Hot" labels, or dietary alerts (e.g., spicy, vegan).
- **Surface Tiers:** Use varying shades of dark gray (`#1A1A1A`, `#262626`) to create the bento box structure, ensuring elements remain distinct without relying on heavy borders.

## Typography

This design system uses a triple-threat typographic approach to balance personality and utility:

1.  **Bricolage Grotesque (Headlines):** Its quirky, expressive terminals bring a "poster-style" energy to food names and category titles. Use tight letter spacing for a compact, modern look.
2.  **Plus Jakarta Sans (Body):** A friendly, geometric sans-serif that ensures descriptions and nutritional information are highly legible even at small sizes on mobile screens.
3.  **Space Grotesk (Data/Labels):** A technical, monospaced-leaning font used for "hard facts" like calorie counts, prices, and timestamps, reinforcing the modern, "techy" vibe.

**Scale Strategy:** Headlines should be aggressive. On mobile, use `headline-lg-mobile` to ensure titles remain impactful without forcing awkward line breaks.

## Layout & Spacing

The layout follows a **Modular Bento Box** philosophy. Instead of a standard list, content is grouped into cards of varying sizes (1x1, 2x1, 2x2) that fit into a strict 2-column or 3-column grid.

- **Thumb-Driven Navigation:** All critical actions (Add to Cart, Filter, Search) are placed within the "Bottom 33%" of the screen.
- **The Grid:** A 12-column fluid grid is used for desktop, but for the primary mobile experience, a 2-column bento grid with `12px` gutters is the standard.
- **Margins:** Consistent `16px` outer margins ensure the UI doesn't feel cramped against the edge of mobile devices.
- **Photography Integration:** Images should always fill their bento container entirely (`object-cover`), with text overlaid using glassmorphic scrims at the bottom of the card.

## Elevation & Depth

This design system avoids traditional drop shadows in favor of **Tonal Layering** and **Glassmorphism**.

1.  **Base Layer:** The darkest neutral (`#0F0F0F`).
2.  **Bento Layer:** Slightly lighter (`#1A1A1A`) with a subtle `1px` inner border of `#FFFFFF10` to define the edges.
3.  **Glass Layer:** Used for floating navigation bars, modal overlays, and sticky headers. Use a `backdrop-filter: blur(12px)` and a semi-transparent background (`#FFFFFF05`) to create a "frosted" effect that allows the vibrant food colors to peek through.
4.  **Interactive States:** When a card is pressed, it should scale down slightly (98%) rather than casting a shadow, emphasizing the tactile nature of the UI.

## Shapes

The shape language is "Squircle-adjacent"—friendly but structured. 

- **Primary Cards:** Use the `rounded-lg` (16px) setting to create the signature bento box look. 
- **Buttons & Chips:** Use `rounded-xl` (24px) or full pill shapes to distinguish interactive triggers from static content containers.
- **Image Masks:** Images within bento boxes must inherit the container's corner radius exactly to maintain the "contained" aesthetic.

## Components

### Buttons
- **Primary:** High-contrast Electric Lime background with black `Space Grotesk` bold text. No shadow, just a vibrant solid fill.
- **Ghost:** Transparent background with a `2px` Electric Lime border. 

### Bento Cards
- Every card must have a specific aspect ratio (e.g., 1:1 for small snacks, 2:1 for featured meals).
- Content inside cards should be padded at `16px` (`spacing.sm`).

### Chips (Dietary Filters)
- Small, pill-shaped elements with low-opacity backgrounds (`secondary_color_hex` at 20% opacity) and high-contrast text.

### Inputs
- Dark-filled fields with a bottom-only border that glows (becomes Primary color) when focused. 

### Navigation Bar
- A floating, glassmorphic "Dock" at the bottom of the screen. Icons should be chunky and "filled" when active, using the primary brand color.

### Food Tags
- High-contrast, small labels (e.g., "Trending", "New") using `tertiary_color_hex` (Cyber Pink) placed in the top-right corner of bento cards, slightly overlapping the edge for a "sticker" effect.