# 1. Canvas Graph Visualization with Web Worker

We decided to render the Knowledge Graph using HTML5 Canvas on the main thread and offload the D3 force simulation loop to a background Web Worker.

## Context

To support large-scale networks with thousands of nodes and relations created by multiple agent harnesses over time, the dashboard graph visualization must remain responsive and render at 60fps. Running D3 physics loops (forces, bounds, collisions) directly on the browser's main thread causes layout jank, input delays, and freezes the UI.

## Decision

We chose to:
1. Calculate node forces and coordinates inside a background `d3-layout.worker.ts` Web Worker.
2. Render nodes, links, and text labels on the main thread using HTML5 Canvas.
3. Detect hovered and clicked nodes on the canvas using D3's quadtree spatial search (`simulation.find`) on mouse move, running in under 1ms.

## Consequences

* **Pros**: High-performance rendering scales easily to 5,000+ nodes. The main thread remains responsive. Hover and drag interactions are immediate.
* **Cons**: Canvas rendering code is more verbose than standard React SVG markup, and custom font rendering/shadows must be handled manually.
