import React, { useState, useEffect } from 'react';
import { DreamCorrection } from './components/DreamCorrection.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<'graph' | 'triage'>('graph');
  const [metrics, setMetrics] = useState({ total_memories: 0, total_nodes: 0, total_edges: 0, active_sessions: 0 });

  useEffect(() => {
    fetch('/api/metrics')
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0c0914] text-[#f0ecfa] flex flex-col font-sans">
      <header className="p-4 bg-slate-950/80 border-b border-slate-900 flex justify-between items-center backdrop-blur-md">
        <h1 className="text-lg font-bold tracking-tight text-indigo-400">Engram Notion Memory</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'graph' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-[#f0ecfa]'
            }`}
          >
            Knowledge Graph
          </button>
          <button
            onClick={() => setActiveTab('triage')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'triage' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-[#f0ecfa]'
            }`}
          >
            Dream Correction
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Metrics Bar */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl">
            <div className="text-xs text-slate-400">Total Memories</div>
            <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">{metrics.total_memories}</div>
          </div>
          <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl">
            <div className="text-xs text-slate-400">Entities (Nodes)</div>
            <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">{metrics.total_nodes}</div>
          </div>
          <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl">
            <div className="text-xs text-slate-400">Relations (Edges)</div>
            <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">{metrics.total_edges}</div>
          </div>
          <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl">
            <div className="text-xs text-slate-400">Active Sessions</div>
            <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">{metrics.active_sessions}</div>
          </div>
        </section>

        {activeTab === 'graph' ? (
          <section className="p-6 bg-slate-900/30 border border-slate-800/50 rounded-xl h-[500px] flex items-center justify-center">
            <div className="text-center">
              <div className="text-slate-400">Knowledge Graph View Canvas</div>
              <div className="text-xs text-slate-500 mt-1">Calculations offloaded to D3 Web Worker</div>
            </div>
          </section>
        ) : (
          <DreamCorrection />
        )}
      </main>
    </div>
  );
}
