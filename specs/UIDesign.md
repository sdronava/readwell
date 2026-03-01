# Readwell — UI Design System

## Purpose

This document defines the design language, technology choices, and component specifications for the Readwell frontend. It covers Phase 1 MVP requirements and is designed to extend cleanly to tablet and mobile native experiences in later phases.

---

## Technology Stack

All choices are compatible with the existing stack: React 19, TypeScript 5.9, Vite 7, Tailwind CSS 3.4.

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Styling | Tailwind CSS | 3.4 | Utility-first; `darkMode: 'class'` strategy |
| Typography plugin | `@tailwindcss/typography` | ^0.5 | `prose` class for long-form reading content |
| UI font | `@fontsource/inter` | ^5 | Self-hosted Inter — no CDN, GDPR-safe |
| Reading font | `@fontsource/lora` | ^5 | Serif reading font; user-switchable |
| State | React Context | built-in | Two contexts: `ThemeContext`, `ReaderSettingsContext` |
| Animations | Tailwind built-ins | built-in | `transition-*`, `animate-pulse` — no third-party library needed |

**Deferred** (Phase 2+):
- Syntax highlighting: `react-syntax-highlighter` or `prism-react-renderer`
- Animation library: `framer-motion` (for page transitions, gestures)
- Mobile native: React Native (iOS/Android) — components map 1:1 to this design system

---

## Design Tokens

Defined in `frontend/tailwind.config.js` under `theme.extend`:

### Colors

```js
brand: {
  50: '#f0f4ff',   // lightest tint (hover backgrounds)
  100: '#dce8ff',  // light accent backgrounds
  200: '#b9d1ff',
  500: '#3b6ee8',  // primary brand blue
  600: '#2d5cd1',  // button default
  700: '#2349ab',  // button hover
}
surface: {
  DEFAULT: '#ffffff',       // page background (light)
  dark: '#1a1d23',          // page background (dark)
  muted: '#f8f9fb',         // secondary background (light)
  'muted-dark': '#23272f',  // secondary background (dark)
}
```

### Typography

| Role | Font | Tailwind class |
|------|------|---------------|
| UI / navigation | Inter | `font-sans` |
| Reading content | Lora | `font-reading` |

Lora is a readable serif designed for digital screens and body text — comparable to Georgia but more contemporary. It degrades gracefully to `Georgia, serif` on platforms without font loading.

### Font Size Presets

Controlled by `ReaderSettingsContext.fontSize`. Values map to Tailwind classes:

| Label | Value | Class |
|-------|-------|-------|
| S | `sm` | `text-sm` (14px) |
| M | `base` | `text-base` (16px) — default |
| L | `lg` | `text-lg` (18px) |
| XL | `xl` | `text-xl` (20px) |

---

## Dark Mode

**Strategy**: Tailwind `darkMode: 'class'` — `dark` class on `<html>` element.

**Implementation**:
- `ThemeContext` (`frontend/src/contexts/ThemeContext.tsx`) manages `darkMode: boolean` state
- Reads initial value from `localStorage.theme`
- Persists preference on toggle
- Toggle button available in both LibraryView header and ReaderView header

**Color convention** for components:
- Backgrounds: `bg-white dark:bg-surface-muted-dark`
- Page backgrounds: `bg-surface-muted dark:bg-surface-dark`
- Primary text: `text-gray-900 dark:text-gray-100`
- Secondary text: `text-gray-500 dark:text-gray-400`
- Borders: `border-gray-200 dark:border-gray-700`

---

## Components

### LibraryView (`src/views/LibraryView.tsx`)

- Header: app title + dark mode toggle
- Search input: client-side title/author filter (no backend call)
- Loading state: `SkeletonCard` grid (10 cards) with `animate-pulse`
- Book grid: responsive 2–5 columns (Tailwind responsive breakpoints)

### ReaderView (`src/views/ReaderView.tsx`)

- Sticky header contains: back button, TOC button, title/chapter, font controls, TTS controls, dark mode toggle
- Font controls: font family toggle (Aa / Serif) + font size stepper (A− / A+) — hidden on mobile (shown at `sm:` breakpoint)
- TTS banner: visible when speaking, sets `aria-live="off"` on article content per Phase1-MVP.md accessibility spec
- Active block highlight: paragraph/heading currently being read gets `bg-yellow-100 dark:bg-yellow-900/30`

