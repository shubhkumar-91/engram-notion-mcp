import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../services/local-db';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  relation_type: string;
}

export const KnowledgeGraph: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const graphDataRef = useRef<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const dragInfoRef = useRef<{ nodeId: string | null; startX: number; startY: number } | null>(null);
  const hoverNodeRef = useRef<GraphNode | null>(null);

  const [hoverNodeState, setHoverNodeState] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Theme state to trigger redraw when mode/theme changes
  const [themeTick, setThemeTick] = useState(0);

  const { data: rawGraphData, isLoading } = useQuery({
    queryKey: ['graph'],
    queryFn: async () => {
      const response = await fetch('/api/graph');
      if (!response.ok) throw new Error('Failed to fetch graph data');
      const data = await response.json();
      
      await db.nodes.clear();
      await db.edges.clear();
      await db.nodes.bulkPut(data.nodes);
      await db.edges.bulkPut(data.links);
      
      return data;
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (rawGraphData) {
      graphDataRef.current = rawGraphData;
      initializeWorker(rawGraphData);
    }
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [rawGraphData]);

  // Observer for theme changes to redraw canvas
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeTick(t => t + 1);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    draw(); // Redraw when theme tick changes
  }, [themeTick]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const initializeWorker = (data: { nodes: GraphNode[]; links: GraphLink[] }) => {
    if (workerRef.current) workerRef.current.terminate();

    const canvas = canvasRef.current;
    const width = canvas?.width || 800;
    const height = canvas?.height || 500;

    workerRef.current = new Worker(
      new URL('../workers/d3-layout.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (event: MessageEvent) => {
      const { type, nodes, links } = event.data;
      if (type === 'tick' || type === 'end') {
        graphDataRef.current = { nodes, links };
        draw();
      }
    };

    workerRef.current.postMessage({
      type: 'init',
      nodes: data.nodes,
      links: data.links,
      width,
      height
    });
  };

  const getCssVar = (name: string) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#ffffff';
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const { nodes, links } = graphDataRef.current;
    const { scale, x, y } = transformRef.current;

    const nodeColors: Record<string, string> = {
      page: getCssVar('--node-page'),
      concept: getCssVar('--node-concept'),
      tool: getCssVar('--node-tool'),
      default: getCssVar('--node-default'),
    };
    
    const edgeColor = getCssVar('--accent-color');
    const labelColor = getCssVar('--text-muted');
    const mainTextColor = getCssVar('--text-main');

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Draw Links
    links.forEach(link => {
      const sourceNode = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
      const targetNode = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);

      if (!sourceNode || !targetNode || sourceNode.x === undefined || sourceNode.y === undefined || targetNode.x === undefined || targetNode.y === undefined) return;

      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);
      
      ctx.strokeStyle = edgeColor;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      const midX = (sourceNode.x + targetNode.x) / 2;
      const midY = (sourceNode.y + targetNode.y) / 2;
      ctx.fillStyle = labelColor;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(link.relation_type, midX, midY - 4);
    });

    // Draw Nodes
    nodes.forEach(node => {
      if (node.x === undefined || node.y === undefined) return;

      const isHovered = hoverNodeRef.current?.id === node.id;
      const isSearched = searchQuery && node.label.toLowerCase().includes(searchQuery.toLowerCase());
      const baseRadius = 8;
      const radius = isHovered ? baseRadius * 1.5 : (isSearched ? baseRadius * 1.3 : baseRadius);
      const color = nodeColors[node.type] || nodeColors.default;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

      ctx.fillStyle = color;
      ctx.globalAlpha = isHovered ? 1 : 0.8;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.shadowColor = color;
      ctx.shadowBlur = isHovered || isSearched ? 15 : 0;
      ctx.strokeStyle = getCssVar('--bg-color');
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isHovered ? mainTextColor : mainTextColor;
      ctx.font = isHovered ? 'bold 11px Plus Jakarta Sans, sans-serif' : '10px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + radius + 14);

      if (isHovered) {
        ctx.fillStyle = labelColor;
        ctx.font = '9px monospace';
        ctx.fillText(node.type.toUpperCase(), node.x, node.y + radius + 25);
      }
    });

    ctx.restore();
  };

  const screenToWorld = (screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const { scale, x: tx, y: ty } = transformRef.current;
    return {
      x: (screenX - rect.left - tx) / scale,
      y: (screenY - rect.top - ty) / scale
    };
  };

  const findNodeAt = (worldX: number, worldY: number) => {
    const { nodes } = graphDataRef.current;
    let closestNode: GraphNode | null = null;
    let minDistance = 25; 
    nodes.forEach(node => {
      if (node.x === undefined || node.y === undefined) return;
      const dx = node.x - worldX;
      const dy = node.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        minDistance = dist;
        closestNode = node;
      }
    });
    return closestNode;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const world = screenToWorld(e.clientX, e.clientY);
    const node = findNodeAt(world.x, world.y);

    if (node) {
      dragInfoRef.current = {
        nodeId: node.id,
        startX: world.x - (node.x || 0),
        startY: world.y - (node.y || 0)
      };
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'drag', nodeId: node.id, x: world.x, y: world.y });
      }
    } else {
      dragInfoRef.current = {
        nodeId: null,
        startX: e.clientX - transformRef.current.x,
        startY: e.clientY - transformRef.current.y
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const world = screenToWorld(e.clientX, e.clientY);
    
    if (dragInfoRef.current) {
      const drag = dragInfoRef.current;
      if (drag.nodeId) {
        if (workerRef.current) {
          workerRef.current.postMessage({ type: 'drag', nodeId: drag.nodeId, x: world.x - drag.startX, y: world.y - drag.startY });
        }
      } else {
        transformRef.current = {
          ...transformRef.current,
          x: e.clientX - drag.startX,
          y: e.clientY - drag.startY
        };
        draw();
      }
    } else {
      const hovered = findNodeAt(world.x, world.y);
      if (hovered?.id !== hoverNodeRef.current?.id) {
        hoverNodeRef.current = hovered;
        setHoverNodeState(hovered);
        draw();
      }
    }
  };

  const handleMouseUp = () => {
    if (dragInfoRef.current) {
      const drag = dragInfoRef.current;
      if (drag.nodeId && workerRef.current) {
        workerRef.current.postMessage({ type: 'dragEnd', nodeId: drag.nodeId });
      }
      dragInfoRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomIntensity = 0.05;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mouse = screenToWorld(e.clientX, e.clientY);
    const { scale, x, y } = transformRef.current;
    const newScale = e.deltaY < 0 
      ? Math.min(scale * (1 + zoomIntensity), 5) 
      : Math.max(scale * (1 - zoomIntensity), 0.15);
    const newX = e.clientX - canvas.getBoundingClientRect().left - mouse.x * newScale;
    const newY = e.clientY - canvas.getBoundingClientRect().top - mouse.y * newScale;

    transformRef.current = { scale: newScale, x: newX, y: newY };
    draw();
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[600px] w-full">
      <div 
        ref={containerRef} 
        className="flex-1 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-2xl relative overflow-hidden h-full min-h-[400px] backdrop-blur-md shadow-sm"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-color)]/50 z-10 backdrop-blur-sm">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-10 h-10 border-4 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-[var(--text-muted)]">Loading memory connections...</span>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full block cursor-grab active:cursor-grabbing"
        />

        <div className="absolute bottom-4 right-4 flex space-x-1 bg-[var(--panel-bg)] border border-[var(--panel-border)] p-1.5 rounded-lg shadow-md backdrop-blur-md">
          <button 
            onClick={() => { transformRef.current.scale = Math.min(transformRef.current.scale * 1.2, 5); draw(); }}
            className="w-8 h-8 rounded hover:bg-[var(--panel-border)] text-sm font-semibold flex items-center justify-center text-[var(--text-main)]"
          >＋</button>
          <button 
            onClick={() => { transformRef.current.scale = Math.max(transformRef.current.scale * 0.8, 0.15); draw(); }}
            className="w-8 h-8 rounded hover:bg-[var(--panel-border)] text-sm font-semibold flex items-center justify-center text-[var(--text-main)]"
          >－</button>
          <button 
            onClick={() => { transformRef.current = { scale: 1, x: 0, y: 0 }; draw(); }}
            className="px-2 h-8 rounded hover:bg-[var(--panel-border)] text-xs font-medium flex items-center justify-center text-[var(--text-main)]"
          >Reset</button>
        </div>
      </div>

      <div className="w-full md:w-80 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-2xl p-5 flex flex-col h-full space-y-4 backdrop-blur-md shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-main)]">Search Entities</h3>
          <input
            type="text"
            placeholder="Type filter e.g. Notion..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              draw();
            }}
            className="w-full mt-2 bg-transparent border border-[var(--panel-border)] focus:border-[var(--accent-color)] outline-none px-3 py-2 rounded-lg text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] transition-colors"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {hoverNodeState ? (
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">Entity Details</span>
                <span 
                  className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase font-mono"
                  style={{
                    backgroundColor: `var(--node-${hoverNodeState.type}, var(--node-default))`,
                    color: '#fff',
                    opacity: 0.8
                  }}
                >
                  {hoverNodeState.type}
                </span>
              </div>
              <h4 className="text-base font-bold text-[var(--text-main)] leading-tight">{hoverNodeState.label}</h4>
              <hr className="border-[var(--panel-border)]" />
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono block">Node Connections</span>
                <div className="max-h-[220px] overflow-y-auto space-y-2 text-xs text-[var(--text-muted)]">
                  {graphDataRef.current.links
                    .filter(l => {
                      const src = typeof l.source === 'object' ? l.source.id : l.source;
                      const tgt = typeof l.target === 'object' ? l.target.id : l.target;
                      return src === hoverNodeState.id || tgt === hoverNodeState.id;
                    })
                    .map(l => {
                      const srcNode = typeof l.source === 'object' ? l.source : graphDataRef.current.nodes.find(n => n.id === l.source);
                      const tgtNode = typeof l.target === 'object' ? l.target : graphDataRef.current.nodes.find(n => n.id === l.target);
                      const otherNode = srcNode?.id === hoverNodeState.id ? tgtNode : srcNode;
                      
                      return (
                        <div key={l.id} className="p-2 bg-[var(--panel-border)]/30 rounded-lg border border-[var(--panel-border)] flex flex-col space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-[var(--accent-color)] font-mono">
                            <span>{srcNode?.id === hoverNodeState.id ? 'OUTBOUND' : 'INBOUND'}</span>
                            <span className="text-[var(--text-muted)]">•</span>
                            <span>{l.relation_type.toUpperCase()}</span>
                          </div>
                          <span className="text-[var(--text-main)] font-medium">{otherNode?.label}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-xs text-[var(--text-muted)] p-4">
              Hover over a node in the graph to explore its context, labels, and local relationships.
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-[var(--panel-border)] text-[10px] text-[var(--text-muted)] font-mono space-y-1.5">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--node-page)' }} />
            <span>Page Nodes</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--node-concept)' }} />
            <span>Concept Nodes</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--node-tool)' }} />
            <span>Tool Nodes</span>
          </div>
        </div>
      </div>
    </div>
  );
};
