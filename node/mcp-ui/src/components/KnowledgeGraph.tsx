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

interface Memory {
  id: string;
  content: string;
  room?: string;
  wing?: string;
  archived?: number;
  created_at?: string;
}

export const KnowledgeGraph: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const graphDataRef = useRef<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const dragInfoRef = useRef<{ nodeId: string | null; startX: number; startY: number } | null>(null);
  const hoverNodeRef = useRef<GraphNode | null>(null);

  const [selectedNodeState, setSelectedNodeState] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemContent, setNewMemContent] = useState('');
  const [newMemRoom, setNewMemRoom] = useState('general');
  const [notification, setNotification] = useState<string | null>(null);

  const [themeTick, setThemeTick] = useState(0);

  // Fetch graph topology
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

  // Fetch active memories for Spatial Palace CRUD
  const { data: memories = [], refetch: refetchMemories } = useQuery<Memory[]>({
    queryKey: ['memories', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/memories?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) return [];
      return res.json();
    }
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

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeTick(t => t + 1);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    draw();
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

    const workerCode = `
      importScripts('https://unpkg.com/d3-force@3/dist/d3-force.min.js');

      let simulation;

      self.onmessage = function(e) {
        const { type, nodes, links, width, height } = e.data;

        if (type === 'INIT') {
          simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(110))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide(40));

          simulation.on('tick', () => {
            self.postMessage({ type: 'TICK', nodes, links });
          });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : 800;
    const height = canvas ? canvas.height : 600;

    worker.postMessage({
      type: 'INIT',
      nodes: data.nodes,
      links: data.links,
      width,
      height
    });

    worker.onmessage = (e) => {
      if (e.data.type === 'TICK') {
        graphDataRef.current.nodes = e.data.nodes;
        graphDataRef.current.links = e.data.links;
        draw();
      }
    };

    workerRef.current = worker;
  };

  const getCssVar = (name: string): string => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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
      page: '#f43f5e',
      concept: '#f57c00',
      tool: '#10b981',
      default: '#6366f1',
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

      const isRelated = hoverNodeRef.current && (
        (typeof link.source === 'object' ? link.source.id : link.source) === hoverNodeRef.current.id ||
        (typeof link.target === 'object' ? link.target.id : link.target) === hoverNodeRef.current.id
      );

      ctx.strokeStyle = isRelated ? edgeColor : 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = isRelated ? 2.5 : 1.5;
      ctx.setLineDash(isRelated ? [] : [4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isRelated || transformRef.current.scale > 1.2) {
        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;
        ctx.fillStyle = labelColor;
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(link.relation_type, midX, midY - 4);
      }
    });

    // Draw Nodes
    nodes.forEach(node => {
      if (node.x === undefined || node.y === undefined) return;

      const isHovered = hoverNodeRef.current?.id === node.id;
      const isSearched = searchQuery && (
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.type.toLowerCase().includes(searchQuery.toLowerCase())
      );

      const baseRadius = 10;
      const radius = isHovered ? baseRadius * 1.4 : (isSearched ? baseRadius * 1.3 : baseRadius);
      const color = nodeColors[node.type] || nodeColors.default;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

      ctx.fillStyle = color;
      ctx.globalAlpha = isHovered ? 1 : 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.shadowColor = color;
      ctx.shadowBlur = isHovered || isSearched ? 15 : 4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = mainTextColor;
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
      y: (screenY - rect.top - ty) / scale,
    };
  };

  const getNodeAtPoint = (worldX: number, worldY: number): GraphNode | null => {
    const { nodes } = graphDataRef.current;
    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue;
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      if (dx * dx + dy * dy <= 144) {
        return node;
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const world = screenToWorld(e.clientX, e.clientY);
    const node = getNodeAtPoint(world.x, world.y);

    if (node) {
      dragInfoRef.current = { nodeId: node.id, startX: e.clientX, startY: e.clientY };
      node.fx = node.x;
      node.fy = node.y;
      setSelectedNodeState(node);
    } else {
      dragInfoRef.current = { nodeId: null, startX: e.clientX, startY: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const world = screenToWorld(e.clientX, e.clientY);

    if (dragInfoRef.current) {
      const dx = e.clientX - dragInfoRef.current.startX;
      const dy = e.clientY - dragInfoRef.current.startY;

      if (dragInfoRef.current.nodeId) {
        const node = graphDataRef.current.nodes.find(n => n.id === dragInfoRef.current!.nodeId);
        if (node) {
          node.fx = (node.fx || 0) + dx / transformRef.current.scale;
          node.fy = (node.fy || 0) + dy / transformRef.current.scale;
        }
      } else {
        transformRef.current.x += dx;
        transformRef.current.y += dy;
      }

      dragInfoRef.current.startX = e.clientX;
      dragInfoRef.current.startY = e.clientY;
      draw();
    } else {
      const hovered = getNodeAtPoint(world.x, world.y);
      if (hovered !== hoverNodeRef.current) {
        hoverNodeRef.current = hovered;
        if (hovered) setSelectedNodeState(hovered);
        draw();
      }
    }
  };

  const handleMouseUp = () => {
    if (dragInfoRef.current?.nodeId) {
      const node = graphDataRef.current.nodes.find(n => n.id === dragInfoRef.current!.nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }
    dragInfoRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(transformRef.current.scale * zoomFactor, 0.4), 3.0);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    transformRef.current.x = mouseX - (mouseX - transformRef.current.x) * (newScale / transformRef.current.scale);
    transformRef.current.y = mouseY - (mouseY - transformRef.current.y) * (newScale / transformRef.current.scale);
    transformRef.current.scale = newScale;

    draw();
  };

  // Memory CRUD handlers
  const handleSaveAddMemory = async () => {
    if (!newMemContent.trim()) return;
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMemContent, room: newMemRoom })
      });
      const data = await res.json();
      if (data.success) {
        setNotification('Memory fragment persisted to SQLite Memory Palace!');
        setNewMemContent('');
        setShowAddForm(false);
        refetchMemories();
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (e: any) {
      setNotification(`Failed: ${e.message}`);
    }
  };

  const handleSaveEditMemory = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      const res = await fetch('/api/memories/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: editContent })
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`Memory #${id} updated.`);
        setEditingMemoryId(null);
        refetchMemories();
        setTimeout(() => setNotification(null), 3000);
      } else {
        alert(data.error || 'Failed to update memory');
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleArchiveMemory = async (id: string) => {
    try {
      const res = await fetch('/api/memories/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`Memory #${id} archived to Read-Only Vault.`);
        refetchMemories();
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (e: any) {
      alert(`Archive error: ${e.message}`);
    }
  };

  // Filter memories matching selected node room or label
  const displayedMemories = memories.filter(m => {
    if (!selectedNodeState) return true;
    const label = selectedNodeState.label.toLowerCase();
    const type = selectedNodeState.type.toLowerCase();
    const content = m.content.toLowerCase();
    const room = (m.room || '').toLowerCase();
    return content.includes(label) || room.includes(label) || room.includes(type);
  });

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[720px] relative">
      {/* 2D Canvas Viewport (8 Cols) */}
      <div ref={containerRef} className="flex-1 glass-card rounded-2xl relative overflow-hidden shadow-sm border border-slate-200/80 dark:border-slate-800">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* Zoom Controls */}
        <div className="absolute bottom-4 right-4 flex items-center space-x-1.5 glass-pill p-1.5 rounded-xl text-xs font-mono">
          <button
            onClick={() => {
              transformRef.current.scale = Math.min(transformRef.current.scale * 1.2, 3.0);
              draw();
            }}
            className="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold transition-all"
          >
            +
          </button>
          <button
            onClick={() => {
              transformRef.current.scale = Math.max(transformRef.current.scale * 0.8, 0.4);
              draw();
            }}
            className="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold transition-all"
          >
            −
          </button>
          <button
            onClick={() => {
              transformRef.current = { scale: 1, x: 0, y: 0 };
              draw();
            }}
            className="px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold transition-all text-[11px]"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Spatial Palace Inspector & Memory CRUD Drawer (4 Cols) */}
      <div className="w-full md:w-96 glass-card rounded-2xl p-5 flex flex-col h-full space-y-4 shadow-sm border border-slate-200/80 dark:border-slate-800">
        {/* Header & Add Memory Trigger */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">Spatial Palace Inspector</h3>
            <p className="text-[11px] text-slate-500">Explore, search, edit & archive palace memories</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] text-white text-[11px] font-semibold hover:opacity-90 transition-all flex items-center gap-1 shadow-sm active:scale-95"
          >
            {showAddForm ? 'Close' : '+ Add Memory'}
          </button>
        </div>

        {notification && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 text-[11px] font-mono text-emerald-800 dark:text-emerald-200">
            ✓ {notification}
          </div>
        )}

        {/* Add Memory Form */}
        {showAddForm && (
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">Add Memory to Palace</div>
            <textarea
              rows={2}
              placeholder="Memory content or entity fact statement..."
              value={newMemContent}
              onChange={e => setNewMemContent(e.target.value)}
              className="w-full text-xs font-mono p-2 rounded-lg glass-input text-slate-900 dark:text-slate-100 outline-none"
            />
            <div className="flex justify-between items-center">
              <input
                type="text"
                placeholder="Room (e.g. notion, general)"
                value={newMemRoom}
                onChange={e => setNewMemRoom(e.target.value)}
                className="text-xs font-mono p-1.5 rounded-lg glass-input text-slate-900 dark:text-slate-100 w-36 outline-none"
              />
              <button
                onClick={handleSaveAddMemory}
                className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 active:scale-95"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Search Input */}
        <input
          type="text"
          placeholder="Search palace memories & entities..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            draw();
          }}
          className="w-full text-xs font-mono px-3.5 py-2 rounded-xl glass-input outline-none focus:ring-2 focus:ring-[var(--accent-color)] text-slate-900 dark:text-slate-100"
        />

        {/* Node Filter Info */}
        {selectedNodeState && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex justify-between items-center text-xs font-mono">
            <span className="text-amber-800 dark:text-amber-300 font-semibold">Node: {selectedNodeState.label}</span>
            <button
              onClick={() => setSelectedNodeState(null)}
              className="text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              Clear Filter
            </button>
          </div>
        )}

        {/* Palace Memory Cards List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {displayedMemories.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 p-4 font-mono italic">
              No cognitive memories found matching search or selected node. Click "+ Add Memory" to store one!
            </div>
          ) : (
            displayedMemories.map(mem => (
              <div
                key={mem.id}
                className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm"
              >
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">ID: #{mem.id}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                    {mem.room || 'general'}
                  </span>
                </div>

                {editingMemoryId === mem.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="w-full text-xs font-mono p-2 rounded-lg glass-input text-slate-900 dark:text-slate-100 outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingMemoryId(null)}
                        className="px-2.5 py-1 rounded text-xs text-slate-500 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEditMemory(mem.id)}
                        className="px-3 py-1 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold active:scale-95"
                      >
                        Save Edits
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                      {mem.content}
                    </p>
                    <div className="flex justify-end items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      <button
                        onClick={() => {
                          setEditingMemoryId(mem.id);
                          setEditContent(mem.content);
                        }}
                        className="text-[11px] font-mono text-slate-600 dark:text-slate-400 hover:text-[var(--accent-color)] font-medium flex items-center gap-1 active:scale-95"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleArchiveMemory(mem.id)}
                        className="text-[11px] font-mono text-amber-700 dark:text-amber-400 hover:text-amber-800 font-medium flex items-center gap-1 active:scale-95"
                      >
                        📦 Archive
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Legend */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400 font-mono space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f43f5e' }} />
            <span>Page Nodes</span>
            <div className="w-2.5 h-2.5 rounded-full ml-3" style={{ backgroundColor: '#f57c00' }} />
            <span>Concept Nodes</span>
            <div className="w-2.5 h-2.5 rounded-full ml-3" style={{ backgroundColor: '#10b981' }} />
            <span>Tool Nodes</span>
          </div>
        </div>
      </div>
    </div>
  );
};
