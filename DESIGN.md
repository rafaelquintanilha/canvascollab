---
name: CollabBoard
description: Real-time collaborative whiteboard for small teams. A quiet notebook with frosted-glass annotations floating above the work.
colors:
  notebook-ink: "#0F172A"
  selection-blue: "#3175F1"
  annotation-purple: "#805AD5"
  paper-cream: "#F7FAFC"
  panel-white: "#FFFFFF"
  body-slate: "#334155"
  muted-slate: "#64748B"
  hair-border: "#E2E8F0"
  grid-dot: "#2D3748"
  danger-red: "#E53E3E"
typography:
  wordmark:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
  kbd:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.02em"
rounded:
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  panel: "16px"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.notebook-ink}"
    textColor: "{colors.panel-white}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "#1E293B"
    textColor: "{colors.panel-white}"
  button-secondary:
    backgroundColor: "{colors.panel-white}"
    textColor: "#1E293B"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "8px 16px"
  chrome-panel:
    backgroundColor: "{colors.panel-white}"
    rounded: "{rounded.panel}"
    padding: "8px 12px"
  tool-button:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.body-slate}"
    rounded: "{rounded.xl}"
    size: "40px"
  tool-button-active:
    backgroundColor: "{colors.notebook-ink}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.xl}"
    size: "40px"
  color-dot:
    rounded: "{rounded.full}"
    size: "32px"
---

# Design System: CollabBoard

## 1. Overview

**Creative North Star: "The Quiet Notebook"**

CollabBoard's visual system is a quiet notebook, paper laid flat under a working light. The canvas is the page: a calm cream wash with a faint dotted graph. Everything else, the toolbar, the panels, the cursor labels, behaves like frosted vellum laid over the page, present enough to be useful, transparent enough to not break the spell of the work underneath. Chrome never insists on itself. It floats.

Restraint is the signature. One ink color does the talking (a near-black slate). One accent does the selecting (a clean blue). Color is otherwise reserved for the user's marks. The chrome itself is mostly soft white with a hair-thin border and a barely-there grain. Where most whiteboard tools shout in saturated enterprise blue, CollabBoard whispers in slate and paper.

The system explicitly rejects: Miro / Mural enterprise blue, generic SaaS template chrome (indigo gradients, hero-metric cards, pill badges), skeuomorphic crafting (paper textures, wood-grain panels, drop-shadows mimicking real desks), and childish / cartoon aesthetics (rainbow accents, mascot icons, comic whimsy). The frosted-glass treatment on chrome panels is a deliberate, signature exception to the general "no glassmorphism" rule, and is named below.

**Key Characteristics:**
- Paper-cream canvas with a 22px slate-tinted dot grid.
- Slate-900 wordmark and primary actions; selection in a single clean blue.
- Frosted-vellum chrome: translucent white panels (~85% opacity) with `backdrop-blur`, hair borders, and a 6% noise overlay (`cb-noise`).
- Rounded radii from 10px (inner controls) up to 18px (panel containers); pill-radius on dots and avatars.
- Motion: short, eased entrances on chrome (~150-200ms, opacity + 8-10px translate). Hover lifts panels by 2px. No bounce, no elastic.
- Inter throughout, in five tight roles (wordmark, body, caption, label, kbd).

## 2. Colors: The Notebook Palette

A near-monochrome system. Ink, paper, and a single selection blue do almost all the work; purple, green and red are reserved for the user's own marks.

### Primary

