# Testing

Wyvern Drive uses a two-layer test strategy: **unit + integration** with Vitest, and **end-to-end** with Playwright.

---

## Running Tests

```bash
npm test               # Run all unit + integration tests once
npm run test:watch     # Watch mode (re-runs on file change)
npm run test:e2e       # Playwright end-to-end suite
```

---

## Test Inventory

| File | Type | Count | Purpose |
|------|------|-------|---------|
| `src/lib/basic.test.ts` | Unit | 1 | Smoke test for the test runner setup |
| `src/lib/crypto.test.ts` | Integration | 6 | AES-256-GCM round-trip, IV handling, PBKDF2 key derivation |
| `src/lib/discord.test.ts` | Integration (MSW) | 3 | Webhook client against mocked Discord API |
| `src/lib/sharing.test.ts` | Integration | 7 | Share link encode/decode, password verification, expiry |
| `src/stores/file-store.test.ts` | Unit | 6 | Zustand file store CRUD, selection state |
| `src/components/Toast.test.tsx` | Component | 5 | Toast rendering and dismiss behavior |
| `tests/e2e/navigation.spec.ts` | E2E (Playwright) | 3 | Sidebar navigation, view switching |
| `tests/e2e/upload.spec.ts` | E2E (Playwright) | 1 | Drop-zone upload flow |
| `tests/e2e/share.spec.ts` | E2E (Playwright) | 1 | Share link open + download flow |

**Total:** 28 unit/integration tests + 5 E2E test stubs.

---

## Unit & Integration Tests (Vitest)

### Setup

`vitest` is configured with the `jsdom` environment (see `vite.config.ts`). Tests live next to the code they test with the `.test.ts` or `.test.tsx` suffix.

### Patterns

**Pure logic (no DOM):**
```ts
import { describe, it, expect } from 'vitest';
import { encryptChunk, decryptChunk } from './crypto';

describe('crypto', () => {
  it('round-trips a chunk', async () => {
    const key = await deriveKey('password', 'salt');
    const ciphertext = await encryptChunk(key, new Uint8Array([1, 2, 3]));
    const plaintext = await decryptChunk(key, ciphertext);
    expect(plaintext).toEqual(new Uint8Array([1, 2, 3]));
  });
});
```

**Component tests:**
```ts
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

it('renders toast when triggered', () => {
  function Trigger() {
    const { toast } = useToast();
    return <button onClick={() => toast({ title: 'Hi' })}>Show</button>;
  }
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>
  );
  fireEvent.click(screen.getByText('Show'));
  expect(screen.getByText('Hi')).toBeInTheDocument();
});
```

**Network mocks:** Use MSW (Mock Service Worker) for tests that hit the Discord API. See `src/lib/discord.test.ts` for an example.

---

## End-to-End Tests (Playwright)

### Setup

```bash
npx playwright install     # one-time, downloads Chromium/Firefox/WebKit
npm run test:e2e
```

### Specs

E2E specs live in `tests/e2e/*.spec.ts` and run against a built preview of the app:

1. `navigation.spec.ts` — Sidebar links switch views; back/forward works
2. `upload.spec.ts` — File drop → upload → appears in file list
3. `share.spec.ts` — Generate share link → open in new context → download

### Writing a New E2E Spec

```ts
import { test, expect } from '@playwright/test';

test('user can upload a file', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Password').fill('test-password');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.setInputFiles('input[type="file"]', 'fixtures/sample.png');
  await expect(page.getByText('sample.png')).toBeVisible();
});
```

---

## What to Test

| Layer | Test? | Why |
|-------|-------|-----|
| Pure functions in `lib/` | **Yes** | Cheap, fast, catch regressions in crypto/encoding |
| Zustand stores | **Yes** | State machines have edge cases (race conditions, stale state) |
| Components with interaction | **Yes (key flows)** | Focus on behavior, not implementation |
| Visual styling | **No (use Playwright snapshots sparingly)** | Style changes should not break tests |
| Discord API | **Mocked in `lib/`**, **real in E2E** | Two layers: unit tests are fast, E2E catches integration issues |

---

## CI

Wire `npm test` and `npm run test:e2e` into your CI pipeline. Both should pass before merging.

For E2E in CI, ensure `npx playwright install --with-deps` runs as a setup step on the CI runner.
