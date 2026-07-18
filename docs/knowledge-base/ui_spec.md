# Specification: MCP UI Redesign & TanStack Query Integration

## Problem Statement
The current memory dashboard UI (`mcp-ui`) is built with a basic design that lacks visual polish, does not feel modern or mature, and relies on boilerplate `useEffect` hooks and manual state management. This leads to slow loading states, a lack of clear visual feedback during operations, and a complex state model. Furthermore, memory contents are displayed in a generic table rather than a rich, readable format.

---

## Solution
We will refactor the React frontend (`mcp-ui`) using a high-fidelity, light-mode preferred **Material-Glassmorphism** visual system featuring frosted glass panels, subtle border outlines, light shadows, and soft mesh gradient background blobs. We will integrate **TanStack Query** (`@tanstack/react-query`) to streamline state management and query invalidation. We will replace the memories table with a grid of cards that expand in place to render rich Markdown previews of memories.

---

## User Stories

1. As a developer using the MCP server, I want to see a beautifully styled landing page with soft mesh gradient backgrounds, so that the tool feels premium and modern.
2. As a user, I want the UI to default to a clean, crisp Light Mode, so that readability is maximized during daytime usage.
3. As a user, I want to toggle between Light Mode and Dark Mode manually or sync it to my system setting, so that the interface matches my environment.
4. As a user, I want to switch between three visual themes (Ethereal Pastel, Sunset Glow, Neon Breeze), so that I can personalize the styling of the mesh gradients.
5. As a user, I want the Knowledge Graph node colors to shift dynamically based on the active theme, so that the visual styling remains consistent.
6. As an agent user, I want to view my stored memories as a card grid rather than a dense table, so that the layout feels clean and readable.
7. As an agent user, I want to click on a memory card to expand it smoothly in place, so that I can see a rich Markdown preview of the memory content.
8. As a developer, I want all network requests (fetching metrics, loading graph data, searching memories) to be handled asynchronously via TanStack Query, so that loading and error states are managed gracefully.
9. As a user, I want to search and filter memories by keywords instantly, so that I can find specific facts.
10. As a user, I want to edit a memory's content directly inline and press enter or click away to save, so that correcting facts is quick and frictionless.
11. As a user, I want to delete a memory by clicking a "Prune" button, so that irrelevant memories are removed.
12. As a user, I want to trigger a background memory compaction loop with a visual "compaction loading" state, so that duplicate memories are cleaned up and resolved.
13. As a developer, I want the frontend to use Google's `Plus Jakarta Sans` font with light (300) and normal (400) weights, so that typography remains highly geometric and elegant.

---

## Implementation Decisions

### Modules & Interfaces to Build/Modify
- **Query & Mutation Hooks:** We will replace the manual `fetch` calls in `App.tsx`, `DreamCorrection.tsx`, and `KnowledgeGraph.tsx` with TanStack Query's `useQuery` and `useMutation`.
- **Global Theme Context:** We will implement state for active theme palette (Ethereal, Sunset, Breeze) and color mode (Light, Dark, System) in the root App, cascading these values to both CSS custom properties and the Knowledge Graph drawing functions.
- **Rich Preview Grid Component:** We will build a card-based memory grid where each card manages its own expanded state, renders markdown content dynamically via a lightweight safe parser, and handles inline corrections.

### Architectural Decisions
- **Unified Query Client:** Initialize a single `QueryClient` at the application root (`main.tsx`).
- **Canvas Theming Sync:** The Canvas drawing loop will read styling variables directly from active React refs or CSS variables during redraw ticks.

### Schema & API Contracts
- No database schema changes are required for this frontend-only overhaul.
- The existing REST endpoints (`/api/metrics`, `/api/graph`, `/api/memories`, `/api/memories/correct`, and `/api/compaction`) remain unchanged.

---

## Testing Decisions

### What Makes a Good Test
- Tests should verify that user actions (e.g. clicking "Prune", saving an inline edit) correctly trigger mutations and invalidate the related query cache keys (e.g. `['memories']`, `['metrics']`).
- Layout changes must be verified visually by compiling the frontend assets and validating their responsive reflows.

### Modules to Test
- `DreamCorrection` queries and cache updates.
- Theme switching toggles and dark mode classes applied to the HTML element.

---

## Out of Scope
- Rewriting the background Python or Bun server implementations (this spec is strictly for the frontend UI visual overhaul).
- Implementing new tools or REST API paths on the server.

---

## Further Notes
- The compilation target remains `node/mcp-server/public`, which ensures the updated UI is automatically bundled and distributed with the npm package.
