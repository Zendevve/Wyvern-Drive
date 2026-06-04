// SHAPE_SCALE — single source of truth for border-radius classes.
// Use SHAPE_SCALE.input for form inputs and small buttons.
// Use SHAPE_SCALE.card for cards, modals, panels, large surfaces.
// Use SHAPE_SCALE.pill for chips, badges, status dots, and round buttons.
export const SHAPE_SCALE = {
  input: 'rounded-lg',
  card: 'rounded-xl',
  pill: 'rounded-full',
} as const;

// Z_INDEX — single source of truth for stacking-context classes.
// Use these instead of arbitrary z-[N] values.
export const Z_INDEX = {
  base: 'z-0',
  raised: 'z-10',
  dropdown: 'z-20',
  sticky: 'z-30',
  overlay: 'z-40',
  modal: 'z-50',
  toast: 'z-[60]',
  skipLink: 'z-[100]',
} as const;

// SEMANTIC_COLORS — Tailwind class strings for status states.
// All values resolve to a declared @theme token from src/index.css.
export const SEMANTIC_COLORS = {
  success: { bg: 'bg-success', text: 'text-success', soft: 'bg-surface-success' },
  error: { bg: 'bg-destructive', text: 'text-destructive', soft: 'bg-surface-error' },
  warning: { bg: 'bg-warning', text: 'text-warning', soft: 'bg-surface-warning' },
  info: { bg: 'bg-primary', text: 'text-primary', soft: 'bg-primary/10' },
} as const;
