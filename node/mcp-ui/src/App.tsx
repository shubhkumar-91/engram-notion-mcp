import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DreamCorrection } from './components/DreamCorrection.tsx';
import { KnowledgeGraph } from './components/KnowledgeGraph.tsx';

type Mode = 'light' | 'dark' | 'system';
type Theme = 'ethereal' | 'sunset' | 'neon';

export default function App() {
  const [activeTab, setActiveTab] = useState<'graph' | 'triage'>('graph');
  const [mode, setMode] = useState<Mode>('light');
  const [theme, setTheme] = useState<Theme>('ethereal');

  // React Query for metrics
  const { data: metrics = { total_memories: 0, total_nodes: 0, total_edges: 0, active_sessions: 0 } } = useQuery({
    queryKey: ['metrics', activeTab],
    queryFn: async () => {
      const res = await fetch('/api/metrics');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    retry: false
  });

  useEffect(() => {
    // Mode logic
    let isDark = false;
    if (mode === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else if (mode === 'dark') {
      isDark = true;
    }
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Theme logic
    document.documentElement.setAttribute('data-theme', theme);
  }, [mode, theme]);

  return (
    <>
      <div className="mesh-bg">
        <div className="mesh-blob mesh-blob-1"></div>
        <div className="mesh-blob mesh-blob-2"></div>
      </div>
      <div className="min-h-screen flex flex-col font-sans relative z-10">
        <header className="p-4 bg-[var(--panel-bg)] border-b border-[var(--panel-border)] flex justify-between items-center backdrop-blur-md shadow-sm">
          <h1 className="text-lg font-normal tracking-tight text-[var(--accent-color)]">Engram Notion Memory</h1>
          
          <div className="flex items-center space-x-4">
            <div className="flex space-x-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                className="bg-transparent border border-[var(--panel-border)] rounded-md text-sm p-1 text-[var(--text-main)] outline-none focus:border-[var(--accent-color)] transition-colors"
              >
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
                <option value="system">System</option>
              </select>

              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
                className="bg-transparent border border-[var(--panel-border)] rounded-md text-sm p-1 text-[var(--text-main)] outline-none focus:border-[var(--accent-color)] transition-colors"
              >
                <option value="ethereal">Ethereal Pastel</option>
                <option value="sunset">Sunset Glow</option>
                <option value="neon">Neon Breeze</option>
              </select>
            </div>

            <div className="flex space-x-2 bg-[var(--panel-bg)] p-1 rounded-lg border border-[var(--panel-border)] shadow-sm">
              <button
                onClick={() => setActiveTab('graph')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'graph' ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Knowledge Graph
              </button>
              <button
                onClick={() => setActiveTab('triage')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'triage' ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Dream Correction
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Metrics Bar */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-xl backdrop-blur-md shadow-sm">
              <div className="text-xs text-[var(--text-muted)] font-normal">Total Memories</div>
              <div className="text-2xl font-light text-[var(--accent-color)] mt-1">{metrics.total_memories}</div>
            </div>
            <div className="p-4 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-xl backdrop-blur-md shadow-sm">
              <div className="text-xs text-[var(--text-muted)] font-normal">Entities (Nodes)</div>
              <div className="text-2xl font-light text-[var(--accent-color)] mt-1">{metrics.total_nodes}</div>
            </div>
            <div className="p-4 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-xl backdrop-blur-md shadow-sm">
              <div className="text-xs text-[var(--text-muted)] font-normal">Relations (Edges)</div>
              <div className="text-2xl font-light text-[var(--accent-color)] mt-1">{metrics.total_edges}</div>
            </div>
            <div className="p-4 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-xl backdrop-blur-md shadow-sm">
              <div className="text-xs text-[var(--text-muted)] font-normal">Active Sessions</div>
              <div className="text-2xl font-light text-[var(--accent-color)] mt-1">{metrics.active_sessions}</div>
            </div>
          </section>

          {activeTab === 'graph' ? (
            <KnowledgeGraph />
          ) : (
            <DreamCorrection />
          )}
        </main>
      </div>
    </>
  );
}
