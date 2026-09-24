# Session Learnings

Append an entry after every session. Read relevant entries at session start when touching related areas.

## Format

```markdown
## YYYY-MM-DD — <short topic>

- **Takeaways:** what worked, decisions worth reusing.
- **Improvements:** what to do differently next time.
- **Bottlenecks:** what slowed things down and how to avoid it.
```

## 2026-09-24 — grill-with-docs on foundation plan

- **Takeaways:** grilling in frontier rounds with recommended answers kept momentum; accepting all recommendations per round converged fast. Resolved vault glossary early (Vault vs metadata-only vault) before behavior rounds.
- **Improvements:** ask tool caps options at a few items, so multi-question rounds need one ask call per question; batch them or use plain-text rounds instead.
- **Bottlenecks:** skill invocation via @-mention plus file attach needed manual skill-file reads; check skill directories directly when the Skill tool is unavailable.

## 2026-09-24 — to-spec publishing foundation spec

- **Takeaways:** seams check before writing kept the spec's testing story aligned; gh label bootstrap (4 missing labels) was a one-time cost. Spec uses glossary terms (Vault, metadata-only vault) throughout.
- **Improvements:** verify triage labels exist before publishing; create missing ones in the same session.
- **Bottlenecks:** none; gh auth already present, issue created as #1 with ready-for-agent.

## 2026-09-24 — to-tickets publishing 8 tickets

- **Takeaways:** approved breakdown published cleanly in dependency order (T1–T8 as #2–#9 under parent #1); correcting ticket bodies pre-publish avoided wrong blocked-by refs.
- **Improvements:** draft ticket bodies reference sibling issue numbers only after those issues exist; write T4+ bodies after publishing blockers.
- **Bottlenecks:** edit-tool line anchoring needed re-reads on small draft files; keep drafts short or use write-once bodies.

## 2026-09-24 — implement T1 + T3 (core skeleton, domain model)

- **Takeaways:** empty-tree baseline confirmed by both workers via read-only repo-state check before any code; TDD red-green at agreed seams (CLI/config/logging/app lifecycle; domain API + NormalizeName) produced green suites first pass with only small reds (import path, fold signature, usage-text, closer leak); read-only review caught real issues (log ownership, dual flag-parse, port-0 gate) fixed minimally same-session; selective `git add -- <paths>` kept the 91 stale enterprise deletions unstaged and unrelated docs untracked.
- **Improvements:** write ticket bodies' blocked-by refs only after blockers are published; give workers explicit go.mod-ownership rules up front when two streams share it (T1 owns, T3 requires).
- **Bottlenecks:** installed Go 1.23.4 vs pinned 1.27.1 was a non-issue (GOTOOLCHAIN=auto used cached 1.27.1); Windows skips POSIX-only tests (unreadable-config, dir modes) and child-interrupt shutdown test — manual smoke still owns those surfaces.

## 2026-09-24 — implement T2 + T4

- **Takeaways:** T2 single-conn SQLite store (WAL verified, DSN pragmas) + VACUUM INTO migrations (checksums, newer-refusal, gap-refusal, rollback, backup-abort proof) + Readiness passthrough + health-only daemon; T4 Store/Tx repositories with numeric-code mapping (no string parsing), CAS UpdateJob, 0002 metadata migration (partial uniques, RESTRICT FKs), synthetic-test backend refs with discord-grep proof; Spec review clean, Standards review caught SIGTERM gap + backup-abort proof + naming/smells (mapConstraint helper, dead consts), all fixed same-session; selective commits (`git add -- <paths>`) kept stale enterprise deletions unstaged — T4 commit f2a7f3c holds only its 7 paths.
- **Improvements:** empty-report worker turns need an explicit report-only follow-up turn; budget report templates (files + verbatim outputs + checklist + SHA) so delegated reports land structured first time.
- **Bottlenecks:** Windows skips child-signal shutdown tests (SIGTERM/interrupt to a child unsupported) — Linux CI owns them; modernc CGO-free build verified (`CGO_ENABLED=0 go build ./...` exit 0).

## 2026-09-24 — implement T5 metadata service

- **Takeaways:** 8 folder ops with one WithTx each (lookups included); no-precheck collision mapping via unique-constraint attempt; ancestor-walk cycle safety with visited sets (move + recursive delete); DTO-only facade with safe error envelope (sizes as decimal strings, UTC RFC3339Nano, NULLs stay null); restart proof (IDs stable, file/chunk/job int64 intact, no bytes) + barrier-concurrency tests (channels, never sleeps) with reciprocal-moves stress -count=20 green; review caught missing parent-availability check — plan required available-parent enforcement in the service, not just kind/existence.
- **Improvements:** review must check the plan's adjectives, not just the ticket's bullets — "available folder" parent requirement lived in the plan text.
- **Bottlenecks:** none material; stdlib-only kept go.mod untouched.

## 2026-09-24 — implement T6 native shell

- **Takeaways:** Wails beta.25 pinned API verified from module cache before coding — MarshalError is func(error) []byte; bindings generate before Vite per plan's embed-cycle rule; PrintWindow captures WebView2 DComposition surfaces black — CopyFromScreen proves real render; prod embed + out-of-tree launch verified.
- **Improvements:** smoke probes should prefer composited screen capture over PrintWindow for WebView2; record framework-blocked automation paths with root cause instead of retrying ports.
- **Bottlenecks:** Wails beta.25 scrubs WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS via preventEnvAndRegistryOverrides — CDP automation impossible; Windows Ctrl-C graceful shutdown + UI flows remain human/T7-owned; lockfile authored on Node 22.15.1 vs pin 24.21.0 — revisit when T7 provisions Node 24 for jsdom 30.

## 2026-09-24 — implement T7 metadata UI

- **Takeaways:** client seam (native + wails) let jsdom seam tests cover browser/folder/vault/dialog flows without WebView2; accurate global click needs composited-capture rect + screenshot-local center (rect 133,9 + local 326..420 x 141..176 = ~495,166); selective `git add -- <21 T7 paths>` committed 74be60a with stale deletions/docs left unstaged.
- **Improvements:** verify foreground-window rect in the same run before computing click coords; keep one focused click/screenshot per smoke attempt, then commit and report.
- **Bottlenecks:** WezTerm focus stayed foreground during smoke — captures showed the terminal, not the app window; no dialog-open evidence this run.
