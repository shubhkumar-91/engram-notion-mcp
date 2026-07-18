import { forceSimulation, forceManyBody, forceLink, forceCenter } from 'd3';

let simulation: any = null;
let currentNodes: any[] = [];
let currentLinks: any[] = [];

self.onmessage = (event: MessageEvent) => {
  const { type } = event.data;

  if (type === 'init') {
    const { nodes, links, width, height } = event.data;
    
    // Copy nodes and preserve existing coordinates/velocities if present
    currentNodes = nodes.map((n: any) => {
      const existing = currentNodes.find(old => old.id === n.id);
      return {
        ...n,
        x: n.x ?? existing?.x ?? (Math.random() * width),
        y: n.y ?? existing?.y ?? (Math.random() * height),
        vx: n.vx ?? existing?.vx ?? 0,
        vy: n.vy ?? existing?.vy ?? 0,
        fx: n.fx ?? existing?.fx ?? null,
        fy: n.fy ?? existing?.fy ?? null
      };
    });

    // Resolve link sources and targets as ids
    currentLinks = links.map((l: any) => ({
      id: l.id,
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target,
      relation_type: l.relation_type
    }));

    if (simulation) {
      simulation.stop();
    }

    simulation = forceSimulation(currentNodes)
      .force("link", forceLink(currentLinks).id((d: any) => d.id).distance(120))
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(width / 2, height / 2))
      .velocityDecay(0.4);

    let tickCount = 0;
    simulation.on("tick", () => {
      tickCount++;
      // Reduce message passing frequency to keep UI main thread responsive
      if (tickCount % 2 === 0 || simulation.alpha() < 0.05) {
        const nodesData = currentNodes.map((n: any) => ({
          id: n.id,
          label: n.label,
          type: n.type,
          x: n.x,
          y: n.y,
          vx: n.vx,
          vy: n.vy,
          fx: n.fx,
          fy: n.fy
        }));
        const linksData = currentLinks.map((l: any) => ({
          id: l.id,
          source: typeof l.source === 'object' ? l.source.id : l.source,
          target: typeof l.target === 'object' ? l.target.id : l.target,
          relation_type: l.relation_type
        }));
        self.postMessage({ type: 'tick', nodes: nodesData, links: linksData });
      }
    });

    simulation.on("end", () => {
      const nodesData = currentNodes.map((n: any) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        x: n.x,
        y: n.y,
        vx: n.vx,
        vy: n.vy,
        fx: n.fx,
        fy: n.fy
      }));
      const linksData = currentLinks.map((l: any) => ({
        id: l.id,
        source: typeof l.source === 'object' ? l.source.id : l.source,
        target: typeof l.target === 'object' ? l.target.id : l.target,
        relation_type: l.relation_type
      }));
      self.postMessage({ type: 'end', nodes: nodesData, links: linksData });
    });
  } else if (type === 'drag') {
    const { nodeId, x, y } = event.data;
    const node = currentNodes.find(n => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
      if (simulation) {
        simulation.alphaTarget(0.3).restart();
      }
    }
  } else if (type === 'dragEnd') {
    const { nodeId } = event.data;
    const node = currentNodes.find(n => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    if (simulation) {
      simulation.alphaTarget(0);
    }
  }
};
