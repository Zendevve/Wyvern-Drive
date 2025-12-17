# Accessibility Checklist (WCAG AA)

> **Standard:** WCAG 2.1 Level AA
> **Last Updated:** 2025-12-18

---

## Overview

This checklist ensures that Wyvern Drive is usable by people with disabilities. WCAG AA compliance is a **hard requirement**, not an optional feature.

---

## 1. Perceivable

### 1.1 Text Alternatives

- [ ] **All images have alt text** that describes their purpose
  ```html
  <!-- ❌ BAD -->
  <img src="file-icon.png">

  <!-- ✅ GOOD -->
  <img src="file-icon.png" alt="PDF document">
  ```

- [ ] **Decorative images use empty alt** (`alt=""`) to hide from screen readers
  ```html
  <img src="decorative-pattern.svg" alt="" aria-hidden="true">
  ```

- [ ] **Icons have accessible labels**
  ```tsx
  <button aria-label="Delete file">
    <TrashIcon />
  </button>
  ```

### 1.2 Time-based Media

- [ ] **Videos have captions** (if applicable)
- [ ] **Audio descriptions provided** for important visual information

### 1.3 Adaptable

- [ ] **Content order makes sense** when CSS is disabled
  ```tsx
  <!-- ✅ Logical source order -->
  <div>
    <h1>Settings</h1>
    <nav>...</nav>
    <main>...</main>
  </div>
  ```

- [ ] **Form inputs have associated labels**
  ```html
  <!-- ❌ BAD: Placeholder as label -->
  <input placeholder="Email">

  <!-- ✅ GOOD: Explicit label -->
  <label for="email">Email</label>
  <input id="email" type="email">
  ```

- [ ] **Tables use proper headers** (`<th>` with `scope` attribute)

### 1.4 Distinguishable

- [ ] **Text contrast ratio ≥ 4.5:1** for normal text
  - Test tool: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
  ```css
  /* ✅ GOOD: #FAFAFA on #0A0A0B = 15.8:1 */
  color: var(--text-primary);
  background: var(--bg-base);

  /* ❌ BAD: #AAA on #FFF = 2.3:1 */
  color: #AAA;
  background: #FFF;
  ```

- [ ] **Large text contrast ratio ≥ 3:1** (18pt or 14pt bold)

- [ ] **Color is not the sole conveyor of information**
  ```tsx
  <!-- ❌ BAD: Color only -->
  <p style={{ color: 'red' }}>Error occurred</p>

  <!-- ✅ GOOD: Icon + color + text -->
  <div className="error">
    <AlertIcon />
    <p>Error: File upload failed</p>
  </div>
  ```

- [ ] **Text can be resized to 200%** without loss of content or functionality

- [ ] **No horizontal scrolling at 320px width** (mobile reflow)

---

## 2. Operable

### 2.1 Keyboard Accessible

- [ ] **All functionality available via keyboard**
  - Tab through all interactive elements
  - Enter/Space activates buttons
  - Escape closes modals

- [ ] **No keyboard traps**
  ```tsx
  // ✅ Modal with focus trap
  <Modal onClose={handleClose}>
    <FocusTrap>
      <button onClick={handleClose}>Close</button>
    </FocusTrap>
  </Modal>
  ```

- [ ] **Skip links for main content**
  ```html
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <main id="main-content">...</main>
  ```

### 2.2 Enough Time

- [ ] **No time limits** (or user can extend/disable)
- [ ] **Auto-updating content can be paused** (carousels, live feeds)

### 2.3 Seizures and Physical Reactions