### NavBar (`src/components/NavBar.tsx`)

- Sticky bottom bar
- Prev / Next buttons with keyboard ArrowLeft / ArrowRight support
- Page jump: `<input type="number">` form — submitting jumps directly to entered page
- Keyboard navigation: ArrowLeft/Right keys trigger prev/next when focus is not on an input

### TocSidebar (`src/components/TocSidebar.tsx`)

- Inline `style={{ paddingLeft }}` for chapter depth indentation (Tailwind class interpolation does not work at runtime)
- Dark mode classes on all elements
- Backdrop overlay closes sidebar on click

### TtsControls (`src/components/TtsControls.tsx`)

- Speed selector: 0.75× / 1× / 1.5× / 2× dropdown (reads from `ReaderSettingsContext.ttsRate`)
- Play/Stop button with ARIA labels
- Speed change takes effect on next `speak()` call (not mid-utterance, as Web Speech API does not support mid-utterance rate changes)

### BlockRenderer (`src/components/BlockRenderer.tsx`)

- Reads `fontSize` and `fontFamily` from `ReaderSettingsContext`
- `isActiveBlock` prop: `true` when TTS `highlightRange` falls within this block's character range
- Paragraph and list blocks use `font-reading` by default
- Code blocks: monospace, scrollable, dark-mode aware
- Images: responsive `srcSet`, shadow, rounded corners

### SkeletonCard / SkeletonPage

- `animate-pulse` with `bg-gray-200 dark:bg-gray-700` placeholder shapes
- Match the real layout dimensions for a smooth content-in transition

---

## Accessibility

- All interactive elements have `aria-label` attributes
- Focus styles: `:focus-visible { ring-2 ring-brand-500 ring-offset-2 }` via global CSS
- `aria-live="off"` on reading content while TTS is active (prevents screen reader/TTS conflict)
- TTS banner displayed when speech is playing (visible to all users, including those using magnification)
- Keyboard navigation: ArrowLeft/Right for page navigation in reader
- Screen reader test targets: VoiceOver (macOS/iOS), TalkBack (Android) — Sprint 3 audit

---

## Responsive & Mobile Extensibility

All layouts use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`). Design decisions:

- Book grid: 2 col → 3 → 4 → 5 (matches common mobile-to-desktop breakpoints)
- Reader max-width: `max-w-3xl` — comfortable reading line length on all screen sizes
- Font controls hidden on small screens (`hidden sm:flex`) — accessible via settings in a future mobile-specific settings drawer
- TocSidebar: `w-72` fixed — on mobile this covers ~90% of screen width, which is acceptable for MVP; Phase 2 adds swipe-to-dismiss gesture
- NavBar: touch targets sized at `py-2` minimum (≥44px recommended by WCAG)

**Phase 2+ mobile additions** (documented here for awareness):
- Swipe left/right for page navigation (React Native gesture handlers, or `@use-gesture/react` on web)
- Bottom sheet for reader settings (replaces header overflow menu)
- Offline reading: cache page JSON to IndexedDB

---

## File Structure

```
frontend/src/
├── contexts/
│   ├── ThemeContext.tsx          # dark mode toggle + localStorage
│   └── ReaderSettingsContext.tsx # fontSize, fontFamily, ttsRate
├── components/
│   ├── BlockRenderer.tsx         # respects ReaderSettings; TTS active highlight
│   ├── BookCard.tsx              # dark mode
│   ├── NavBar.tsx                # page jump input + keyboard nav
│   ├── SkeletonCard.tsx          # animate-pulse card placeholder
│   ├── SkeletonPage.tsx          # animate-pulse page content placeholder
│   ├── TocSidebar.tsx            # fixed depth indent (inline style)
│   └── TtsControls.tsx           # speed selector + play/stop
├── hooks/
│   └── useTTS.ts                 # accepts rate param; returns highlightRange
└── views/
    ├── LibraryView.tsx           # search + skeletons + dark mode
    └── ReaderView.tsx            # full reader with all controls wired
```
