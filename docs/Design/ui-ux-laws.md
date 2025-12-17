# UI/UX Laws for Wyvern Drive

> **Based on:** Cognitive psychology research and industry best practices
> **Last Updated:** 2025-12-18

---

## Overview

These laws are derived from decades of research into how humans perceive, process, and retain information. They are **not optional design choices** — they are cognitive constraints that must be respected for effective UX.

---

## 1. Miller's Law

> **The average person can only keep 7 (± 2) items in their working memory.**

### Application in Wyvern Drive

**Navigation:**
- Sidebar should have ≤ 7 main items
- Context menus should have ≤ 5-7 options
- Settings sections should be chunked into categories

**File Lists:**
- Use pagination or virtual scrolling
- Default view: 50 files per page (not 500)
- Group files by type/date to reduce cognitive load

**Forms:**
- Break long forms into steps (multi-step wizard)
- Max 7 fields visible at once

### Implementation

```typescript
// ❌ BAD: 15 ungrouped navigation items
<Nav items={allFeatures} />

// ✅ GOOD: Grouped into 5 categories with <7 items each
<Nav>
  <NavGroup title="Files" items={fileOps} />
  <NavGroup title="Sharing" items={shareOps} />
  <NavGroup title="Settings" items={settingsOps} />
</Nav>
```

---

## 2. Hick's Law

> **The time to make a decision increases logarithmically with the number of choices.**

### Application in Wyvern Drive

**Minimize Choices:**
- Upload modal: "Upload File" or "Cancel" (not 5 options)
- Delete confirmation: "Delete" or "Cancel" (not "Delete Permanently", "Move to Trash", "Archive")
- Settings: Use defaults, only show advanced options on toggle

**Progressive Disclosure:**
- Hide complexity until needed
- "Advanced Settings" section collapsed by default
- Tooltips for power-user features

### Implementation

```typescript
// ❌ BAD: Overwhelming modal with 6 buttons
<Modal>
  <Button>Upload</Button>
  <Button>Upload & Encrypt</Button>
  <Button>Upload to Folder</Button>
  <Button>Schedule Upload</Button>
  <Button>Upload & Share</Button>
  <Button>Cancel</Button>
</Modal>

// ✅ GOOD: Primary action + optional advanced toggle
<Modal>
  <Button primary>Upload</Button>
  <Button secondary>Cancel</Button>
  <Collapsible label="Advanced Options">
    <Checkbox>Encrypt</Checkbox>
    <Select>Destination Folder</Select>
  </Collapsible>
</Modal>
```

---

## 3. Gestalt Principles

> **The brain groups visual elements by proximity, similarity, continuity, and closure.**

### 3.1 Law of Proximity

**Elements that are near each other are perceived as related.**

```css
/* ✅ GOOD: Label tightly coupled with input */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px; /* Small gap = tight relationship */
}

.form-field + .form-field {
  margin-top: 20px; /* Large gap = separate fields */
}
```

### 3.2 Law of Similarity

**Elements that look similar are perceived as related.**

- All "Delete" actions are red
- All file type icons use consistent style (filled or outlined, not mixed)
- All primary buttons have same color/size

### 3.3 Law of Common Region

**Elements within a bounded area are perceived as grouped.**

```tsx
// ✅ Card pattern groups file metadata
<Card>
  <Thumbnail src={file.thumbnail} />
  <Title>{file.name}</Title>
  <Meta>{file.size} • {file.date}</Meta>
</Card>
```

### 3.4 Law of Prägnanz

**People perceive simple forms over complex ones.**

