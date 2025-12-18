# Quality Improvement Backlog

> **Created:** 2025-12-18
> **Source:** MCAF Quality Audit
> **Full Report:** [quality-audit-2025-12-18.md](./quality-audit-2025-12-18.md)

---

## Progress Summary

- ✅ **Critical:** 4/4 complete (100%)
- ✅ **High:** 6/6 complete (100%)
- ⏳ **Medium:** 2/9 complete (22%)
- ⏳ **Low:** 0/5 complete (0%)

**Total:** 12/24 issues resolved (50%)

---

## 🔴 Critical (All Complete! ✅)

- [x] **A1:** Add labels to form inputs (`RenameModal`) — _Fixed 2025-12-18_
- [x] **A2:** Add icon + role to error messages — _Fixed 2025-12-18_
- [x] **V1:** Fix border radius inconsistency (use CSS variables) — _Fixed 2025-12-18_
- [x] **V2:** Fix button padding to 4px grid — _Fixed 2025-12-18_

---

## 🟠 High Priority (Fix This Sprint)

- [x] **A4:** Add visible focus indicators — _Fixed 2025-12-18_
  - **Fix:** Added `focus-visible:ring-2 focus-visible:ring-accent` to FileGrid

- [x] **A5:** ~~Increase touch target size (search clear button)~~ — _Fixed 2025-12-18_

- [x] **A6:** Add `aria-live` for search results — _Fixed 2025-12-18_
  - **Fix:** Added live region announcing file count

- [x] **V3:** ~~Change selection color to accent violet~~ — _Fixed 2025-12-18_

- [x] **V4:** Check icon optical centering — _Audited 2025-12-18_
  - **Result:** Icons already use flexbox centering (align-items/justify-content: center)

- [x] **UX1:** Count sidebar nav items (Miller's Law) — _Audited 2025-12-18_
  - **Result:** 7 items (at limit, compliant)

- [x] **UX6:** Add upload success animation (Peak-End Rule) — _Fixed 2025-12-18_
  - **Fix:** Created SuccessToasts component with slide-in animation and pulse effect

---

## 🟡 Medium Priority (Backlog)

- [x] **A7:** Add skip link — _Fixed 2025-12-18_
  - **Fix:** Added skip link in `App.tsx`

- [ ] **A8:** Audit for generic link text
  - **Location:** Various
  - **Fix:** Replace "Click here" with descriptive text
  - **Effort:** 🟡 Medium (1 hour - needs code search)

- [x] **V5:** Increase mobile search box width — _Fixed 2025-12-18_
  - **Fix:** Changed `min-width: 150px` → `180px` in `Toolbar.css`

- [ ] **V6:** Verify heading hierarchy
  - **Location:** Various
  - **Fix:** Ensure no skipped heading levels
  - **Effort:** 🟡 Medium (30 min audit)

- [ ] **UX3:** Visual inspection of file grid spacing
  - **Location:** `FileGrid.tsx:143-146`
  - **Fix:** Verify 16px gap creates clear grouping
  - **Effort:** 🟢 Small (10 min visual check)

- [ ] **UX4:** Verify Jakob's Law compliance
  - **Location:** Various
  - **Fix:** Confirm right-click menu, drag-drop exist
  - **Effort:** 🟢 Small (15 min testing)

- [ ] **UX5:** Ensure icon-only buttons have adequate hit area
  - **Location:** `Toolbar.css:286-288`
  - **Fix:** Ensure `padding: 12px` minimum on mobile
  - **Effort:** 🟢 Small (10 min)

- [ ] **UX7:** Performance testing for response times
  - **Location:** Various interactions
  - **Fix:** Verify all interactions < 400ms
  - **Effort:** 🔴 Large (requires performance profiling)

- [ ] **UX8:** Final aesthetic polish pass
  - **Location:** Overall
  - **Fix:** Address V1, V2 inconsistencies
  - **Effort:** 🟡 Medium (2-3 hours)

---

## 🔵 Low Priority (Nice to Have)

- [ ] **UX2:** Hick's Law - Button count in modals
  - **Status:** ✅ Already compliant (only 2 buttons)
  - **Effort:** N/A

- [ ] Additional items from audit (see full report)

---

## How to Use This Document

1. **Pick an issue** from High/Medium priority
2. **Read full details** in [quality-audit-2025-12-18.md](./quality-audit-2025-12-18.md)
3. **Implement fix** following the guidance
4. **Check the box** `[ ]` → `[x]`
5. **Add date** e.g., `— _Fixed 2025-12-18_`
6. **Commit** with message: `fix(accessibility): [issue ID] [description]`

---

## Related Documentation

- **Full Audit Report:** [quality-audit-2025-12-18.md](./quality-audit-2025-12-18.md)
- **Accessibility Checklist:** [Design/accessibility-checklist.md](./Design/accessibility-checklist.md)
- **Quality Checklist:** [Design/quality-checklist.md](./Design/quality-checklist.md)
- **UI/UX Laws:** [Design/ui-ux-laws.md](./Design/ui-ux-laws.md)
- **AGENTS.md Quality Standards:** [../AGENTS.md](../AGENTS.md)

---

**Last Updated:** 2025-12-18
