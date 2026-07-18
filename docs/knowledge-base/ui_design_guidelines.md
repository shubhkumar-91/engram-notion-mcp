# UI Design, Theme, and Coding Guidelines for `mcp-ui`

This document defines the visual system, style guide, theme tokens, and React/TanStack coding guidelines for the browser-based Memory Dashboard (`mcp-ui`).

---

## 1. Design System & Theme: Material-Glassmorphism

### 1.1 Aesthetic Inspiration
The design blends **Material-You dynamic coloring** with **Frosted Glass (Glassmorphism)** and **Soft Mesh Gradients**.
- **Minimal & Modern:** Clean layouts, subtle shadows for depth, and rounded corners.
- **Glassmorphism:** Soft translucent panels (`rgba(255, 255, 255, 0.45)` in light mode, `rgba(22, 17, 39, 0.45)` in dark mode) with high backdrop-blur (`backdrop-blur-md`).
- **Subtle Borders:** Card borders match the active theme palette family but are slightly darker/vibranter (e.g., in Sunset Glow, orange-200 card background with orange-400 border) to ensure a mature, polished design without neobrutalist harshness.
- **No Heavy Text:** Avoid bold font weights. Use normal (`400`) and light (`300`) font weights for clean geometric elegance.

### 1.2 Interactive Mesh Gradients & Themes
The interface supports a Light Mode (preferred default) and a Dark Mode, alongside a theme selector for mesh gradients:
1. **Ethereal Pastel (Default):** Soft, elegant lavender, sky blue, and powder pink.
2. **Sunset Glow:** Warm orange, soft yellow, and coral-pink.
3. **Neon Breeze:** Vibrant lime-green and deep indigo-blue.

The Knowledge Graph nodes will render with **Theme-Synced Glows** that shift colors dynamically depending on which palette is active.

### 1.3 Typography
- **Primary Font:** `Plus Jakarta Sans` imported from Google Fonts.
- **Font Weights:** `300` (Light) and `400` (Normal) are preferred. Avoid bold weights for a clean, sophisticated look.
- **Monospace Font:** System monospace (e.g. `Fira Code`, `JetBrains Mono`) for memory hierarchy paths and session logs.

---

## 2. Component Design & Interaction Patterns

### 2.1 Navigation & Controls
- **Unified Header Controls:** A clean, minimal header bar containing the Light/Dark mode toggle (with a "Sync to System" option) alongside the theme selector dropdown (Ethereal Pastel, Sunset Glow, Neon Breeze).

### 2.2 Memory Workspace (Triage Grid)
- **Expandable Card Grid:** Rather than a generic plain table, memories are displayed in a clean, modern card grid.
- **Smooth In-Place Expansion:** Clicking a card smoothly expands it in place (using CSS transitions) to reveal:
  - A rich rendered **Markdown Preview** using a light-weight parser.
  - Tag chips representing connected Entities and Relations.
  - Active inline text inputs for quick memory corrections.

### 2.3 Knowledge Graph Visualization
- Dynamic canvas-based graph rendering connected to a Web Worker thread to ensure 60fps animations.
- Glow shadows around nodes matched to active theme colors.
- Interactive node search highlights and a right-aligned sliding details card.

---

## 3. React/TanStack Coding Guidelines

### 3.1 Server State via TanStack Query
To replace custom `useEffect` fetch blocks, use `@tanstack/react-query`:
- **useQuery:** Used to manage server fetching of metrics, graphs, and memories.
- **useMutation:** Used for all state-changing posts (`/api/memories/correct` for edits and deletions, `/api/compaction`).
- **Cache Invalidation:** Ensure that successful mutations call `queryClient.invalidateQueries` to automatically refresh related queries.

### 3.2 Dexie.js Caching
- Sync results from TanStack queries to Dexie.js (IndexedDB) to support instant (<1ms) local keyword matching and offline lookups.
