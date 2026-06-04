---
phase: 5
slug: professional-ui-redesign
status: approved
shadcn_initialized: false
preset: custom-vault
created: 2026-06-04
---

# Phase 5 — UI Design Contract

> Visual and interaction contract for frontend phases. Generated to eliminate generic aesthetics and establish a premium, distinctive identity.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Tailwind CSS v4 |
| Preset | Custom (Vault/Editorial) |
| Component library | Radix UI (for accessible primitives) |
| Icon library | Lucide React |
| Font | Clash Display (Headings), Satoshi (Body) |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline badge padding |
| sm | 8px | Button padding, list-row horizontal padding |
| md | 16px | Inner card spacing, folder tree item gaps |
| lg | 24px | Grid gap, sidebar internal padding, details drawer padding |
| xl | 32px | Header-to-content gap, top bar padding |
| 2xl | 48px | Page margins, empty-state spacing |
| 3xl | 64px | Full-page overlay padding, vertical layout spacing |

Exceptions: none

---

## Typography

| Role | Size | Weight | Line Height | Font Family |
|------|------|--------|-------------|-------------|
| Body | 14px | Regular (400) | 1.5 (21px) | Satoshi |
| Label | 12px | Medium (500) | 1.2 (14px) | Satoshi |
| Heading | 20px | Bold (700) | 1.2 (24px) | Clash Display |
| Display | 32px | Bold (700) | 1.1 (35px) | Clash Display |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#0A0A0C` (Dark) / `#FAFAFA` (Light) | App backdrop, background surfaces |
| Secondary (30%) | `#1C1C21` (Dark) / `#F0F0F3` (Light) | Sidebar panel, cards, top bar, details panel |
| Accent (10%) | `#FF5A00` (Signal Orange) | Active nav items, primary buttons, upload progress, lock indicators |
| Destructive | `#FF3366` (Vermilion) | Delete actions, warning text, revoke links |

Accent reserved for: Active sidebar link indicator, upload progress bar fill, lock indicator active states, checkbox focus indicator.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Upload to Vault |
| Empty state heading | Vault is Empty |
| Empty state body | Drag files anywhere to encrypt and securely upload to Discord CDN. |
| Error state | Decryption failed: Invalid key or corrupted chunks. Verify your passphrase. |
| Destructive confirmation | Purge File: This permanently deletes metadata and all versions. This cannot be undone. |

---

## Motion & Interaction

| Element | Behavior |
|---------|----------|
| Page Load | Staggered fade-in + translateY(8px) for main dashboard sections (delay: 50ms per section) |
| Sidebar Toggle | Smooth width transition (300ms, ease-out-cubic) with icon morphing |
| Details Drawer | Slide-in from right with subtle backdrop blur (12px) and 95% opacity |
| Hover States | Subtle background shift (`#1C1C21` to `#25252B`) with 150ms ease-out |
| Drag Overlay | Full-screen glassmorphic overlay with pulsing dashed border (2s infinite) |

---

## Backgrounds & Visual Details

- **Noise Texture**: 2% opacity monochrome noise overlay on all dark mode surfaces to prevent color banding and add tactile depth.
- **Gradient Mesh**: Subtle, slow-moving radial gradient (Signal Orange at 5% opacity) behind the main content area in dark mode.
- **Glassmorphism**: `backdrop-filter: blur(12px)` with a 1px border of `rgba(255, 255, 255, 0.08)` for floating elements (audio dock, drag overlay).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-06-04
