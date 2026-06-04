<!-- GSD:project-start source:PROJECT.md -->

## Project

**Wyvern Drive**

Wyvern Drive is a browser-based personal cloud storage application that utilizes Discord as a free, unlimited blob storage backend. Files are split into chunks of up to 24MB, uploaded via Discord webhooks, and indexed in a metadata database, providing a Google Drive-like user experience with zero server-side storage costs.

**Core Value:** Users get free, unlimited personal cloud storage with standard file manager features (folders, uploads, downloads) using their own Discord webhooks as the backend.

### Constraints

- **Storage Limit**: Chunks must be under 25MB (limit is set to 24MB to allow margin).
- **Zero Cost**: Architecture must run locally or on free VPS tiers with no database hosting fees.
- **Stateless Backend**: The server must not store webhook URLs persistently as credentials; authentication is handled via JWTs containing the webhook URL.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.agent/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
