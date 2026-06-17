# Serving Dashboard — UI/UX Design

This document describes the **scanner-first serving dashboard** layout, interaction flow, and performance guidelines. No backend or serving workflow logic is changed; only UI/UX.

---

## 1. Mobile scanner screen layout

**Goal:** Scanner always in context; one-handed use; minimal chrome.

- **Header:** Single row, compact. Logo/name (e.g. “CSE”), sync indicator, time (24h), Kitchen, Logout. Touch targets ≥ 44px. Time in tabular-nums for no layout shift.
- **Primary area (Ready to serve):** Full-width, top of scroll. “Scan active” pill so staff know the hardware scanner is listening. Empty state: icon + “Scan QR to start” + “Items appear here after scan.”
- **Order cards:** Order # in a dark bar, then one row per item: thumbnail, name, ordered/served/left, **Serve** button. Serve button: full-width on mobile, min-height 48px, “Serve” label (not “SERVING...” only; show spinner + “Serving” when loading).
- **Secondary area (Pending):** Below Ready, or behind a tab/accordion on very small screens. Same card pattern; amber theme.
- **Floating action:** Bottom-right, “manual QR entry” (fallback). Size 56px mobile, 64px tablet. Does not block the main content; hardware scanner is primary.
- **No full-screen takeover:** Success and error are overlay panel and toast so the main layout (and scanner context) stay visible.

**Breakpoints:** Default = mobile (< 768px). Single column, Ready first, then Pending.

---

## 2. Tablet scanner layout

**Goal:** Use width; keep scanner primary; side-by-side queues.

- **Header:** Same as mobile but with more spacing; “KITCHEN” and “LOGOUT” text visible (not icon-only).
- **Two columns (md: 768px+):**
  - **Left (2/3):** Ready to serve. Same content as mobile; more padding, larger cards.
  - **Right (1/3):** Pending items + search. Sticky “Pending” header; search bar; scrollable list.
- **Borders:** 2px between columns (not 4px) to save space. Sections use `min-w-0` and `overflow-hidden` so flex children don’t overflow.
- **Floating button:** Same position; slightly larger on tablet. “Scan active” remains in the Ready header.

**Breakpoints:** `md` (768px) = two columns. `lg` (1024px) = same layout with more padding.

---

## 3. Order confirmation panel design

**Purpose:** Confirm QR scan without leaving the main screen; return to scanning immediately.

- **Trigger:** After a successful `validateQRForServing`, show the panel (no full-screen replacement).
- **Layout:**
  - **Mobile:** Bottom sheet. Slides up from bottom (slideUp animation). Backdrop dim (bg-black/20). Tap backdrop or OK to dismiss; panel content uses stopPropagation so tapping the panel doesn’t dismiss.
  - **Tablet:** Centered card, max-width md, same backdrop. OK or backdrop to dismiss.
- **Content:** Order # prominent; list of items (name × qty); short line “Scan next QR or tap OK.” OK button min 44px; primary action.
- **Auto-dismiss:** Existing 3s auto-dismiss (in `processQRScan`) can stay; panel also dismisses on OK or backdrop tap. After dismiss, refocus scanner (hidden input) so next scan is instant.
- **Accessibility:** `role="alert"`, `aria-live="polite"`. OK is the single focusable control for keyboard users.

---

## 4. Serve button interaction design

- **One tap:** Single tap/click calls `serveItem`; no confirmation modal.
- **Feedback:**
  - **Idle:** “Serve” + checkmark icon. Green (ready) or amber (pending). `active:scale-[0.98]` and `touch-manipulation` for instant press feedback.
  - **Loading:** Button disabled; spinner + “Serving” (no icon swap that could shift layout). `disabled:opacity-60` and `disabled:pointer-events-none`.
- **After serve:** Backend completes; list updates via listener. Scanner is refocused in the success path so staff can scan the next QR without tapping elsewhere.
- **Touch targets:** Min height 48px (ready queue), 48px (pending). Full-width on small screens for easier tap.

---

## 5. Responsive layout strategy

| Breakpoint | Width     | Layout summary |
|-----------|-----------|----------------|
| Default   | < 640px   | Single column; header compact; Ready then Pending; bottom sheet for success. |
| sm        | ≥ 640px   | Slightly larger typography and padding; same single column. |
| md        | ≥ 768px   | Two columns: Ready 2/3, Pending 1/3; success panel centered. |
| lg        | ≥ 1024px  | Same two columns; more padding; larger cards. |

**Principles:**

- **Mobile-first:** Base styles for small screens; `sm:`, `md:`, `lg:` add spacing/size.
- **Touch-first:** Buttons and key actions use `min-h-[44px]` or 48px and `touch-manipulation`.
- **No horizontal scroll:** Use `min-w-0`, `overflow-hidden`, `truncate` where needed so flex children don’t overflow.
- **Sticky headers:** “Ready to serve” and “Pending” headers are sticky so section titles stay visible while scrolling.

---

## 6. Error feedback design

**Goal:** Clear message without blocking the next scan.

