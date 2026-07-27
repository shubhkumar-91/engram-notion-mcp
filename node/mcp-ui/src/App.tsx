import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NexusOverview } from './components/NexusOverview.tsx';
import { KnowledgeGraph } from './components/KnowledgeGraph.tsx';
import { DreamCorrection } from './components/DreamCorrection.tsx';
import { SystemAdmin } from './components/SystemAdmin.tsx';
import { ArchivedVault } from './components/ArchivedVault.tsx';

type Mode = 'light' | 'dark';
type Theme = 'sunset' | 'aurora';
type Tab = 'nexus' | 'spatial' | 'triage' | 'admin' | 'archive';

const PATH_TO_TAB: Record<string, Tab> = {
  '/': 'nexus',
  '/nexus': 'nexus',
  '/dashboard': 'nexus',
  '/spatial': 'spatial',
  '/palace': 'spatial',
  '/dream-correction': 'triage',
  '/triage': 'triage',
  '/admin': 'admin',
  '/archive': 'archive'
};

const TAB_TO_PATH: Record<Tab, string> = {
  nexus: '/nexus',
  spatial: '/spatial',
  triage: '/dream-correction',
  admin: '/admin',
  archive: '/archive'
};

export default function App() {
  const [activeTab, setActiveTabState] = useState<Tab>(() => {
    const currentPath = window.location.pathname;
    return PATH_TO_TAB[currentPath] || 'nexus';
  });

  const [mode, setMode] = useState<Mode>('light');
  const [theme, setTheme] = useState<Theme>('sunset');
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Sync state to browser URL location
  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab);
    const targetPath = TAB_TO_PATH[tab] || '/nexus';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const currentPath = window.location.pathname;
      setActiveTabState(PATH_TO_TAB[currentPath] || 'nexus');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch real-time vitals and metrics
  const { data: vitals = {
    total_memories: 0,
    archived_memories: 0,
    total_nodes: 0,
    total_edges: 0,
    active_sessions: 0,
    notion_status: 'Demo Sandbox',
    optimizer_integrity: 98.4,
    cognitive_capacity_used: 4.2,
    cognitive_capacity_total: 8.0
  } } = useQuery({
    queryKey: ['metrics', activeTab],
    queryFn: async () => {
      const res = await fetch('/api/metrics');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    refetchInterval: 10000
  });

  useEffect(() => {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (theme === 'aurora') {
      document.documentElement.setAttribute('data-theme', 'aurora');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [mode, theme]);

  const handleAuthorize = (safeWord: string) => {
    if (safeWord.trim().toUpperCase() === 'CITRUS') {
      setIsAuthorized(true);
      return true;
    }
    return false;
  };

  return (
    <>
      {/* 4 Animated Motion Mesh Blobs */}
      <div className="mesh-bg">
        <div className="mesh-blob mesh-blob-1"></div>
        <div className="mesh-blob mesh-blob-2"></div>
        <div className="mesh-blob mesh-blob-3"></div>
        <div className="mesh-blob mesh-blob-4"></div>
      </div>

      <div className="min-h-screen flex flex-col font-sans relative z-10">
        {/* Header HUD System Vitals */}
        <header className="sticky top-0 z-50 glass-card border-b border-[var(--glass-border)] px-6 py-3.5 backdrop-blur-xl shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* Logo & Title */}
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[var(--accent-from)] to-[var(--accent-to)] flex items-center justify-center text-white font-bold text-lg shadow-md glow-accent">
                🧠
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-[var(--text-main)] font-mono flex items-center gap-2">
                  ENGRAM <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[var(--pill-bg)] border border-[var(--pill-border)] text-[var(--accent-color)]">MCP Console</span>
                </h1>
                <p className="text-[11px] text-[var(--text-muted)] font-medium">Local Memory Palace & Notion HUD</p>
              </div>
            </div>

            {/* System Vitals Bar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Engine Mode */}
              <div className="px-3 py-1 rounded-xl glass-pill flex items-center gap-2 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[var(--text-muted)]">Engine:</span>
                <span className="font-bold text-[var(--text-main)]">{vitals.notion_status}</span>
              </div>

              {/* Optimizer Integrity */}
              <div className="px-3 py-1 rounded-xl glass-pill flex items-center gap-2 text-xs font-mono">
                <span className="text-[var(--text-muted)]">SQLite:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{vitals.optimizer_integrity}%</span>
              </div>

              {/* Cognitive Capacity */}
              <div className="px-3 py-1 rounded-xl glass-pill flex items-center gap-2.5 text-xs font-mono">
                <span className="text-[var(--text-muted)]">Capacity:</span>
                <div className="w-16 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] rounded-full"
                    style={{ width: `${(vitals.cognitive_capacity_used / vitals.cognitive_capacity_total) * 100}%` }}
                  ></div>
                </div>
                <span className="font-bold text-[var(--text-main)]">{vitals.cognitive_capacity_used}/{vitals.cognitive_capacity_total}GB</span>
              </div>

              {/* Safe-Word Lock Guard Indicator */}
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1 rounded-xl glass-pill flex items-center gap-1.5 text-xs font-mono font-semibold transition-all ${
                  isAuthorized ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500/40' : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                <span>{isAuthorized ? '🔓 Authorized' : '🔒 Protected'}</span>
              </button>
            </div>

            {/* Theme & Mode Selectors */}
            <div className="flex items-center space-x-2">
              <div className="glass-pill p-1 rounded-xl flex items-center space-x-1 text-xs font-mono">
                <button
                  onClick={() => setTheme('sunset')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    theme === 'sunset' ? 'bg-amber-500 text-white font-bold shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Sunset Pulse
                </button>
                <button
                  onClick={() => setTheme('aurora')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    theme === 'aurora' ? 'bg-emerald-500 text-white font-bold shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Aurora Mint
                </button>
              </div>

              {/* Light/Dark Mode Toggle Overlay */}
              <button
                onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
                className="w-9 h-9 rounded-xl glass-pill flex items-center justify-center text-sm hover:scale-105 transition-all text-[var(--text-main)]"
                title="Toggle Light/Dark Mode"
              >
                {mode === 'light' ? '🌙' : '☀️'}
              </button>
            </div>

          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
          
          {/* Main Glass Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-2 rounded-2xl shadow-sm">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'nexus', label: 'Nexus Overview', icon: '⚡' },
                { id: 'spatial', label: 'Spatial Canvas (Palace)', icon: '🗺️' },
                { id: 'triage', label: 'Dream-Correction Hub', icon: '🔮' },
                { id: 'archive', label: 'Archived Vault', icon: '📦' },
                { id: 'admin', label: 'System Admin Guard', icon: '⚙️' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 active:scale-[0.98] ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] text-white shadow-md glow-accent scale-[1.02]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="text-xs font-mono text-slate-600 dark:text-slate-400 px-3 py-1">
              Active: <span className="text-[var(--accent-color)] font-bold">{vitals.total_memories} memories</span> • <span className="text-amber-600 font-bold">{vitals.archived_memories || 0} archived</span> • <span className="text-[var(--accent-color)] font-bold">{vitals.total_nodes} nodes</span>
            </div>
          </div>

          {/* Active Tab View */}
          {activeTab === 'nexus' && <NexusOverview />}
          {activeTab === 'spatial' && <KnowledgeGraph />}
          {activeTab === 'triage' && <DreamCorrection />}
          {activeTab === 'archive' && <ArchivedVault />}
          {activeTab === 'admin' && <SystemAdmin isAuthorized={isAuthorized} onAuthorize={handleAuthorize} />}
        </main>
      </div>
    </>
  );
}
