# AGENTS.md - Wyvern Drive

> **MCAF-Compliant Repository Instructions**
> **Last Updated:** 2025-12-18

---

## Project Overview

**Name:** Wyvern Drive
**Stack:** Vite + React 18 + TypeScript (web), Express + SQLite Localhost (backend), Chrome Extension (Manifest V3)
**Purpose:** Discord-based cloud storage with encryption, folder operations, and file versioning

Follows **[MCAF](https://mcaf.managed-code.com/)** (Managed Code AI Framework)

---

## Conversations (Self-Learning)

Learn the user's habits, preferences, and working style. Extract rules from conversations, save to "## Rules to follow", and generate code according to the user's personal rules.

**Update requirement (core mechanism):**

Before doing ANY task, evaluate the latest user message.
If you detect a new rule, correction, preference, or change → update `AGENTS.md` first.
Only after updating the file you may produce the task output.
If no new rule is detected → do not update the file.

**When to extract rules:**

- **prohibition words** (never, don't, stop, avoid) or similar → add NEVER rule
- **requirement words** (always, must, make sure, should) or similar → add ALWAYS rule
- **memory words** (remember, keep in mind, note that) or similar → add rule
- **process words** (the process is, the workflow is, we do it like) or similar → add to workflow
- **future words** (from now on, going forward) or similar → add permanent rule

**Preferences → add to Preferences section:**

- **positive** (I like, I prefer, this is better) or similar → Likes
- **negative** (I don't like, I hate, this is bad) or similar → Dislikes
- **comparison** (prefer X over Y, use X instead of Y) or similar → preference rule

**Corrections → update or add rule:**

- **error indication** (this is wrong, incorrect, broken) or similar → fix and add rule
- **repetition frustration** (don't do this again, you ignored, you missed) or similar → emphatic rule
- **manual fixes by user** → extract what changed and why

**Strong signal (add IMMEDIATELY):**

- **swearing, frustration, anger, sarcasm** → critical rule
- **ALL CAPS, excessive punctuation** (!!!, ???) → high priority
- **same mistake twice** → permanent emphatic rule
- **user undoes your changes** → understand why, prevent

**Ignore (do NOT add):**

- **temporary scope** (only for now, just this time, for this task) or similar
- one-off exceptions
- context-specific instructions for current task only

**Rule format:**

- One instruction per bullet
- Tie to category (Testing, Code, Docs, etc.)
- Capture WHY, not just what
- Remove obsolete rules when superseded

---

## Commands

| Task | Command | Directory |
|------|---------|-----------|
| **Web Dev** | `npm run dev` | `wyvern-web/` |
| **Web Build** | `npm run build` | `wyvern-web/` |
| **Test** | `npm test` | any package |
| **Lint** | `npm run lint` | any package |
| **Format** | `npm run format` | any package |
| **Type Check** | `npm run typecheck` | any package |

---

## Task Delivery (ALL TASKS)

1. **Read assignment** — Check `docs/Features/`, `docs/ADR/`, and relevant code before planning
2. **Write multi-step plan** — For non-trivial tasks, create or update feature doc using `docs/templates/Feature-Template.md`
3. **Implement code and tests together** — Never commit code without corresponding tests
4. **Run tests in layers:**
   - New/modified tests for current change
   - Related suite for affected module
   - Full test suite before considering complete
5. **After all tests pass:**
   - Run format (`npm run format`)
   - Run build (`npm run build`)
   - Run static analysis/lint (`npm run lint`)
6. **Summarize changes and test results** before marking complete
7. **Always run required builds and tests yourself**; do not ask the user to execute them (explicit user directive)

---

## Documentation (ALL TASKS)

- All docs live in `docs/` structure:
  - `docs/Features/` — Feature specifications
  - `docs/ADR/` — Architecture Decision Records
  - `docs/Architecture/` — System diagrams, boundaries
  - `docs/Design/` — Design system, UI/UX guidelines
  - `docs/Testing/` — Test strategy
  - `docs/Operations/` — Deployment, monitoring
  - `docs/Development/` — Local setup
  - `docs/templates/` — Templates for new docs

- **Update feature docs** when behavior changes
- **Update ADRs** when architecture changes
- **Use templates:** `docs/templates/Feature-Template.md`, `docs/templates/ADR-Template.md`, `docs/templates/Test-Template.md`

---

## Testing (ALL TASKS)

- **Every behavior change needs sufficient automated tests** to cover its cases; one is the minimum, not the target
- **Each public API endpoint** has at least one test; complex endpoints have tests for different inputs and errors
- **Integration tests must exercise real flows end-to-end**, not just call endpoints in isolation
- **Prefer integration/API/UI tests** over unit tests
- **No mocks for internal systems** (DB, caches, file manager) — use real instances or containers
- **Mocks only for external third-party systems** (Discord API)
- **Never delete or weaken a test** to make it pass
- **Each test verifies a real flow or scenario**, not just calls a function — tests without meaningful assertions are forbidden
- **Check code coverage** to see which functionality is actually tested; coverage is for finding gaps, not a number to chase

### Test Levels

| Level | Purpose | Example |
|-------|---------|---------|
| **Unit** | Complex algorithms, pure functions | Encryption/decryption logic |
| **Integration** | Components + real services | File upload with Supabase |
| **API** | Public endpoints, HTTP flows | REST API routes |
| **UI/E2E** | Full user flows | Upload file via browser |

---

## UI/UX Laws (ALWAYS FOLLOW)

### Cognitive Psychology Principles

**Miller's Law** — Average person can only hold 7±2 items in working memory
- Limit navigation items to <7
- Chunk file lists into pages/groups
- Use progressive disclosure for complex settings

**Hick's Law** — Decision time increases logarithmically with choices
- Minimize button options in modals (max 3 actions)
- Hide advanced options behind "Advanced" toggle
- Use defaults to reduce decisions

**Gestalt Principles** — Visual grouping
- **Proximity:** Group related items with tight spacing (e.g., label + input)
- **Similarity:** Use consistent colors for file types
- **Common Region:** Card pattern for file items
- **Uniform Connectedness:** Breadcrumb arrows connect navigation

**Jakob's Law** — Users expect your site to work like others
- Follow standard file browser conventions (double-click to open, right-click context menu)
- Upload button in top-right (standard for cloud storage)
- Settings icon = gear, always top-right

**Peak-End Rule** — Users judge experience by peak and end moments
- Success animations on upload complete (positive peak)
- Graceful error recovery (avoid negative end)
- Delightful empty states

**Aesthetic-Usability Effect** — Beautiful = more usable (perception)
- Maintain design system consistency
- Smooth transitions (200ms duration)
- High-quality icons and imagery

---

## Accessibility (WCAG AA REQUIRED)

- [ ] **Color contrast:** 4.5:1 for normal text, 3:1 for large text
- [ ] **Keyboard navigable:** All interactive elements must be focusable and operable via keyboard
- [ ] **Screen reader compatible:** Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- [ ] **Focus management:** Visible focus rings, logical tab order
- [ ] **Motion:** Respect `prefers-reduced-motion` media query
- [ ] **Touch targets:** Minimum 44×44px for mobile
- [ ] **Alt text:** All images and icons have descriptive alternatives
- [ ] **Color is not sole conveyor of information:** Errors use icon + color + text

---

## Coding Rules

### Must Do

- Use **TypeScript strict mode**
- Extract constants (chunk sizes = 25MB, URLs, keys) to config files
- Handle **all error cases** with proper user feedback
- Write **JSDoc for public APIs**
- Use **async/await**, not raw promises
- Follow **design system** (`docs/design-system.md`) for all UI components
- Use **semantic HTML** (`<button>` not `<div onClick>`)

### Must Not

- No `any` types without explicit justification
- No `console.log` in production (use logger or suppress)
- No hardcoded Discord webhook URLs (use env vars)
- No synchronous file operations
- No magic numbers (extract to constants)
- No pure black (#000000) for text (use #121212)
- No justified text alignment (causes readability issues)
- **No hardcoded border-radius values** (use design system variables)
- **No colors outside design system** (use CSS custom properties)
- **No form inputs without labels** (accessibility violation)

### Patterns

- **File upload:** encrypt → chunk (25MB) → upload to Discord → store metadata in SQLite (Local Backend)
- **File download:** fetch metadata → download chunks → decrypt → merge to Blob
- **Errors:** try/catch with typed error classes, user-facing messages
- **State:** Zustand for global state, React hooks for local state

---

## Quality Standards (From Audit)

### Form Inputs (NEVER VIOLATE)

- **Every `<input>` must have associated `<label>` with `htmlFor`**
  ```tsx
  // ❌ BAD
  <input type="text" placeholder="Name" />

  // ✅ GOOD
  <label htmlFor="name-input">Name</label>
  <input id="name-input" type="text" />
  ```

- **Error states must use: color + icon + text**
  ```tsx
  {error && (
    <div className="error" role="alert">
      <AlertIcon aria-hidden="true" />
      <p id="error-msg">{error}</p>
    </div>
  )}
  ```

- **Use `aria-invalid` and `aria-describedby` for errors**

### Button Standards (ALWAYS)

- **Capitalization:** Title Case ("Upload File", not "upload file" or "UPLOAD FILE")
- **Padding:** Multiple of 4px (8px, 12px, 16px) — **never 14px, 10px, etc.**
- **Radius:** Use `var(--radius-lg)` from design system, **never hardcoded**
- **Touch targets:** Minimum 44×44px on mobile (use padding to expand)

### Design System Compliance (ALWAYS)

- **Border radius:** Use CSS variables only
  ```css
  /* ❌ BAD */
  border-radius: 8px;

  /* ✅ GOOD */
  border-radius: var(--radius-lg);
  ```

- **Colors:** Use design system variables only
  ```css
  /* ❌ BAD */
  background: #8B5CF6;

  /* ✅ GOOD */
  background: var(--accent);
  ```

- **Spacing:** All spacing follows 4px grid (4, 8, 12, 16, 20, 24, 32, 40...)
  ```css
  /* ❌ BAD */
  padding: 10px 14px;

  /* ✅ GOOD */
  padding: 12px 16px;
  ```

---

## Definition of Done

A task is complete when:

- [ ] All tests pass (new, related, full suite)
- [ ] Static analysis/linter clean (`npm run lint`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Feature doc exists for non-trivial features
- [ ] ADR exists for architectural changes
- [ ] Accessibility checklist passes
- [ ] No `console.log` or debug statements in production code
- [ ] Design system followed consistently
- [ ] Documentation updated (feature docs, ADRs, README if applicable)

---

## Quality Gates (Hard Blockers)

**NEVER PROCEED if:**

- Tests fail
- TypeScript compilation errors
- Linter errors (warnings may be acceptable with justification)
- Missing feature doc for new feature
- Missing ADR for architectural change
- Accessibility violations (contrast, keyboard nav)
- Breaking changes without migration path

---

## Maintainer Preferences

### Likes

- Functional components with hooks
- Zustand for state management
- Vanilla CSS or CSS modules (clean separation)
- Mermaid diagrams for flows
- Explicit error handling (no silent failures)

### Dislikes

- Tailwind CSS (avoid unless explicitly requested)
- Class components (use functional)
- Inline styles (use CSS files)
- Overly nested ternaries (extract to variables)
- Generic error messages ("Something went wrong")

### Code Style

- **Commit messages:** `feat:`, `fix:`, `docs:`, `test:`, `refactor:`
- **File naming:** `PascalCase` for components (`FileGrid.tsx`), `camelCase` for utilities (`encryptFile.ts`)
- **CSS naming:** BEM convention or CSS modules
- **Indentation:** 2 spaces
- **Quotes:** Single quotes for JS/TS, double for JSX attributes

---

## Autonomy (AGENT BEHAVIOR)

- **Start work immediately** — No permission seeking for obvious tasks
- **Questions only for architecture blockers** not covered by ADR or feature doc
- **Report only when task is complete** (or blocked)
- **Proactively update docs** when implementation reveals new patterns
- **Propose AGENTS.md updates** when stable feedback patterns emerge

---

## Critical (NEVER VIOLATE)

- **Never commit secrets, keys, connection strings** (use `.env` files, gitignored)
- **Never mock internal systems** in integration tests (SQLite database, file manager)
- **Never skip tests** to make PR green
- **Never force push to main**
- **Never approve or merge** (human decision)
- **Never use deceptive UI patterns** (dark patterns, confirmshaming, trick wording)
- **Never sacrifice accessibility** for aesthetics
- **Never ignore user corrections twice** (if same mistake, update AGENTS.md permanently)

---

## Boundaries

### Always Do

- Read `AGENTS.md` and `docs/` before editing code
- Run tests before commit
- Update feature docs when behavior changes
- Add ADR for significant architectural decisions

### Ask First

- Changing public API contracts (breaking changes)
- Adding new dependencies (NPM packages)
- Modifying database schema
- Deleting code files
- Major UI redesigns (consult design system first)

---

*This AGENTS.md is a living document. Update it when stable patterns emerge from feedback. It is the single source of truth for how AI agents work in this repository.*

---

**Last updated:** 2025-12-18