- **Pattern:** Fixed **toast** (or top bar) instead of full-screen error. Main layout stays visible; scanner can be refocused as soon as the user dismisses.
- **Placement:** Top-right on tablet (`sm:right-4 sm:left-auto`); full-width top on mobile (`left-4 right-4`). Max width sm so it doesn’t dominate.
- **Content:** Icon (AlertCircle), short title (e.g. “Already used”, “Invalid QR”, “Not ready”), message (e.g. “Please come at your pickup time.”). **OK** button to dismiss; min 44px.
- **Auto-dismiss:** Existing 5s timeout can remain; OK dismisses immediately. On dismiss, clear error and refocus scanner.
- **Animation:** slideDown so the toast appears without covering the whole screen. `role="alert"`, `aria-live="assertive"` for screen readers.

---

## 7. Performance recommendations

- **Scanner focus:** After success, error dismiss, or serve, call `getScanner()?.focus()` (or equivalent) inside a short `setTimeout(..., 50–100)` so the hidden input regains focus and the next scan is immediate.
- **List updates:** Rely on existing Firestore listeners for `readyItems` and `pendingItems`; avoid extra state or heavy re-renders. Keep list components simple (no unnecessary context).
- **Images:** Item thumbnails use existing `imageUrl` with `onError` fallback. Consider `loading="lazy"` for off-screen images if the pending list is long.
- **Animations:** Use CSS `transform` and `opacity` (e.g. slideUp/slideDown) instead of layout-heavy animations. `transition-transform` and `active:scale-[0.98]` are cheap.
- **Re-renders:** Success and error are single state variables; confirmation panel and toast are conditional overlays so the main tree doesn’t unmount and the scanner doesn’t lose context.

---

## 8. Interaction flow diagrams

### 8.1 Scan → confirm → serve (happy path)

```
[Staff at counter]
       │
       ▼
┌──────────────────┐
│ Hardware scanner │  ← Hidden input always focused when no modal
│ receives QR data │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     success
│ processQRScan()  │ ──────────────► ┌─────────────────────┐
│ validateQRForServing()  │           │ Order confirmation  │
└────────┬─────────┘     │           │ panel (overlay)     │
         │               │           │ Order # + items     │
         │ error         │           │ [OK] or backdrop    │
         ▼               │           └──────────┬──────────┘
┌──────────────────┐     │                      │
│ Error toast      │     │                      │ dismissSuccess()
│ (fixed top)      │     │                      │ → refocus scanner
│ [OK]             │     │                      ▼
└──────────────────┘     │           Main layout (Ready queue
         │                │            shows new order)
         │ dismissError() │                      │
         ▼                │                      │ Staff taps Serve
    Refocus scanner       │                      ▼
                          │           ┌─────────────────────┐
                          │           │ handleServeReadyItem│
                          │           │ serveItem()         │
                          │           └──────────┬──────────┘
                          │                      │
                          │                      ▼
                          │           List updates via listener
                          │           Refocus scanner
                          │                      │
                          └──────────────────────┘
                                    [Scan next QR]
```

### 8.2 Screen states (no full-screen takeover)

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN LAYOUT                           │
│  ┌─────────────┐  ┌─────────────────────────────────┐  │
│  │ Header      │  │ Ready to serve  │  Pending       │  │
│  │ CSE · time  │  │ [Scan active]   │  Search + list │  │
│  └─────────────┘  │ Order cards     │                │  │
│                   │ [Serve] [Serve] │                │  │
│                   └─────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Success panel (overlay)  OR  Error toast (fixed) │   │
│  │ Only one at a time; main layout still visible    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│                                    [ Manual QR ] (FAB)  │
└─────────────────────────────────────────────────────────┘
```

### 8.3 Responsive layout

```
Mobile (< 768px)          Tablet (≥ 768px)
┌─────────────────┐       ┌──────────────────────────────────┐
│ Header          │       │ Header                            │
├─────────────────┤       ├─────────────────┬────────────────┤
│ Ready to serve  │       │ Ready to serve  │ Pending         │
│ [Scan active]   │       │ [Scan active]   │ Search          │
│                 │       │                 │ List            │
│ Order A         │       │ Order A         │                 │
│  [Serve][Serve] │       │  [Serve][Serve]  │ Order B [Serve] │
│                 │       │                 │ ...             │
├─────────────────┤       │                 │                 │
│ Pending         │       │                 │                 │
│ Search          │       │                 │                 │
│ List            │       │                 │                 │
└────────┬────────┘       └────────┬────────┴────────────────┘
         │                         │
         └─────────┬───────────────┘
                   │
            [ Manual QR ] (FAB)
```

---

## Summary

| Area | Implementation |
|------|----------------|
| **Mobile layout** | Single column; compact header; Ready first, then Pending; 48px serve buttons; bottom sheet confirmation. |
| **Tablet layout** | Two columns (2/3 + 1/3) at md; same header with labels; “Scan active” in Ready header. |
| **Order confirmation** | Overlay panel (bottom sheet on mobile, centered on tablet); OK and backdrop dismiss; refocus scanner. |
| **Serve button** | One tap; spinner + “Serving” when loading; 48px min height; refocus scanner after serve. |
| **Error feedback** | Fixed toast (top-right / full-width top); OK and auto-dismiss; refocus scanner on dismiss. |
| **Performance** | Refocus scanner after success/error/serve; CSS-only animations; minimal re-renders. |

All of the above are UI/UX only; backend and serving workflow (e.g. `validateQRForServing`, `serveItem`, listeners) are unchanged.
