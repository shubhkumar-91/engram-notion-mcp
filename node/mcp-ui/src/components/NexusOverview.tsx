import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Tool {
  name: string;
  description: string;
  category: 'notion' | 'memory';
  params: { name: string; type: string; placeholder: string; required: boolean }[];
}

const MCP_TOOLS: Tool[] = [
  {
    name: 'notion_append_content',
    description: 'Append markdown or block content to a specific Notion page.',
    category: 'notion',
    params: [
      { name: 'page_id', type: 'text', placeholder: 'e.g. 1a2b3c4d-5e6f...', required: true },
      { name: 'content', type: 'textarea', placeholder: '# New Header\n- Bullet point content', required: true }
    ]
  },
  {
    name: 'notion_search_pages',
    description: 'Search Notion workspace pages by title or keyword.',
    category: 'notion',
    params: [
      { name: 'query', type: 'text', placeholder: 'e.g. Architecture Roadmap', required: true }
    ]
  },
  {
    name: 'notion_get_page',
    description: 'Retrieve page metadata, properties, and structure.',
    category: 'notion',
    params: [
      { name: 'page_id', type: 'text', placeholder: 'Page UUID string', required: true }
    ]
  },
  {
    name: 'notion_get_block_children',
    description: 'Fetch child content blocks inside a page or parent block.',
    category: 'notion',
    params: [
      { name: 'block_id', type: 'text', placeholder: 'Parent Block UUID', required: true }
    ]
  },
  {
    name: 'store_memory',
    description: 'Persist a cognitive memory fragment into SQLite FTS5 database.',
    category: 'memory',
    params: [
      { name: 'content', type: 'textarea', placeholder: 'Memory statement or rule text...', required: true },
      { name: 'room', type: 'text', placeholder: 'Room category (e.g. frontend, notion)', required: false }
    ]
  },
  {
    name: 'search_memories',
    description: 'Query stored cognitive memories by semantic keyword search.',
    category: 'memory',
    params: [
      { name: 'query', type: 'text', placeholder: 'Search query string...', required: true }
    ]
  }
];

interface LogEntry {
  id: string;
  type: 'EXEC' | 'SUCCESS' | 'ERROR';
  timestamp: string;
  text: string;
}

