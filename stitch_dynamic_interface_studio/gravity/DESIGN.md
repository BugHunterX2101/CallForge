---
name: Gravity
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#515f74'
  on-secondary: '#ffffff'
  secondary-container: '#d5e3fd'
  on-secondary-container: '#57657b'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002113'
  on-tertiary-container: '#009668'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d5e3fd'
  secondary-fixed-dim: '#b9c7e0'
  on-secondary-fixed: '#0d1c2f'
  on-secondary-fixed-variant: '#3a485c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  deep-navy: '#0F172A'
  slate-gray: '#64748B'
  vibrant-success: '#10B981'
  warning-amber: '#F59E0B'
  critical-red: '#EF4444'
  border-subtle: '#E2E8F0'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin: 32px
  max-width: 1280px
---

## Brand & Style

The brand personality is **"The Silent Sales Partner"**—an entity that is efficient, reliable, and essentially invisible until the moment it provides high-value utility. This design system moves away from the "loud" notifications of traditional SaaS, opting for a **Corporate / Modern** aesthetic with **Minimalist** leanings. 

The goal is to evoke a sense of calm authority and hyper-competence. The UI does not compete for attention; it facilitates focus. Visuals are grounded in data-driven precision, utilizing significant whitespace, a strict monochromatic foundation with high-impact "success" accents, and a razor-sharp typographic hierarchy. The style feels integrated and native, whether viewed in a dedicated dashboard or as an injected component in Slack or Gmail.

## Colors

The palette is anchored by **Deep Navy** (`#0F172A`), providing a sophisticated, stable foundation that commands professional trust. **Slate Gray** is used for secondary text and non-interactive iconography to maintain a low-noise environment.

**Vibrant Success Green** (`#10B981`) is the hero color for primary actions, approvals, and positive status indicators, symbolizing the "Gravity" of a closed deal or a successful workflow. The background is a clean **Off-White/Neutral** (`#F8FAFC`), ensuring the interface feels airy and modern. Functional colors (Amber/Red) are used sparingly for "Flagged for Input" or "Unreadable" states to prevent dashboard fatigue.

## Typography

This design system utilizes **Inter** for all primary interface elements to ensure maximum readability and a neutral, professional tone. The typographic scale is designed for high information density without sacrificing clarity. 

Key architectural decisions:
- **Tightened Tracking:** Headlines use slight negative letter spacing to feel "locked-in" and authoritative.
- **Labels:** Uppercase labels with increased letter spacing are used for category headers and status chips.
- **Data Mono:** **JetBrains Mono** is introduced for technical IDs (Deal IDs, Call Fingerprints) and CRM field mapping to distinguish raw data from human-readable summaries.

## Layout & Spacing

The layout philosophy follows a **Fixed Grid** for internal dashboards and a **Fluid Content Model** for third-party integrations (Slack/Gmail). 

- **Grid:** A 12-column grid system is used on desktop with 24px gutters. 
- **The "Sweep" Rhythm:** Because the tool operates on 5-minute data polling cycles, vertical lists (like the Deal Tracker) emphasize temporal grouping. 
- **Mobile:** On mobile devices, the grid collapses to a single column with 16px side margins. 
- **Density:** Spacing is compact to accommodate complex data tables, but utilizes "logical grouping" (using background color shifts rather than lines) to prevent the UI from feeling claustrophobic.

## Elevation & Depth

To maintain the "Silent Partner" persona, the system uses **Low-Contrast Outlines** and **Tonal Layers** rather than heavy shadows.

- **Surface Levels:** The primary background is the lowest level. Cards and "Slack-style" approval blocks sit on a secondary surface with a subtle 1px border (`#E2E8F0`).
- **Interaction Depth:** Only active elements (like a primary "Approve" button) receive a very soft, ambient shadow (4px blur, 10% opacity Deep Navy) to indicate interactivity.
- **Integrated Z-Index:** Follow-up drafts in Gmail or Slack should feel like they are part of the host application, using the host’s native elevation cues where possible while maintaining our brand's strict border and color logic.

## Shapes

The shape language is **Soft** (0.25rem / 4px base radius). This subtle rounding strikes a balance between the precision of a data tool and the approachability of a modern assistant. 

- **Buttons:** 4px radius for a sharp, "business-ready" look.
- **Data Chips:** 2px radius (near-sharp) to denote technical or status data.
- **Container Cards:** 8px (`rounded-lg`) to provide a distinct container for AI-generated summaries and email drafts.

## Components

### Buttons
- **Primary:** Deep Navy background with White text. Used for "Create New Deal" or "Submit."
- **Success Action:** Vibrant Success Green background. Reserved exclusively for "Approve & Send" or "Verify."
- **Ghost:** Border-only (`#E2E8F0`) for secondary actions like "Reject" or "Edit Draft."

### Data Tables
Tables are the heart of the "Deal Tracker." Use a sticky header with `label-caps` typography. Rows should have a subtle hover state (`#F1F5F9`) and use `data-mono` for ID columns.

### Approval Cards (Slack-Style)
Designed to be self-contained units.
- **Header:** Source icon (e.g., Zoom icon) + Timestamp.
- **Body:** Bulleted call summary (Body-sm).
- **Footer:** Two-column action split (Reject / Approve).

### Status Indicators
- **Standardized Chips:** Use a background-tint approach (e.g., Success Green at 10% opacity for the background, 100% opacity for the text).
- **Icons:** Use simple geometric icons (circles for status, arrows for flow) to minimize visual noise.

### Input Fields
Bordered fields (`#E2E8F0`) that transition to Deep Navy on focus. Labels sit above the field in `label-caps`.