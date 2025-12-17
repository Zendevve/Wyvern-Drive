# Wyvern Drive Design System

> **Version:** 1.0
> **Last Updated:** December 2024

---

## Core Philosophy

**"Obsidian Minimal"** — A refined, near-black aesthetic that prioritizes content and function. Inspired by Linear, Vercel, and premium crypto interfaces. The design conveys security, speed, and technical sophistication through restraint, not decoration.

**Principles:**
1. **Content First** — UI elements recede; user files and actions take center stage.
2. **Depth Through Subtlety** — Hierarchy created with opacity, not heavy shadows or borders.
3. **Monochrome + Accent** — Near-black surfaces with white text; minimal accent color usage.
4. **Motion as Meaning** — Micro-animations signal responsiveness, not distraction.

---

## Color Palette

### Backgrounds (Dark Mode First)

```css
:root {
  /* Layered Background System - Darkest to Lightest */
  --bg-deep:       #020203;   /* Absolute depth, rarely used */
  --bg-base:       #0A0A0B;   /* Primary app background */
  --bg-elevated:   #0F0F11;   /* Sidebar, panels */
  --bg-surface:    #141416;   /* Cards, modals, inputs */
  --bg-hover:      #1A1A1D;   /* Hovered cards, active items */
  --bg-active:     #212124;   /* Pressed/active states */
}
```

### Borders & Dividers

```css
:root {
  --border-subtle:    rgba(255, 255, 255, 0.05);  /* Container edges */
  --border-default:   rgba(255, 255, 255, 0.08);  /* Inputs, cards */
  --border-hover:     rgba(255, 255, 255, 0.12);  /* Hover states */
  --border-focus:     rgba(255, 255, 255, 0.20);  /* Focus rings */
  --border-strong:    #2A2A2E;                    /* Solid dividers */
}
```

### Text Colors

```css
:root {
  --text-primary:     #FAFAFA;   /* Headlines, primary content */
  --text-secondary:   #A1A1AA;   /* Body text, labels */
  --text-muted:       #71717A;   /* Hints, timestamps, captions */
  --text-disabled:    #52525B;   /* Disabled states */
  --text-inverse:     #0A0A0B;   /* Text on light backgrounds */
}
```

### Accent Colors

```css
:root {
  /* Primary Accent - Pure White (High Contrast) */
  --accent-primary:       #FFFFFF;
  --accent-primary-hover: #E4E4E7;
  --accent-primary-glow:  rgba(255, 255, 255, 0.15);

  /* Secondary Accent - Optional Brand Color */
  /* Use sparingly for special emphasis (Pro badges, promotions) */
  --accent-brand:         #8B5CF6;  /* Violet */
  --accent-brand-hover:   #7C3AED;
  --accent-brand-glow:    rgba(139, 92, 246, 0.20);
}
```

### Semantic Colors

```css
:root {
  /* Success */
  --color-success:      #22C55E;
  --color-success-bg:   rgba(34, 197, 94, 0.12);
  --color-success-text: #4ADE80;

  /* Error / Destructive */
  --color-error:        #EF4444;
  --color-error-bg:     rgba(239, 68, 68, 0.12);
  --color-error-text:   #F87171;

  /* Warning */
  --color-warning:      #F59E0B;
  --color-warning-bg:   rgba(245, 158, 11, 0.12);
  --color-warning-text: #FBBF24;

  /* Info */
  --color-info:         #3B82F6;
  --color-info-bg:      rgba(59, 130, 246, 0.12);
  --color-info-text:    #60A5FA;
}
```

### File Category Colors

```css
:root {
  --color-images:     #8B5CF6;  /* Violet */
  --color-videos:     #06B6D4;  /* Cyan */
  --color-audio:      #22C55E;  /* Green */
  --color-documents:  #F59E0B;  /* Amber */
  --color-archives:   #EC4899;  /* Pink */
  --color-other:      #71717A;  /* Gray */
}
```

---

## Typography

### Font Families

```css
:root {
  /* Primary UI Font */
  --font-sans: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Monospace (Code, IDs, Technical) */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;

  /* Display/Marketing Headlines (Optional) */
  --font-display: 'Playfair Display', Georgia, serif;
}
```

### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Use Case |
|-------|------|--------|-------------|----------------|----------|
| `--text-display` | 48px / 3rem | 300 | 1.1 | -0.02em | Landing hero |
| `--text-h1` | 32px / 2rem | 600 | 1.2 | -0.01em | Page titles |
| `--text-h2` | 24px / 1.5rem | 600 | 1.25 | -0.01em | Section headers |
| `--text-h3` | 18px / 1.125rem | 600 | 1.3 | 0 | Card titles |
| `--text-h4` | 16px / 1rem | 600 | 1.4 | 0 | Subsections |
| `--text-body` | 14px / 0.875rem | 400 | 1.5 | 0 | Default text |
| `--text-sm` | 13px / 0.8125rem | 400 | 1.5 | 0 | Secondary text |
| `--text-xs` | 12px / 0.75rem | 400 | 1.4 | 0.01em | Labels, hints |
| `--text-xxs` | 10px / 0.625rem | 500 | 1.4 | 0.02em | Badges, status |

```css
:root {
  --text-display: 3rem;
  --text-h1: 2rem;
  --text-h2: 1.5rem;
  --text-h3: 1.125rem;
  --text-h4: 1rem;
  --text-body: 0.875rem;
  --text-sm: 0.8125rem;
  --text-xs: 0.75rem;
  --text-xxs: 0.625rem;
}
```

---

## Spacing System

Base unit: **4px**

```css
:root {
  --space-0:  0;
  --space-1:  4px;    /* 0.25rem */
  --space-2:  8px;    /* 0.5rem */
  --space-3:  12px;   /* 0.75rem */
  --space-4:  16px;   /* 1rem */
  --space-5:  20px;   /* 1.25rem */
  --space-6:  24px;   /* 1.5rem */
  --space-8:  32px;   /* 2rem */
  --space-10: 40px;   /* 2.5rem */
  --space-12: 48px;   /* 3rem */
  --space-16: 64px;   /* 4rem */
  --space-20: 80px;   /* 5rem */
  --space-24: 96px;   /* 6rem */
}
```

---

## Border Radius

```css
:root {
  --radius-none: 0;
  --radius-sm:   4px;   /* Small pills, badges */
  --radius-md:   8px;   /* Buttons, inputs */
  --radius-lg:   12px;  /* Cards, modals */
  --radius-xl:   16px;  /* Large containers */
  --radius-2xl:  24px;  /* Hero cards */
  --radius-full: 9999px; /* Circular avatars */
}
```

---

## Shadows & Elevation

Prefer **opacity/background changes** over heavy shadows. When shadows are needed:

```css
:root {
  --shadow-sm:   0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md:   0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg:   0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-xl:   0 20px 25px rgba(0, 0, 0, 0.6);

  /* Glow effects for special emphasis */
  --glow-white:  0 0 20px rgba(255, 255, 255, 0.1);
  --glow-accent: 0 0 30px var(--accent-brand-glow);
}
```

---

## Animation & Transitions

```css
:root {
  /* Durations */
  --duration-instant: 50ms;
  --duration-fast:    150ms;
  --duration-normal:  200ms;
  --duration-slow:    300ms;
  --duration-slower:  500ms;

  /* Easing */
  --ease-default:  ease-out;
  --ease-in:       cubic-bezier(0.4, 0, 1, 1);
  --ease-out:      cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out:   cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring:   cubic-bezier(0.16, 1, 0.3, 1);  /* Expo out */
  --ease-bounce:   cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Standard transition */
  --transition-fast:   150ms var(--ease-spring);
  --transition-normal: 200ms var(--ease-spring);
}
```

---

## Z-Index Scale

```css
:root {
  --z-base:      1;
  --z-dropdown:  100;
  --z-sticky:    200;
  --z-fixed:     300;
  --z-overlay:   400;
  --z-modal:     500;
  --z-popover:   600;
  --z-toast:     700;
  --z-tooltip:   800;
  --z-max:       9999;
}
```

---

## UI Component Specifications

### Buttons

#### Primary Button (High Emphasis)
```css
.btn-primary {
  background: var(--accent-primary);
  color: var(--text-inverse);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--text-sm);
  transition: var(--transition-fast);
}
.btn-primary:hover {
  background: var(--accent-primary-hover);
  transform: translateY(-1px);
}
.btn-primary:active {
  transform: translateY(0);
}
```

#### Secondary Button (Medium Emphasis)
```css
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
}
.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}
```

#### Ghost Button (Low Emphasis)
```css
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
}
.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}
```