export function NexusOverview() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTool, setSelectedTool] = useState<Tool>(MCP_TOOLS[0]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', type: 'SUCCESS', timestamp: '20:30:12', text: 'Engram MCP Harness initialized on port 3123.' },
    { id: '2', type: 'EXEC', timestamp: '20:30:15', text: 'Connected to local SQLite FTS5 Memory Engine.' }
  ]);

  const { data: memories = [], refetch: refetchMemories } = useQuery({
    queryKey: ['memories', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/memories?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const handleInputChange = (paramName: string, value: string) => {
    setFormValues(prev => ({ ...prev, [paramName]: value }));
  };

  const executeTool = async () => {
    setIsExecuting(true);
    const timeStr = new Date().toLocaleTimeString();
    
    setLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        type: 'EXEC',
        timestamp: timeStr,
        text: `Executing tool '${selectedTool.name}' with params: ${JSON.stringify(formValues)}`
      }
    ]);

    try {
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_name: selectedTool.name, args: formValues })
      });
      const data = await res.json();

      if (data.success) {
        setLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'SUCCESS',
            timestamp: new Date().toLocaleTimeString(),
            text: `Tool '${selectedTool.name}' completed. Response: ${JSON.stringify(data.output)}`
          }
        ]);
        refetchMemories();
      } else {
        throw new Error(data.error || 'Execution failed');
      }
    } catch (err: any) {
      setLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'ERROR',
          timestamp: new Date().toLocaleTimeString(),
          text: `Execution failed for '${selectedTool.name}': ${err.message}`
        }
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  const filteredTools = MCP_TOOLS.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Tools Drawer (4 Cols) */}
      <div className="lg:col-span-4 space-y-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text-main)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-color)]"></span>
              MCP Tools Harness
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--pill-bg)] border border-[var(--pill-border)] text-[var(--text-muted)]">
              {filteredTools.length} Active
            </span>
          </div>

          <input
            type="text"
            placeholder="Search MCP tools..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-sm px-3.5 py-2 rounded-xl glass-input outline-none focus:ring-2 focus:ring-[var(--accent-color)] text-[var(--text-main)] mb-4"
          />

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredTools.map(tool => (
              <div
                key={tool.name}
                onClick={() => {
                  setSelectedTool(tool);
                  setFormValues({});
                }}
                className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                  selectedTool.name === tool.name
                    ? 'bg-white dark:bg-slate-800 border-[var(--accent-color)] shadow-md ring-1 ring-[var(--accent-color)]'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">{tool.name}</span>
                  <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md ${
                    tool.category === 'notion'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200'
                  }`}>
                    {tool.category}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace & Consciousness Log Stream (8 Cols) */}
      <div className="lg:col-span-8 space-y-6">
        {/* Workspace Form */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-xs uppercase font-mono tracking-wider text-[var(--accent-color)] font-semibold mb-1">
                Tool Execution Workspace
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">{selectedTool.name}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{selectedTool.description}</p>
            </div>
            <button
              onClick={executeTool}
              disabled={isExecuting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] text-white text-xs font-semibold shadow-md hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isExecuting ? 'Executing...' : 'Run Tool'}
            </button>
          </div>

          <div className="space-y-4">
            {selectedTool.params.map(param => (
              <div key={param.name} className="space-y-1.5">
                <label className="text-xs font-mono text-slate-900 dark:text-slate-100 font-medium flex items-center gap-1">
                  {param.name}
                  {param.required && <span className="text-rose-500">*</span>}
                </label>
                {param.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    placeholder={param.placeholder}
                    value={formValues[param.name] || ''}
                    onChange={e => handleInputChange(param.name, e.target.value)}
                    className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl glass-input outline-none focus:ring-2 focus:ring-[var(--accent-color)] text-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <input
                    type="text"
                    placeholder={param.placeholder}
                    value={formValues[param.name] || ''}
                    onChange={e => handleInputChange(param.name, e.target.value)}
                    className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl glass-input outline-none focus:ring-2 focus:ring-[var(--accent-color)] text-slate-900 dark:text-slate-100"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Neural Consciousness Stream */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Neural Consciousness Stream
            </h3>
            <button
              onClick={() => setLogs([])}
              className="text-[11px] font-mono text-slate-500 hover:text-rose-500 transition-colors"
            >
              Clear Stream
            </button>
          </div>

          <div className="bg-slate-950/90 rounded-xl p-4 font-mono text-xs max-h-[220px] overflow-y-auto space-y-2 border border-slate-800">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic text-center py-4">No consciousness stream logs generated yet.</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex items-start gap-3 text-slate-300 leading-relaxed">
                  <span className="text-slate-500 shrink-0 text-[10px]">{log.timestamp}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                    log.type === 'EXEC'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : log.type === 'SUCCESS'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {log.type}
                  </span>
                  <span className="break-all">{log.text}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cognitive Memories Registry */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Cognitive Memories Registry ({memories.length})
          </h3>
          {memories.length === 0 ? (
            <div className="text-xs text-slate-500 italic text-center py-6">
              No cognitive memories found matching search. Use `store_memory` tool or Seed Mock Data in System Admin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[340px] overflow-y-auto pr-1">
              {memories.map((mem: any) => (
                <div key={mem.id} className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
                  <div className="flex justify-between items-center text-[10px] text-slate-600 dark:text-slate-400 font-mono mb-1.5">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">ID: #{mem.id}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                      {mem.room || 'general'}
                    </span>
                  </div>
                  <p className="text-slate-900 dark:text-slate-100 line-clamp-3 leading-relaxed font-normal">
                    {mem.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
