# Development

## Dev Workflow

```bash
npm run dev          # Vite dev server with HMR (localhost:5173)
npm run build        # TypeScript check + production build → dist/
npm run preview      # Serve dist/ for smoke testing
npm test             # Run unit + integration tests once
npm run test:watch   # Watch mode for tests
npm run test:e2e     # Playwright end-to-end tests
```

---

## Project Layout

```
src/
├── components/      # React components (UI)
├── lib/             # Pure logic (crypto, storage, discord, sharing, …)
├── stores/          # Zustand stores
├── hooks/           # Custom React hooks
├── types/           # TypeScript type definitions
└── utils/           # Stateless helper functions

tests/               # Playwright E2E specs (sibling to src/)

.planning/           # GSD planning artifacts (roadmap, phases, summaries)
docs/                # This documentation
```

---

## Code Conventions

- **TypeScript strict mode** — `tsconfig.json` enables `strict: true`. Avoid `any`; use `unknown` and narrow.
- **ESM** — `"type": "module"` in `package.json`. All imports use the `.ts/.tsx` extension-less form.
- **Functional React** — No class components. Hooks only.
- **Zustand selectors** — Always pass a selector to avoid full-store re-renders:
  ```ts
  const theme = useThemeStore(s => s.theme);
  // not: const { theme } = useThemeStore();
  ```
- **Tailwind v4** — Use theme tokens (`bg-background`, `text-foreground`, `font-display`) over raw color values. No inline `style` props for colors.
- **Component composition** — Prefer small, focused components. Co-locate state with the component that uses it; lift only when sharing is needed.
- **No barrel files** — Import directly from the file: `import { Foo } from '../components/Foo'`.

---

## Adding a Component

1. Create `src/components/MyComponent.tsx`.
2. Co-locate its store logic in `src/stores/my-store.ts` if it's stateful.
3. Add a test in `src/components/MyComponent.test.tsx` if it has user interaction.
4. Import into `App.tsx` or the parent that renders it.

---

## Adding a Store

1. Create `src/stores/<name>-store.ts`.
2. Use Zustand's `create` function with explicit types:

   ```ts
   import { create } from 'zustand';

   interface MyState {
     value: number;
     setValue: (v: number) => void;
   }

   export const useMyStore = create<MyState>((set) => ({
     value: 0,
     setValue: (v) => set({ value: v }),
   }));
   ```

3. Add a test in `src/stores/<name>-store.test.ts`.
4. Never mutate state outside `set()`.

---

## Adding a lib Module

Pure logic goes in `src/lib/`. Conventions:

- No React imports — pure functions only.
- Export named functions, not default.
- If the module is computationally expensive (crypto, chunking), consider running it in `crypto.worker.ts` (a Web Worker).

---

## Web Crypto Notes

All encryption goes through `lib/crypto.ts`, which wraps the Web Crypto API. Key points:

- AES-256-GCM with 12-byte IV, prepended to the ciphertext.
- PBKDF2 with 600K iterations (OWASP 2023) for password-derived keys.
- The derived key is held in memory in `useAuthStore`; cleared on lock.

When adding new crypto operations, follow the existing `encryptChunk` / `decryptChunk` shape and add a test in `src/lib/crypto.test.ts`.

---

## Branching & Commits

- Main branch: `master`
- Feature branches: `feature/<short-name>` or `fix/<short-name>`
- Commits: imperative mood, present tense ("Add chunk retry", not "Added chunk retry")

---

## Pre-commit Checklist

- `npm test` passes (28 unit + integration tests)
- `npm run build` succeeds (TypeScript strict mode + Vite production build)
- New code has tests for any non-trivial logic
- No `console.log` left behind (use the toast system for user-facing messages)
