# MCP UI Design System & Guidelines

This document details the visual components, color palettes, spacing rules, and UX consistency guidelines for the `mcp-ui` React application.

---

## 1. Visual Aesthetics & Philosophy

Our visual style is a **Material-Glassmorphism** blend, prioritizing a clean, lightweight look that feels professional and mature. 

Key principles:
- **Light Theme by Default:** Emphasize clean light spaces with thin, theme-colored borders.
- **Glassmorphic Shadows:** Instead of harsh borders, use soft translucent backgrounds (`backdrop-blur-md`) with subtle drop shadows (`shadow-sm` or `shadow-md`) to separate elements.
- **No Heavy Fonts:** Avoid bold typography. All headings, labels, and text must use light (weight `300`) or normal (weight `400`) typographic weights.
- **Micro-interactions:** Interactive elements (buttons, cards, inputs) must react to hover and active states using smooth transitions (`transition-all duration-200 ease-in-out`).

---

## 2. Color Palettes & Custom CSS Variables

Theme tokens are declared in CSS variables and are automatically swapped based on the selected theme preset:

### 2.1 Ethereal Pastel (Default Theme)
- **Primary Accent:** Pastel Violet (`#7c4dff` / HSL `258, 100%, 65%`)
- **Secondary Accent:** Pastel Cyan (`#00e5ff` / HSL `186, 100%, 50%`)
- **Muted Accent:** Pastel Pink (`#ff007f` / HSL `330, 100%, 50%`)
- **Light Mode BG:** Sky/Lavender White (`#f7f8fc`)
- **Light Mode Card:** White glass (`rgba(255, 255, 255, 0.45)`) with a light lavender border (`rgba(124, 77, 255, 0.1)`)
- **Dark Mode BG:** Deep Dark Slate (`#0c0914`)
- **Dark Mode Card:** Dark glass (`rgba(22, 17, 39, 0.45)`) with a subtle violet border (`rgba(124, 77, 255, 0.15)`)

### 2.2 Sunset Glow Theme
- **Primary Accent:** Warm Orange (`#ff9100` / HSL `34, 100%, 50%`)
- **Secondary Accent:** Coral Pink (`#ff4081` / HSL `339, 100%, 63%`)
- **Muted Accent:** Soft Yellow (`#ffd600` / HSL `50, 100%, 50%`)
- **Light Mode Card:** Light cream glass (`rgba(255, 253, 245, 0.5)`) with a warm coral border (`rgba(255, 64, 129, 0.1)`)
- **Dark Mode Card:** Dark amber glass (`rgba(30, 20, 15, 0.45)`) with a warm orange border (`rgba(255, 145, 0, 0.15)`)

### 2.3 Neon Breeze Theme
- **Primary Accent:** Lime Green (`#00e676` / HSL `149, 100%, 45%`)
- **Secondary Accent:** Indigo Blue (`#3d5afe` / HSL `231, 99%, 61%`)
- **Muted Accent:** Emerald (`#00b0ff` / HSL `198, 100%, 50%`)
- **Light Mode Card:** Soft mint glass (`rgba(240, 255, 244, 0.5)`) with a lime border (`rgba(0, 230, 118, 0.1)`)
- **Dark Mode Card:** Dark green/slate glass (`rgba(10, 25, 20, 0.45)`) with an indigo border (`rgba(61, 90, 254, 0.15)`)

---

## 3. UI Component Specifications

### 3.1 Unified Header
- Height: `64px`.
- Structure: Left-aligned title in thin metadata text, right-aligned toolbar with:
  - Theme Selector dropdown (Ethereal, Sunset, Breeze).
  - Light/Dark/System toggle buttons (represented by simple outlines or icons).
- Background: Dynamic translucent blur (`backdrop-blur-lg border-b border-glass`).

### 3.2 Expandable Memory Cards
- Display in a responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`).
- Standard State:
  - Height: Fixed to `160px` or truncated to a clean 3-line preview.
  - Interactive: Scale slightly on hover (`hover:scale-[1.01] hover:shadow-lg`).
  - Hierarchy path (`wing/room/hall`) displayed at the top in small monospace font.
- Expanded State:
  - Card expands height smoothly via transitions.
  - Markdown content is fully parsed and rendered with spacing, light-weight list styles, and simple code blocks.
  - Bottom area displays edit and prune actions, alongside the session timestamp and agent name.

### 3.3 Knowledge Graph Canvas
- The physics nodes must draw with circular fills and outer rings synced to active theme accents:
  - Ethereal/Sunset/Breeze matching colors.
  - Shadows on nodes drawn with translucent blur overlays.
- Connections drawn as soft, thin bezier curves.
- Panning/Zooming zoom overlay handles are simple small text-buttons located in a corner panel.

---

## 4. Coding Conventions for Styling

- **Tailwind Variables:** Bind theme variables to tailwind configuration or index.css `@utility` entries.
- **Glassmorphic styles:** Use `bg-opacity-45 border-opacity-10 backdrop-blur-md shadow-sm`.
- **Transitions:** Always use standard Tailwind duration classes: `transition-all duration-200 ease-in-out` on interactive controls.
- **Weights:** Use `font-light` or `font-normal`. Do NOT use `font-bold` or `font-medium` except in special code text or small labels where required.
