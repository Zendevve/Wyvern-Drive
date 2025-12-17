# Quality Checklist: "Can't Unsee" UI Review

> **Inspired by:** [cantunsee.space](https://cantunsee.space/)
> **Purpose:** Catch subtle visual mistakes that separate amateur from professional UI
> **Last Updated:** 2025-12-18

---

## Overview

This checklist catches the tiny details that users might not consciously notice but subconsciously feel. If your UI "feels off" but you can't pinpoint why, start here.

---

## 1. Typography & Text

### 1.1 Capitalization

- [ ] **Button labels are consistent**
  ```tsx
  <!-- ❌ INCONSISTENT -->
  <Button>Sign Up</Button>
  <Button>log in</Button>
  <Button>VIEW PROFILE</Button>

  <!-- ✅ CONSISTENT (choose one) -->
  <Button>Sign Up</Button>     // Title Case
  <Button>Log in</Button>
  <Button>View profile</Button>

  // OR

  <Button>SIGN UP</Button>      // ALL CAPS
  <Button>LOG IN</Button>
  <Button>VIEW PROFILE</Button>
  ```

- [ ] **Heading hierarchy is correct**
  ```html
  <!-- ❌ BAD: Skips H2 -->
  <h1>Dashboard</h1>
  <h3>Recent Files</h3>

  <!-- ✅ GOOD: Proper nesting -->
  <h1>Dashboard</h1>
  <h2>Recent Files</h2>
  <h3>Uploaded Today</h3>
  ```

### 1.2 Text Alignment

- [ ] **Avoid justified text** (causes rivers of whitespace)
  ```css
  /* ❌ BAD: Justified text on web */
  p {
    text-align: justify;
  }

  /* ✅ GOOD: Left-aligned */
  p {
    text-align: left;
  }
  ```

- [ ] **Text in buttons is centered** (both horizontally and vertically)

- [ ] **Numbers are right-aligned in tables**
  ```css
  td.number {
    text-align: right;
    font-variant-numeric: tabular-nums; /* Monospace numbers */
  }
  ```

### 1.3 Line Height

- [ ] **Body text has comfortable line height** (1.5-1.6)
  ```css
  p {
    font-size: 14px;
    line-height: 1.5; /* 21px */
  }
  ```

- [ ] **Headings have tighter line height** (1.1-1.3)
  ```css
  h1 {
    font-size: 32px;
    line-height: 1.2; /* 38.4px */
  }
  ```

### 1.4 Letter Spacing (Tracking)

- [ ] **Lowercase text has default tracking** (0)
  ```css
  /* ❌ BAD: Tracked out lowercase */
  p {
    letter-spacing: 0.1em; /* Makes text hard to read */
  }

  /* ✅ GOOD: Default */
  p {
    letter-spacing: 0;
  }
  ```

- [ ] **Uppercase text has slightly increased tracking** (0.02em - 0.05em)
  ```css
  .badge {
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  ```

### 1.5 Contrast

- [ ] **Text meets WCAG AA standards** (4.5:1 for normal, 3:1 for large)
- [ ] **Never use pure black on white** (#000 on #FFF causes eye strain)
  ```css
  /* ❌ BAD: Extreme contrast */
  color: #000000;
  background: #FFFFFF;

  /* ✅ GOOD: Softer contrast */
  color: #121212;
  background: #FAFAFA;
  ```

---

## 2. Iconography

### 2.1 Icon Consistency

- [ ] **All icons from same family** (don't mix styles)
  ```tsx
  <!-- ❌ BAD: Mixed icon styles -->
  <TrashIcon style="filled" />
  <EditIcon style="outlined" />
  <ShareIcon style="two-tone" />

  <!-- ✅ GOOD: Consistent style -->
  <TrashIcon style="outlined" />
  <EditIcon style="outlined" />
  <ShareIcon style="outlined" />
  ```

- [ ] **Icon stroke width is consistent** (usually 1.5px or 2px)

- [ ] **Icon size is consistent for same context**
  ```tsx
  <!-- ❌ BAD: Varying sizes -->
  <Button><Icon size={16} />Save</Button>
  <Button><Icon size={20} />Cancel</Button>

  <!-- ✅ GOOD: Uniform sizes -->
  <Button><Icon size={16} />Save</Button>
  <Button><Icon size={16} />Cancel</Button>
  ```

### 2.2 Icon Alignment

- [ ] **Icons are optically centered** in buttons/containers
  ```css
  /* Play button appears off-center due to triangle shape */
  /* Compensate by nudging right */
  .play-icon {
    margin-left: 2px;
  }
  ```

- [ ] **Icons align with text baseline** when inline
  ```css
  .icon-with-text {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  ```

### 2.3 Icon Semantics

- [ ] **Icons match their action**
  - ❌ Don't use 🗑️ for "Archive"
  - ✅ Use 📦 for "Archive", 🗑️ for "Delete"

- [ ] **Destructive actions use red** (or semantic error color)

---

## 3. Layout & Spacing

### 3.1 Padding & Margins

- [ ] **Padding is even inside buttons**
  ```css
  /* ❌ BAD: Uneven padding */
  button {
    padding: 8px 12px 10px 12px; /* Top ≠ Bottom */
  }

  /* ✅ GOOD: Even padding */
  button {
    padding: 8px 16px; /* Vertical: 8px, Horizontal: 16px */
  }
  ```

- [ ] **Spacing follows 4px grid** (4, 8, 12, 16, 20, 24...)
  ```css
  .card {
    padding: 16px; /* ✅ Multiple of 4 */
    margin-bottom: 24px; /* ✅ Multiple of 4 */
  }
  ```

- [ ] **Related items have tight spacing, unrelated items have loose spacing** (Gestalt proximity)

### 3.2 Alignment

- [ ] **Elements align to grid or each other** (no random positioning)
  ```css
  /* Use Flexbox/Grid for alignment, not absolute positioning */
  .container {
    display: flex;
    align-items: center; /* Vertically aligned */
  }
  ```

- [ ] **Text inputs align left edge** (not centered in form)

- [ ] **Modal content is centered** (both horizontally and vertically)

### 3.3 Border Radius

- [ ] **Border radius is consistent**
  ```css
  /* ❌ BAD: Random radii */
  .btn-a { border-radius: 6px; }
  .btn-b { border-radius: 8px; }
  .card { border-radius: 10px; }

  /* ✅ GOOD: Consistent */
  .btn { border-radius: 8px; }
  .card { border-radius: 12px; }
  .modal { border-radius: 16px; }
  ```

- [ ] **Nested elements have smaller radius**
  ```css
  .card {
    border-radius: 12px;
  }
  .card img {
    border-radius: 8px; /* 4px smaller */
  }
  ```

---

## 4. Images & Media

### 4.1 Aspect Ratio

- [ ] **Images are not stretched or squished**
  ```css
  /* ✅ Maintain aspect ratio */
  img {
    width: 100%;
    height: auto; /* Maintains ratio */
  }

  /* OR for cropping */
  .thumbnail {
    width: 200px;
    height: 200px;
    object-fit: cover; /* Crops, doesn't distort */
  }
  ```

### 4.2 Resolution

- [ ] **Images are crisp on high-DPI screens** (2x assets or SVG)
  ```html
  <img
    src="logo.png"
    srcset="logo@2x.png 2x"
    alt="Logo"
  />
  ```

- [ ] **No pixelation or blur**

### 4.3 Placeholders

- [ ] **Loading states use skeleton screens** (not spinners alone)
  ```tsx
  {isLoading ? (
    <Skeleton width={200} height={20} />
  ) : (
    <h2>{title}</h2>
  )}
  ```

---

## 5. Color & Contrast

### 5.1 Color Consistency

- [ ] **Primary button color is consistent** across entire app
- [ ] **Semantic colors match their meaning**
  - Success = Green
  - Error/Danger = Red
  - Warning = Yellow/Orange
  - Info = Blue
  - Neutral = Gray

### 5.2 Color Logic

- [ ] **Don't use green for "Delete"** or red for "Save"
  ```tsx
  <!-- ❌ BAD: Wrong color association -->
  <Button color="red">Save</Button>
  <Button color="green">Delete</Button>

  <!-- ✅ GOOD: Correct semantics -->
  <Button color="blue">Save</Button>
  <Button color="red">Delete</Button>
  ```

### 5.3 Hover States

- [ ] **All interactive elements have visible hover state**
  ```css
  button:hover {
    background-color: var(--bg-hover);
  }

  a:hover {
    text-decoration: underline;
  }
  ```

- [ ] **Hover states are subtle** (not jarring color shifts)

---

## 6. Interactive States

### 6.1 Focus States

- [ ] **Focus ring is clearly visible**
  ```css
  button:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
  }
  ```

- [ ] **Focus ring doesn't break layout** (use `outline`, not `border`)

### 6.2 Active States

- [ ] **Buttons have pressed/active state**
  ```css
  button:active {
    transform: translateY(1px); /* Subtle press effect */
  }
  ```

### 6.3 Disabled States

- [ ] **Disabled elements are visually muted**
  ```css
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  ```

- [ ] **Disabled elements are not interactive** (no hover effects)

---

## 7. Motion & Animation

### 7.1 Duration

- [ ] **Animations are fast** (150-300ms for UI transitions)
  ```css
  /* ❌ TOO SLOW: Feels sluggish */
  transition: all 800ms;

  /* ✅ GOOD: Snappy */
  transition: all 200ms;
  ```

### 7.2 Easing

- [ ] **Use ease-out for entrances** (starts fast, slows down)
  ```css
  transition: transform 200ms ease-out;
  ```

- [ ] **Use ease-in for exits** (starts slow, speeds up)
  ```css
  transition: opacity 150ms ease-in;
  ```

### 7.3 Reduced Motion

- [ ] **Respect `prefers-reduced-motion`**
  ```css
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

---

## 8. Forms

### 8.1 Input States

- [ ] **Inputs have clear focus state**
- [ ] **Error states use color + icon + text** (not color alone)
  ```tsx
  <div className={error ? 'input-error' : ''}>
    {error && <AlertIcon />}
    <input aria-invalid={!!error} />
    {error && <p className="error-text">{error}</p>}
  </div>
  ```

### 8.2 Button Placement

- [ ] **Primary action on the right** (for LTR languages)
  ```tsx
  <!-- ✅ GOOD: Primary right, secondary left -->
  <ModalFooter>
    <Button secondary>Cancel</Button>
    <Button primary>Save</Button>
  </ModalFooter>
  ```

- [ ] **Destructive actions require confirmation**

---

## 9. Cursor Behavior

### 9.1 Pointer Cursor

- [ ] **Cursor changes to pointer on interactive elements**
  ```css
  button, a, [role="button"] {
    cursor: pointer;
  }
  ```

- [ ] **Non-clickable text stays as default cursor**

### 9.2 Disabled Cursor

- [ ] **Disabled elements use `not-allowed` cursor**
  ```css
  button:disabled {
    cursor: not-allowed;
  }
  ```

---

## 10. Empty States

### 10.1 Messaging

- [ ] **Empty states are helpful, not just "No data"**
  ```tsx
  <!-- ❌ BAD: Vague -->
  <p>No files</p>

  <!-- ✅ GOOD: Actionable -->
  <EmptyState>
    <Illustration />
    <h3>No files yet</h3>
    <p>Upload your first file to get started</p>
    <Button>Upload File</Button>
  </EmptyState>
  ```

---

## Testing Workflow

### Before Every Commit

1. **Zoom to 200%** — Check readability and layout
2. **Tab through UI** — Verify focus indicators
3. **Take screenshot** — Compare to design mockup
4. **Toggle `prefers-reduced-motion`** — Verify animations behave

### Before Every PR

1. **Cross-browser test** (Chrome, Firefox, Safari)
2. **Mobile test** (physical device or simulator)
3. **Accessibility audit** (axe DevTools)
4. **Lighthouse score** (Performance, Accessibility, Best Practices)

---

## Common Mistakes

| Mistake | Why It's Bad | Fix |
|---------|--------------|-----|
| **Inconsistent capitalization** | Looks amateurish | Pick Title Case or Sentence case |
| **Mixed icon styles** | Visually jarring | Use one icon family |
| **Stretched images** | Distorted, unprofessional | Use `object-fit: cover` |
| **No focus indicators** | Keyboard users get lost | Add visible outline |
| **Slow animations** | Feels sluggish | Keep under 300ms |
| **Pure black text** | Eye strain | Use #121212 |
| **Hover without cursor change** | Confusing interaction | Add `cursor: pointer` |

---

## Resources

- [Can't Unsee](https://cantunsee.space/) — Visual design training game
- [Refactoring UI](https://www.refactoringui.com/) — Practical design tips
- [Polished](https://polished.js.org/) — CSS-in-JS utilities

---

## Related Documentation

- **Design System:** [design-system.md](file:///d:/COMPROG/Wyvern%20Drive/docs/design-system.md)
- **UI/UX Laws:** [ui-ux-laws.md](file:///d:/COMPROG/Wyvern%20Drive/docs/Design/ui-ux-laws.md)
- **Accessibility:** [accessibility-checklist.md](file:///d:/COMPROG/Wyvern%20Drive/docs/Design/accessibility-checklist.md)