- Use standard icons (don't create weird custom symbols)
- Flat design over 3D skeuomorphism
- Clean grid layouts over asymmetric chaos

---

## 4. Jakob's Law

> **Users spend most of their time on other sites. They prefer your site to work the same way.**

### Application in Wyvern Drive

**Follow Cloud Storage Conventions:**

| Pattern | Standard | Wyvern Drive |
|---------|----------|--------------|
| **Upload** | Drag-and-drop or button top-right | ✅ Same |
| **File Actions** | Right-click context menu | ✅ Same |
| **Open File** | Double-click | ✅ Same |
| **Select** | Click + Shift/Ctrl for multiple | ✅ Same |
| **Breadcrumb** | Top of file list, clickable path | ✅ Same |
| **Delete** | Confirmation modal (not instant) | ✅ Same |

**Don't Innovate on Core Patterns:**

❌ BAD: Triple-click to open files
❌ BAD: Settings button in bottom-left
❌ BAD: Scroll sideways to navigate folders

✅ GOOD: Use industry-standard interactions

---

## 5. Fitts's Law

> **The time to acquire a target is a function of distance and size.**

### Application in Wyvern Drive

**Large Click Targets:**
- Minimum 44×44px for mobile (Apple HIG standard)
- Minimum 32×32px for desktop
- Increase padding around small icons

**Reduce Distance:**
- Place related actions near each other
- Context menus appear at cursor position
- Frequently used actions (Upload, Search) in easily reachable corners

```css
/* ❌ BAD: Tiny icon button */
.icon-btn {
  width: 16px;
  height: 16px;
}

/* ✅ GOOD: Adequate hit area */
.icon-btn {
  width: 40px;
  height: 40px;
  padding: 8px; /* Icon itself is 24px */
}
```

---

## 6. Peak-End Rule

> **Users judge an experience by its peak (most intense moment) and its end.**

### Application in Wyvern Drive

**Positive Peaks:**
- Upload success animation (confetti, checkmark)
- First-time user onboarding (delightful welcome)
- Milestone celebrations (100 files uploaded)

**Positive Ends:**
- Success toast on final action ("File shared successfully!")
- Smooth logout with "See you soon" message
- Graceful error recovery (not red error screens)

**Avoid Negative Ends:**
- Don't end on error ("Upload failed. Goodbye.")
- Don't abandon user mid-flow
- Provide clear next steps after errors

```tsx
// ✅ Peak moment: Upload complete
function UploadSuccess() {
  return (
    <Modal>
      <ConfettiAnimation />
      <Icon name="check-circle" color="green" size={64} />
      <h2>Upload Complete!</h2>
      <p>Your file is now safely stored.</p>
      <Button onClick={closeModal}>View Files</Button>
    </Modal>
  );
}
```

---

## 7. Serial Position Effect

> **Users best remember the first and last items in a list.**

### Application in Wyvern Drive

**Navigation Placement:**
- Most important items at top and bottom of sidebar
- Middle section for secondary features
- "Logout" always at bottom (memorable position)

**File Sorting:**
- Default sort: Most recent first (users care about new files)
- Pin important folders to top

---

## 8. Von Restorff Effect (Isolation Effect)

> **When multiple similar objects are present, the one that differs is most likely to be remembered.**

### Application in Wyvern Drive

**Call-to-Action Emphasis:**

```tsx
// ✅ Primary CTA stands out
<ButtonGroup>
  <Button secondary>Cancel</Button>
  <Button secondary>Save Draft</Button>
  <Button primary>Publish</Button> {/* Distinct color */}
</ButtonGroup>
```

**Warnings:**
- Critical actions (Delete) use red color (isolation from other buttons)
- Pro features have badge/icon to stand out

**Restraint:**
- Don't overuse (if everything is emphasized, nothing is)

---

## 9. Aesthetic-Usability Effect

> **Users perceive aesthetically pleasing designs as more usable.**

### Application in Wyvern Drive

**Maintain Design System:**
- Consistent spacing (4px base unit)
- Consistent border radius (8px for buttons, 12px for cards)
- Consistent colors (use CSS variables from `design-system.md`)
- Smooth transitions (200ms spring easing)

**Visual Polish:**
- High-quality icons (Lucide or Heroicons)
- Professional imagery (no pixelation)
- Micro-animations (button press, hover states)

> [!WARNING]
> This effect can **mask usability issues** during testing. If testers forgive flaws because "it looks nice," you may ship broken functionality. Validate with functional tests, not just visual feedback.

---

## 10. Doherty Threshold

> **Productivity soars when computer and user interact at a pace < 400ms.**

### Application in Wyvern Drive

**Performance Targets:**

| Interaction | Target | Critical Threshold |
|-------------|--------|-------------------|
| Button click response | < 100ms | 400ms |
| Page navigation | < 300ms | 1000ms |
| Search results | < 500ms | 2000ms |
| File upload start | < 200ms | 1000ms |

**Feedback for Long Operations:**

```tsx
// ✅ Show progress for >1s operations
function UploadFile() {
  const [progress, setProgress] = useState(0);

  if (progress > 0 && progress < 100) {
    return <ProgressBar value={progress} />;
  }

  return <UploadButton />;
}
```

---

## 11. Tesler's Law (Law of Conservation of Complexity)

> **For any system, there is a certain amount of complexity which cannot be reduced.**

### Application in Wyvern Drive

**Accept Inherent Complexity:**
- File encryption **must** ask for password (can't simplify away)
- Folder hierarchy **must** be navigable (can't flatten completely)

**Manage Complexity:**
- Default to no encryption (simple path)
- Offer encryption as opt-in advanced feature
- Use progressive disclosure for complex settings

**Don't Push to User:**
- Auto-detect file types (don't ask user to select)
- Auto-retry failed uploads (don't force manual retry)

---

## 12. Pareto Principle (80/20 Rule)

> **80% of effects come from 20% of causes.**

### Application in Wyvern Drive

**Prioritize Common Actions:**
- Upload, download, delete = 80% of usage
- These should be **most prominent** and **fastest** to access
- Advanced features (versioning, encryption) can be 2-3 clicks deep

**Optimize for Frequency:**
- Keyboard shortcuts for top 20% actions (Ctrl+U for upload)
- Context menu shows 5 most common actions, "More..." for rest

---

## Implementation Checklist

When designing a new feature, verify:

- [ ] Follows Jakob's Law (standard patterns)
- [ ] Respects Miller's Law (< 7 items visible)
- [ ] Minimizes choices (Hick's Law)
- [ ] Uses visual grouping (Gestalt)
- [ ] Large touch targets (Fitts's Law)
- [ ] Positive peak/end moments (Peak-End Rule)
- [ ] Important items at top/bottom (Serial Position)
- [ ] Primary action stands out (Von Restorff)
- [ ] Aesthetically consistent (Aesthetic-Usability)
- [ ] Responds in < 400ms (Doherty Threshold)
- [ ] Complexity managed (Tesler's Law)
- [ ] Optimized for 80% use cases (Pareto)

---

## Related Documentation

- **Design System:** [design-system.md](file:///d:/COMPROG/Wyvern%20Drive/docs/design-system.md)
- **Accessibility:** [accessibility-checklist.md](file:///d:/COMPROG/Wyvern%20Drive/docs/Design/accessibility-checklist.md)
- **Quality Checklist:** [quality-checklist.md](file:///d:/COMPROG/Wyvern%20Drive/docs/Design/quality-checklist.md)
