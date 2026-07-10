// Web Worker for D3 force-directed layout calculations
self.onmessage = (event: MessageEvent) => {
  const { nodes, links, width, height } = event.data;

  // Simple layout stub assigning initial positions if not present
  const updatedNodes = nodes.map((node: any) => {
    const x = node.x ?? Math.random() * width;
    const y = node.y ?? Math.random() * height;
    return { ...node, x, y };
  });

  // Return the calculated positions to the main thread
  self.postMessage({ nodes: updatedNodes, links });
};