- [ ] **No content flashes more than 3 times per second**
- [ ] **Respect `prefers-reduced-motion`**
  ```css
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

### 2.4 Navigable

- [ ] **Page has a unique, descriptive title**
  ```html
  <title>Upload Files - Wyvern Drive</title>
  ```

- [ ] **Focus order is logical** (matches visual order)

- [ ] **Link purpose is clear from link text**
  ```html
  <!-- ❌ BAD -->
  <a href="/report.pdf">Click here</a>

  <!-- ✅ GOOD -->
  <a href="/report.pdf">Download 2025 Financial Report (PDF, 2MB)</a>
  ```

- [ ] **Multiple ways to find content** (navigation, search, sitemap)

- [ ] **Headings and labels are descriptive**
  ```html
  <!-- ❌ BAD: Generic -->
  <h2>Section</h2>

  <!-- ✅ GOOD: Specific -->
  <h2>Recent Uploads</h2>
  ```

- [ ] **Visible focus indicator**
  ```css
  button:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
  }
  ```

---

## 3. Understandable

### 3.1 Readable

- [ ] **Language of page is declared**
  ```html
  <html lang="en">
  ```

- [ ] **Language changes are marked**
  ```html
  <p>Welcome to <span lang="fr">Français</span> mode</p>
  ```

### 3.2 Predictable

- [ ] **Navigation is consistent** across pages
- [ ] **Components behave consistently** (all buttons work the same way)
- [ ] **No context changes on focus** (no auto-submit on select)
- [ ] **Context changes are indicated** before they occur
  ```tsx
  <button onClick={openNewTab}>
    Open in new tab
    <ExternalLinkIcon aria-hidden="true" />
  </button>
  ```

### 3.3 Input Assistance

- [ ] **Error messages are descriptive**
  ```tsx
  <!-- ❌ BAD -->
  <p>Invalid input</p>

  <!-- ✅ GOOD -->
  <p id="email-error">Email must include @ symbol</p>
  <input
    aria-describedby="email-error"
    aria-invalid="true"
  />
  ```

- [ ] **Labels and instructions are provided**
  ```html
  <label for="password">
    Password
    <span class="hint">Minimum 8 characters</span>
  </label>
  <input id="password" type="password">
  ```

- [ ] **Error prevention for critical actions** (confirmation modals)

- [ ] **Suggestions provided for input errors**
  ```tsx
  <div role="alert">
    <p>File upload failed.</p>
    <p>Try: Ensure file is less than 500MB, or check your connection.</p>
  </div>
  ```

---

## 4. Robust

### 4.1 Compatible

- [ ] **Valid HTML** (no unclosed tags, duplicate IDs)
  - Test: [W3C Validator](https://validator.w3.org/)

- [ ] **Name, Role, Value for all UI components**
  ```tsx
  <div
    role="button"
    tabIndex={0}
    onClick={handleClick}
    onKeyDown={handleKeyDown}
    aria-pressed={isPressed}
  >
    Toggle
  </div>

  <!-- Better: Use native element -->
  <button aria-pressed={isPressed}>Toggle</button>
  ```

- [ ] **Status messages use appropriate ARIA**
  ```tsx
  <div role="status" aria-live="polite">
    File uploaded successfully
  </div>

  <div role="alert" aria-live="assertive">
    Error: Upload failed
  </div>
  ```

---

## Touch and Mobile

- [ ] **Touch targets ≥ 44×44 CSS pixels**
  ```css
  .touch-target {
    min-width: 44px;
    min-height: 44px;
  }
  ```

- [ ] **Adequate spacing between touch targets** (8px minimum)

- [ ] **No hover-only content** (provide alternative for touch devices)

---

## Forms

- [ ] **Required fields are marked**
  ```html
  <label for="email">
    Email <span aria-label="required">*</span>
  </label>
  <input id="email" required aria-required="true">
  ```

- [ ] **Autocomplete attributes are used**
  ```html
  <input type="email" autocomplete="email">
  <input type="password" autocomplete="current-password">
  ```

- [ ] **Fieldsets group related inputs**
  ```html
  <fieldset>
    <legend>Billing Address</legend>
    <input name="street" autocomplete="street-address">
    <input name="city" autocomplete="city">
  </fieldset>
  ```

---

## Testing Checklist

### Automated Tools

Run on every PR:

```bash
# Install axe-core
npm install -D @axe-core/cli

# Run automated tests
npx axe http://localhost:5173
```

### Manual Testing

- [ ] **Keyboard navigation test**
  - Unplug mouse
  - Navigate entire app via Tab, Enter, Escape, Arrow keys

- [ ] **Screen reader test**
  - Windows: NVDA (free)
  - macOS: VoiceOver (built-in)
  - Test critical flows (upload, download, delete)

- [ ] **Zoom test**
  - Zoom to 200% (Ctrl/Cmd +)
  - Ensure no horizontal scroll, all content accessible

- [ ] **Color blindness test**
  - Use browser extension (e.g., "Colorblind - Dalton")
  - Verify all states are distinguishable

- [ ] **`prefers-reduced-motion` test**
  - Enable in OS settings
  - Verify animations are disabled or reduced

---

## Common Mistakes to Avoid

| Mistake | Impact | Fix |
|---------|--------|-----|
| **Placeholder as label** | Screen reader users don't know what input is for | Use `<label>` |
| **`<div>` as button** | Not keyboard accessible | Use `<button>` |
| **Auto-playing video** | Distracting, seizure risk | Require user to play |
| **Links that say "Click Here"** | No context when tabbing | Descriptive link text |
| **Color-only error states** | Color-blind users can't see | Add icon + text |
| **No focus indicators** | Keyboard users get lost | Add clear focus rings |
| **Opening new tabs without warning** | Disorienting | Add icon or text indicator |

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Accessible Rich Internet Applications (ARIA)](https://www.w3.org/TR/wai-aria/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

---

## Related Documentation

- **UI/UX Laws:** [ui-ux-laws.md](file:///d:/COMPROG/Wyvern%20Drive/docs/Design/ui-ux-laws.md)
- **Design System:** [design-system.md](file:///d:/COMPROG/Wyvern%20Drive/docs/design-system.md)
- **Quality Checklist:** [quality-checklist.md](file:///d:/COMPROG/Wyvern%20Drive/docs/Design/quality-checklist.md)
