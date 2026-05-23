# Product

## Register

product

## Users

Small teams of 2-8 people brainstorming together, usually on a call. Sessions are mostly throwaway: a quick sketch, a flow on sticky notes, a diagram drawn in real time. Users arrive with momentum from a conversation and need a surface that catches their thinking without slowing it down. They are not committed to learning a tool; they want to draw, drop a note, see each other's cursors, and move on.

## Product Purpose

CollabBoard is a real-time collaborative whiteboard. P2P over WebRTC, no accounts in the way, no setup. The product exists to give a small group the fastest possible path from "let's whiteboard this" to a shared surface where everyone can contribute at once. Success looks like a session where, ten minutes in, no one has thought about the tool itself.

## Brand Personality

Calm, precise, quiet. Voice is plain and confident, never cute. Tone in microcopy is matter-of-fact: "Share link copied", not "Yay! Link copied 🎉". Emotional goal is unhurried focus: a surface that feels like a good notebook, not a stage.

The aesthetic family is closer to Linear and Figma than to Miro or tldraw. Restraint is the signature: typography does the talking, chrome retreats, color is used sparingly and on purpose.

## Anti-references

Hard nos:

- **Miro / Mural enterprise blue.** Saturated marketing-blue gradients, busy top toolbars, dense rails of icons, stickies-as-default. We are not selling to procurement.
- **Generic SaaS template.** Indigo-on-white, gradient buttons, hero-metric cards, pill badges, identical card grids. If it looks like a template, rebuild it.
- **Skeuomorphic crafting.** No paper textures, no wood-grain panels, no drop shadows mimicking a real desk. The canvas is digital and admits it.
- **Childish or cartoon.** No rainbow accents, no oversized rounded mascot icons, no playful-tool gimmicks. Calm, not whimsical.

## Design Principles

1. **Chrome retreats, canvas leads.** The whiteboard is the product. Toolbars, panels, and presence UI sit in the periphery and shrink to their minimum useful size. If a control can be a keyboard shortcut, it can also disappear from view.

2. **Calm under collaboration.** Multiple cursors, edits, and presence events must not feel chaotic. Motion is short, eased, and never elastic. New events fade in; departing ones fade out. Never a popping badge, never a jumping count.

3. **Precision over decoration.** Every line, border, and shadow earns its weight. One accent color, one elevation system, one radius family. Decorative gradients, glassmorphism, and ornamental icons are not in the vocabulary.

4. **Direct manipulation first.** Users act on the canvas, not on menus about the canvas. Menus and modals are the last resort. Inline controls, drag handles, and contextual toolbars come first.

5. **Presence is felt, not shouted.** You should sense who else is here without being interrupted by them. Cursors are subtle, name labels are quiet, join/leave events are whispered, not announced.

## Accessibility & Inclusion

WCAG 2.1 AA target. Keyboard navigation across all chrome controls (toolbars, panels, dialogs). Visible focus rings tuned to both light and dark themes. Respect `prefers-reduced-motion`: presence animations and tool transitions fall back to instant state changes. Touch targets at least 40px on the canvas chrome (the canvas itself follows pointer-device norms). Color is never the only signal: presence uses distinct shapes or initials alongside hue, and any chart or status meaning is paired with an icon or label.