- **Notebook Ink** (#0F172A): The single dark voice. Used for the wordmark, primary CTAs (Save), active tool state, and tooltip surfaces. The system never uses black. Notebook Ink is its substitute.

### Secondary

- **Selection Blue** (#3175F1): The system's one accent. Reserved for the canvas selection rectangle, selection handles, the inline dimension label that follows a selection, and the focused state of inputs. Never used for decoration. Its rarity is the point.

### Tertiary

- **Annotation Purple** (#805AD5): Part of the user's drawing palette only. Never appears in chrome. Listed here because the system ships it as a preset stroke color.

### Neutral

- **Paper Cream** (#F7FAFC): The canvas. The single largest surface in the product. A barely-warm off-white that signals "this is a page, not a screen".
- **Panel White** (#FFFFFF, painted at 80-90% opacity over the canvas): The chrome surface. Lives only as a translucent layer; never solid.
- **Body Slate** (#334155): Default text color for tool labels, panel headings, and inline controls.
- **Muted Slate** (#64748B): Captions, helper text, the "Stroke" / "Fill opacity" annotations beside controls, the zoom label.
- **Hair Border** (#E2E8F0, painted at ~70% opacity): The 1px border on every chrome panel. Almost invisible. Holds the panel shape without raising its voice.
- **Grid Dot** (slate at 10% opacity, rgba(45, 55, 72, 0.10) on a 22px grid): The graph paper underneath. Felt, not seen.

### Danger

- **Danger Red** (#E53E3E): Reserved for destructive actions in menus (Delete row). Used in text, not in fills.

### Drawing Palette (user-facing, not chrome)

Six presets the user can paint with. These belong to the canvas, not the system: Slate (#4A5568), Blue (#3175F1), Purple (#805AD5), Green (#30B170), Black (#111827), Red (#E53E3E).

### Named Rules

**The One Voice Rule.** Selection Blue (#3175F1) appears on no more than 10% of the visible chrome at any time. It earns its meaning by being rare. If a new design draft uses it as a decorative accent, recolor.

**The No Black Rule.** Notebook Ink (#0F172A) replaces black everywhere in chrome. The only true black (`#111827`) in the entire surface lives inside the user's drawing palette, where the user, not the system, chose it.

**The Paper Rule.** The canvas background is Paper Cream (#F7FAFC), never pure white. White surfaces only exist as translucent chrome floating over the cream. A pure-white canvas is wrong.

## 3. Typography

**Display / Body / Label / Caption Font:** Inter (with `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto` fallbacks)
**Mono Font:** the system monospace stack (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`), used only for `Kbd`.

**Character:** Inter alone, all the way down. Clean, neutral, a working sans-serif chosen because it doesn't announce itself. Hierarchy is built from weight (400 / 500 / 600) and size (10-14px in chrome), not from family contrast. The type stays small on purpose: chrome that whispers next to a canvas that shouts.

### Hierarchy

- **Wordmark** (Inter Semibold, 14px, line-height 1.2, letter-spacing -0.01em): The "CollabBoard" title in the top-left panel. The largest type in the chrome.
- **Body** (Inter Medium, 12px, line-height 1.4): Tool labels (Color, Size), the "X online" count, button labels.
- **Caption** (Inter Regular, 11px, line-height 1.3): The "Stroke" sub-label beside Color, the connection status under the wordmark ("P2P connected · 3 peers"), the help-tips block in the bottom-left.
- **Label** (Inter Medium, 11px, line-height 1.2): Numeric readouts inside controls ("100%" zoom, "3px" stroke size). Sits beside its caption.
- **Kbd** (Mono Medium, 10px, letter-spacing 0.02em): Keyboard shortcuts inside tooltips and context-menu rows. Always paired with the action label, never standalone.

### Named Rules

**The Small Chrome Rule.** No chrome text exceeds 14px. The canvas is the page; the chrome is the marginalia. If a label needs to be bigger to be readable, the affordance is wrong, not the type size.

**The One Family Rule.** Inter is the only typeface used in chrome. Adding a display serif, a quirky display sans, or a brand display face is a category-reflex mistake. Resist.

## 4. Elevation

The system uses two distinct depth strategies layered together. Underneath, the canvas is flat. Above it, the chrome is a stack of frosted-glass cards with soft outer shadows. Depth is achieved through translucency and shadow, not through stacking many shadow ramps.

### Shadow Vocabulary

- **Rest** (`box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.05)`, equivalent to Tailwind `shadow-sm`): The default lift on every chrome panel. Just enough to separate the panel from the cream canvas.
- **Hover / Active panel** (`box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.10), 0 2px 4px -2px rgba(15, 23, 42, 0.06)`, equivalent to `shadow-md`): Panels that received attention. Tool buttons lift to this on hover, alongside a 2px upward translate.
- **Floating presence label** (`box-shadow: 0 10px 25px rgba(15, 23, 42, 0.10)`): The diffuse glow under remote-cursor name pills. Deeper than rest because the label floats over the canvas with no panel underneath it.
- **Avatar ring** (`box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.95), 0 8px 20px rgba(15, 23, 42, 0.08)`): A double effect. A white 2px ring (so adjacent avatars don't bleed into each other) plus an outer drop. Used on collaborator avatars only.

### Named Rules

**The Frosted Vellum Rule.** Chrome panels are the system's signature surface and break the general "no glassmorphism" rule on purpose. Every chrome panel composes four ingredients: a translucent white background (`bg-white/80` to `bg-white/90`), `backdrop-filter: blur(8px)`, a 1px `border-color: rgba(226, 232, 240, 0.7)` (Hair Border), and a 6% multiply-blended SVG fractal-noise overlay (`cb-noise`). Removing any one of the four breaks the effect. Adding a fifth (a gradient, a colored tint, a stronger blur) breaks the calm.

**The Flat Canvas Rule.** The canvas itself is flat. Drawn objects (strokes, shapes, text, images) cast no shadow on the canvas. Depth exists only above the canvas, never on it. A drawn rectangle with a soft drop shadow is wrong; it imitates real paper and breaks the digital frame.

**The Hover Lift Rule.** Tool buttons translate up by 2px on hover, accompanied by the shadow stepping from `rest` to `hover`. No other chrome element moves on hover. The lift is reserved for primary interactive affordances.

## 5. Components

### Chrome Panel

The signature container. Used for the wordmark/status block, the left toolbar, the color/size panel, the collaborator counter, the zoom controls, the help-tips block, the context menu, and the arrange toolbar.

- **Corner Style:** 16-18px (Panel radius or `rounded-2xl`).
- **Background:** Panel White at 80-90% opacity.
- **Effect:** `backdrop-filter: blur(8px)`, Hair Border, `cb-noise` overlay, Rest shadow.
- **Internal Padding:** 8-12px (`p-2` to `p-3`).
- **Composition:** Often contains a nested sub-panel with the same recipe at slightly higher opacity (e.g. the Color/Size sub-card inside the left tool panel). Never more than one level of nesting.

### Buttons

- **Shape:** 16px radius on solid buttons (`rounded-2xl`); 10-12px on inline controls.
- **Primary (Save, Export):** Notebook Ink background, Panel White text, no border, Body typography. Hover deepens the background to #1E293B.
- **Secondary (Reset, Export):** Panel-White-translucent background, Body Slate text, Hair Border, transparent on hover to fully opaque white.
- **Hover / Focus:** No translate on text-bearing buttons (lift is reserved for tool buttons). Focus-visible shows a 1px Selection Blue ring inset by 2px.

### Tool Buttons

The 40px squircles in the left toolbar. The system's most-used affordance.

- **Shape:** `size-10` (40 × 40), `rounded-xl` (18px radius).
- **Rest:** Panel White at 80% opacity, Hair Border, Body Slate icon, Rest shadow.
- **Hover:** Lifts 2px upward (`-translate-y-0.5`), shadow steps to `hover-md`, icon scales 1.04× (via a nested `<span>`, not on the button itself).
- **Active (selected tool):** Notebook Ink background, white icon, hover shadow at rest. No lift on hover when already active.
- **Icon size:** 18px from `lucide-react`, monoline weight, no fills.

### Color Dots

- **Shape:** 32px circle, `rounded-full`, Hair Border (1px).
- **Active state:** Border becomes Notebook Ink, plus a 2px inset ring at `rgba(15, 23, 42, 0.20)`.
- **Interaction:** Scales 1.06× on hover, 0.98× on active. Color is the entire affordance; no labels on the dots themselves.

### Inputs

- **Style:** 1px Hair Border, panel-white background, 4-6px corner radius, Inter at 11-12px.
- **Focus:** Border shifts to Selection Blue, no glow, no shadow. The dimension-label readout on the canvas selection follows the same convention (Selection Blue fill with white text).
- **Color hex input:** Uppercase, monospaced display, 80px wide, sits beside the native color picker swatch.

### Sliders (Size, Fill opacity)

Radix slider with the project's tokens: 4px track in muted slate, 12px thumb in Notebook Ink with a 2px white ring. Active range fills with Notebook Ink.

### Tooltips

- **Surface:** Notebook Ink background, Panel White text, 6-8px radius, 6px padding.
- **Position:** Right-side for tool buttons; bottom for arrange buttons.
- **Content:** Label plus optional `Kbd` keycap pinned to the right at 70% opacity.

### Context Menu

A Chrome Panel at heavier opacity (95%) with 6px-radius rows. Row hover: light slate fill (`#F1F5F9`). The Delete row uses Danger Red text and a #FEF2F2 hover fill. 1px hair separators between groups.

### Collaborator Avatars

- **Outer ring:** 28px white circle, Avatar Ring shadow.
- **Inner:** 24px circle filled with the peer's assigned color, single uppercase initial in 11px semibold white.
- **Stacked layout:** `-space-x-2` overlap. Max five shown; overflow not yet displayed (gap to fill).

### Remote Cursor

A 22 × 22 SVG arrow filled with the peer's color (92% opacity), 1px stroke at `rgba(15, 23, 42, 0.18)`, followed by a translucent name pill (Chrome Panel recipe scaled to a 24px pill with a 2px color dot beside the name).

### Canvas Selection Layer

When something is selected, the canvas itself renders a Selection Blue dashed rectangle (1.5px width, 6-on / 4-off dash pattern), eight 10px white-filled handles with Selection Blue 1px strokes, and a Selection Blue pill below the selection showing `width × height` in Inter 11px.

## 6. Do's and Don'ts

### Do:

- **Do** use the four-ingredient Frosted Vellum recipe for every chrome panel: `bg-white/80-90` + `backdrop-blur` + Hair Border + `cb-noise`. Apply all four or none.
- **Do** keep Selection Blue (#3175F1) on no more than 10% of any visible chrome.
- **Do** use Notebook Ink (#0F172A) in place of black everywhere in chrome.
- **Do** keep the canvas background as Paper Cream (#F7FAFC) and never let chrome surfaces use the same cream (they stay translucent white).
- **Do** lift tool buttons by 2px and step their shadow from `rest` to `hover` on hover. No other element moves.
- **Do** render the 22px slate-dotted grid on the canvas behind everything, at 10% opacity.
- **Do** keep all chrome text ≤14px and in Inter. Wordmark is the maximum.
- **Do** use one of the five typography roles (wordmark / body / caption / label / kbd). Do not invent new ones for one-off labels.
- **Do** respect `prefers-reduced-motion`: panel entrance translations collapse to fade-only, hover lifts become instant shadow changes.

### Don't:

- **Don't** introduce Miro / Mural enterprise blue. Selection Blue is the only blue in chrome.
- **Don't** ship generic-SaaS chrome: indigo gradients, hero-metric cards, gradient buttons, pill badges, identical card grids.
- **Don't** use skeuomorphic paper textures, wood-grain panels, or shadows that imitate a physical desk. The `cb-noise` overlay is the only texture, and it is grain, not material.
- **Don't** use childish or cartoon aesthetics: rainbow accents, oversized rounded mascot icons, Comic Sans whimsy.
- **Don't** apply `backdrop-blur` to anything that isn't a chrome panel. Glassmorphism is the chrome's signature and only the chrome's signature.
- **Don't** apply `background-clip: text` with a gradient (banned across all impeccable projects).
- **Don't** use `border-left` or `border-right` greater than 1px as a colored stripe accent (banned).
- **Don't** use em dashes in UI copy, microcopy, or DESIGN.md additions. Use commas, colons, semicolons, or parentheses.
- **Don't** nest Chrome Panels more than one level deep. The translucency stacks visually and clouds the canvas.
- **Don't** add a third saturated color to chrome. Notebook Ink and Selection Blue are the only chrome colors; everything else is paper-cream, panel-white, or a slate neutral.
- **Don't** introduce a second typeface. Inter is the family. No display serif, no editorial sans, no brand display.
- **Don't** animate `width`, `height`, `margin`, `padding`, or `top/left`. Use `transform` and `opacity`. The chrome's existing entrance animations already follow this rule, keep it.
- **Don't** use bounce or elastic easing. Short, exponential ease-out only.
- **Don't** drop shadows on objects drawn on the canvas. The canvas is flat; depth lives above it.