#### Icon Button
```css
.btn-icon {
  padding: var(--space-2);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
}
.btn-icon:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}
```

---

### Cards

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  transition: var(--transition-fast);
}
.card:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
.card.selected {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px var(--accent-primary);
}
```

---

### Inputs

```css
.input {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  color: var(--text-primary);
  font-size: var(--text-body);
  transition: var(--transition-fast);
}
.input::placeholder {
  color: var(--text-muted);
}
.input:hover {
  border-color: var(--border-hover);
}
.input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-primary-glow);
}
.input.error {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px var(--color-error-bg);
}
```

---

### Navigation Items

```css
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  transition: var(--transition-fast);
}
.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}
.nav-item.active {
  background: rgba(255, 255, 255, 0.10);
  color: var(--text-primary);
}
```

---

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.80);
  backdrop-filter: blur(4px);
}
.modal {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 480px;
  width: 90%;
}
.modal-header {
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
}
.modal-body {
  padding: var(--space-6);
}
.modal-footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
```

---

### Tooltips

```css
.tooltip {
  background: var(--bg-active);
  color: var(--text-primary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  box-shadow: var(--shadow-md);
}
```

---

### Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xxs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge-success {
  background: var(--color-success-bg);
  color: var(--color-success-text);
}
.badge-error {
  background: var(--color-error-bg);
  color: var(--color-error-text);
}
.badge-warning {
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
}
```

---

## Layout Specifications

### Sidebar
- Width: `256px` (desktop), collapsible on tablet
- Background: `var(--bg-elevated)`
- Border: Right `1px solid var(--border-strong)`

### Header
- Height: `60px`
- Background: `var(--bg-base)` with `backdrop-filter: blur(12px)`
- Border: Bottom `1px solid var(--border-strong)`

### Content Grid (Files)
- Columns: `repeat(auto-fill, minmax(160px, 1fr))`
- Gap: `var(--space-4)`
- Padding: `var(--space-6)`

---

## Responsive Breakpoints

```css
:root {
  --breakpoint-sm:  640px;   /* Mobile landscape */
  --breakpoint-md:  768px;   /* Tablet */
  --breakpoint-lg:  1024px;  /* Desktop */
  --breakpoint-xl:  1280px;  /* Large desktop */
  --breakpoint-2xl: 1536px;  /* Ultra-wide */
}
```

---

## Accessibility Notes

1. **Contrast Ratios** — All text colors meet WCAG AA (4.5:1 for body, 3:1 for large text).
2. **Focus States** — All interactive elements have visible focus indicators using `box-shadow`.
3. **Motion** — Respect `prefers-reduced-motion` by disabling transitions.
4. **Touch Targets** — Minimum 44x44px for mobile.

---

## Tailwind CSS Configuration

For projects using Tailwind CSS, extend the default config:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: {
          deep: '#020203',
          base: '#0A0A0B',
          elevated: '#0F0F11',
          surface: '#141416',
          hover: '#1A1A1D',
          active: '#212124',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.05)',
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          hover: 'rgba(255, 255, 255, 0.12)',
          focus: 'rgba(255, 255, 255, 0.20)',
          strong: '#2A2A2E',
        },
        text: {
          primary: '#FAFAFA',
          secondary: '#A1A1AA',
          muted: '#71717A',
          disabled: '#52525B',
          inverse: '#0A0A0B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
    },
  },
}
```

---

## Design Tokens Summary

| Token Category | Count | Example |
|----------------|-------|---------|
| Background Colors | 6 | `--bg-base: #0A0A0B` |
| Border Colors | 5 | `--border-default: rgba(255,255,255,0.08)` |
| Text Colors | 5 | `--text-primary: #FAFAFA` |
| Accent Colors | 6 | `--accent-primary: #FFFFFF` |
| Semantic Colors | 12 | `--color-success: #22C55E` |
| Category Colors | 6 | `--color-images: #8B5CF6` |
| Spacing | 14 | `--space-4: 16px` |
| Typography | 9 | `--text-body: 0.875rem` |
| Shadows | 6 | `--shadow-lg` |
| Z-Index | 10 | `--z-modal: 500` |

**Total: ~79 design tokens**

---

*This design system is optimized for Dark Mode and modern SaaS aesthetics. When implementing, prioritize consistency and restraint over decoration.*
