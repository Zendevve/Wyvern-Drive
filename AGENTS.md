# AGENTS.md - Wyvern Drive

## Project Overview
**Name:** Wyvern Drive
**Stack:** Vite + React 18 + TypeScript (web), Express + TypeScript (server), Chrome Extension (Manifest V3)
**Purpose:** Discord-based cloud storage with encryption, folder operations, and file versioning

## Commands

| Task | Command | Directory |
|------|---------|-----------|
| Web Dev | `npm run dev` | `wyvern-web/` |
| Web Build | `npm run build` | `wyvern-web/` |
| Server Dev | `npm run dev` | `wyvern-server/` |
| Test | `npm test` | any package |
| Lint | `npm run lint` | any package |
| Type Check | `npm run typecheck` | any package |

## Development Flow

1. **Read docs first** — Check `docs/Features/` for existing specs before coding
2. **Plan before code** — For non-trivial changes, create/update feature doc
3. **Tests with code** — Write integration tests alongside implementation
4. **Verify** — Run tests and linter before considering work complete
5. **Update docs** — Keep feature docs in sync with implementation

## Testing Discipline

### Order
1. New/modified tests for current change
2. Related suite for affected module
3. Full test suite before PR

### Rules
- Integration tests use real containers (Docker Compose for SQLite)
- No mocking internal services (database, file manager)
- External APIs (Discord) use test webhooks or sandboxed fakes
- Every feature has at least one integration test

## Coding Rules

### Must Do
- Use TypeScript strict mode
- Extract constants (chunk sizes, URLs, keys) to config
- Handle all error cases with proper user feedback
- Write JSDoc for public APIs
- Use async/await, not raw promises

### Must Not
- No `any` types without explicit justification
- No console.log in production (use logger)
- No hardcoded Discord webhook URLs
- No synchronous file operations

### Patterns
- File operations: encrypt → chunk → upload → store metadata
- Downloads: fetch metadata → download chunks → decrypt → merge
- Errors: try/catch with typed error classes

## Maintainer Preferences
- Prefer functional components with hooks
- Use Zustand for state management
- CSS-in-JS via vanilla CSS or CSS modules (no Tailwind unless requested)
- Commit messages: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`

## Self-Learning

When receiving feedback:
1. Identify if it's a **directive** (must do), **preference** (style), or **correction** (fix mistake)
2. For recurring patterns across 2+ tasks, propose adding to this file
3. For local patterns, add to directory-specific AGENTS.md
4. Update existing rules if they conflict with new feedback

---
*Last updated: December 2025*
