---
name: VERSOR PM Agent
description: A calm AI-assisted project management workspace for planning, GitHub signal, reporting, and approval-gated PM agents.
colors:
  background-dark: "#09090b"
  background-light: "#f3f6fa"
  foreground-dark: "#f5f5f5"
  foreground-light: "#0f172a"
  surface-soft: "rgba(255,255,255,0.06)"
  border-soft: "rgba(255,255,255,0.12)"
  success: "#047857"
  warning: "#92400e"
  danger: "#991b1b"
  info: "#1d4ed8"
typography:
  headline:
    fontFamily: "Nunito, Arial, Helvetica, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 750
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Nunito, Arial, Helvetica, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  card: "16px"
  field: "12px"
  pill: "9999px"
spacing:
  page-x-mobile: "16px"
  page-x-desktop: "24px"
  card: "24px"
components:
  button-primary:
    backgroundColor: "{colors.foreground-dark}"
    textColor: "{colors.background-dark}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  card-default:
    backgroundColor: "{colors.surface-soft}"
    rounded: "{rounded.card}"
    padding: "24px"
---

# Design System: VERSOR PM Agent

## 1. Overview

**Creative North Star: "The Operations Desk"**

VERSOR PM Agent should feel like an organized project operations desk: quiet, readable, and ready for work. The UI uses restrained neutral surfaces, compact controls, consistent cards, and semantic state colors only where they clarify status or risk.

**Key Characteristics:**
- Calm SaaS structure, closer to Linear, Vercel, Notion, ChatGPT, and Apple-style software.
- Clear hierarchy before visual flourish.
- One shared component language across dashboard, agents, repositories, members, settings, and reports.

## 2. Colors

The palette is restrained: tinted neutrals with semantic colors for success, warning, danger, and info.

### Primary
- **Text Accent:** Used for primary actions and selected states.

### Neutral
- **Dark Work Surface:** Main dark app background.
- **Light Work Surface:** Main light app background.
- **Elevated Surface:** Cards, frames, and grouped controls.
- **Soft Border:** Default divider and card border.

### Named Rules
**The Semantic Color Rule.** Green, amber, red, and blue are reserved for real state. They are not decoration.

## 3. Typography

**Display Font:** Nunito with system fallbacks.
**Body Font:** Nunito with system fallbacks.
**Label/Mono Font:** System mono only for technical identifiers and commit SHAs.

### Hierarchy
- **Headline** (750, 1.875rem, 1.12): Page titles.
- **Title** (600-700, 1rem-1.25rem): Section and card titles.
- **Body** (400-600, 0.875rem-0.95rem): Descriptions, helper copy, and operational details.
- **Label** (650-800, 0.72rem-0.75rem): Metadata, section eyebrows, badges, and form labels.

## 4. Elevation

Depth is created with tonal surfaces, borders, and restrained shadows. Cards are flat at rest and only become more pronounced on interactive hover states.

## 5. Components

### Buttons
- **Shape:** Compact pill controls.
- **Primary:** High-contrast filled action for save, create, generate, approve.
- **Secondary:** Subtle filled action for run, reject, sync, and general actions.
- **Ghost:** Transparent outline for navigation and lower-priority actions.

### Chips
- **Style:** Small bordered pills with semantic variants for success, warning, danger, and info.
- **State:** Selected states are calm and readable in both themes.

### Cards / Containers
- **Corner Style:** 16px panels, 12px nested items.
- **Background:** Elevated neutral surface with a soft border.
- **Shadow Strategy:** Moderate, not glassy or decorative.
- **Internal Padding:** 16px on compact cards, 24px on primary panels.

### Inputs / Fields
- **Style:** 12px radius, soft border, calm filled surface.
- **Focus:** Border and subtle ring, never color-only.
- **Error / Disabled:** Semantic notices and reduced opacity.

### Navigation
- **Style:** Compact rounded sidebar items with subtle active state and sticky blurred top bar.

## 6. Do's and Don'ts

### Do:
- **Do** use the shared page shell, card, notice, badge, button, field, and segmented-control classes for new UI.
- **Do** keep technical GitHub data visually integrated with project management surfaces.
- **Do** show agent schedules in human-readable language.

### Don't:
- **Don't** use flashy AI dashboard styling, crypto dashboard styling, gaming UI, neon gradients, or harsh black blocks in light mode.
- **Don't** invent one-off alert, badge, button, or card treatments.
- **Don't** use gradient text or colored side stripes for status emphasis.
