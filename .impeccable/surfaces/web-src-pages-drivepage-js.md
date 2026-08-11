---
version: 1
slug: "web-src-pages-drivepage-js"
primary_target: "web/src/pages/DrivePage.js"
related_targets: ["web/src/pages/LoginPage.js","web/src/pages/SharePage.js","web/src/pages/SettingsPage.js"]
---

# Wyvern Drive — Web App surface brief

- **Scope:** The authenticated drive surface (`web/src/pages/DrivePage.js` + entry views + dialogs + queue) and the two public poster surfaces (`LoginPage.js`, `SharePage.js`).
- **Visitor mode:** Operate for the drive; Persuade-lite for login/share (poster voice, task CTA).
- **Audience:** Self-hosting owner-operator; the task is managing personal files backed by Discord — upload, browse, search, share.
- **Task/action:** Upload and organize files; the primary action is the white Upload pill; row actions reveal on hover (desktop) or stay visible (touch).
- **Proof/content:** Mock-verified layout with real entry types (pdf/png/mp4/zip/audio/text/folders); quota readout in the toolbar.
- **Chosen direction:** Framer dark-canvas world — near-black canvas, Mona Sans display at 500 with hard negative tracking, Inter Variable body with OpenType variants, white pill primary CTA, binary ink/ink-muted hierarchy, one violet spotlight card (empty state), cloud-drive side rail, monochrome file glyphs. Memorable moment: the violet gradient spotlight empty state — the only chromatic atmosphere in the app.
- **Constraints:** Keep sidebar rail (user-confirmed over Framer top nav); monochrome icons (user-confirmed); blue is a signal color only; all 32 tests' pins (testids, aria-labels, exact texts) are load-bearing.
- **Unresolved:** None blocking. Gradient stops are anchors, not production-exact (Framer spec gap); real Discord E2E screenshots still require configured credentials.
