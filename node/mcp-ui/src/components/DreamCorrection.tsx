import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { db } from '../services/local-db';

interface MemoryItem {
  id: string;
  content: string;
  wing: string;
  room: string;
  hall: string;
  created_at: string;
  agent_name?: string;
  harness_name?: string;
}

interface TriageItem {
  id: string;
  anomaly: string;
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'severed' | 'merged';
  aiInference: string;
  groundTruth: string;
  nodeId: string;
  timestamp: string;
}

const correctMemoryApi = async (id: string, action: 'edit' | 'delete', content?: string) => {
  const response = await fetch('/api/memories/correct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, id, content })
  });
  if (!response.ok) throw new Error('Failed to correct memory');
  return response.json();
};

export const DreamCorrection: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'triage' | 'registry'>('triage');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'severed' | 'merged'>('pending');
  const [selectedTriage, setSelectedTriage] = useState<TriageItem | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const showNotification = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const { data: triages = [], refetch: refetchTriages } = useQuery({
    queryKey: ['triage'],
    queryFn: async () => {
      const res = await fetch('/api/memories/triage');
      if (!res.ok) return [];
      return res.json() as Promise<TriageItem[]>;
    }
  });

  useEffect(() => {
    if (triages.length > 0 && !selectedTriage) {
      setSelectedTriage(triages[0]);
    }
  }, [triages]);

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ['memories', debouncedQuery],
    queryFn: async () => {
      const response = await fetch(`/api/memories?q=${encodeURIComponent(debouncedQuery)}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      
      await db.memories.clear();
      await db.memories.bulkPut(data.map((m: any) => ({
        id: m.id,
        wing: m.wing,
        room: m.room,
        hall: m.hall,
        content: m.content,
        agent_name: m.agent_name,
        timestamp: m.created_at
      })));
      return data as MemoryItem[];
    }
  });

  const editMutation = useMutation({
    mutationFn: ({ id, content }: { id: string, content: string }) => correctMemoryApi(id, 'edit', content),
    onSuccess: (data, variables) => {
      if (data.success) {
        showNotification('Memory corrected successfully', 'success');
        queryClient.invalidateQueries({ queryKey: ['memories'] });
        db.memories.update(variables.id, { content: variables.content });
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => correctMemoryApi(id, 'delete'),
    onSuccess: (data, id) => {
      if (data.success) {
        showNotification('Memory pruned successfully', 'success');
        queryClient.invalidateQueries({ queryKey: ['memories'] });
        db.memories.delete(id);
      }
    }
  });

  const handleTriageAction = (action: 'sever' | 'merge') => {
    if (!selectedTriage) return;
    const newStatus = action === 'sever' ? 'severed' : 'merged';
    selectedTriage.status = newStatus;
    showNotification(
      action === 'sever' 
        ? `Hallucination link severed for '${selectedTriage.nodeId}'.` 
        : `Ground truth merged & overwritten for '${selectedTriage.nodeId}'.`,
      'success'
    );
    setSelectedTriage({ ...selectedTriage });
  };

  const filteredTriages = triages.filter(t => statusFilter === 'all' || t.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex justify-between items-center bg-[var(--pill-bg)] p-1 rounded-xl border border-[var(--pill-border)] max-w-md">
        <button
          onClick={() => setActiveSubTab('triage')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'triage' ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          AI Hallucination Triage ({triages.filter(t => t.status === 'pending').length} Pending)
        </button>
        <button
          onClick={() => setActiveSubTab('registry')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'registry' ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Memory Fact Inspector ({memories.length})
        </button>
      </div>

      {message && (
        <div className={`p-3.5 rounded-xl text-xs font-medium border ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
        }`}>
          {message.text}
        </div>
      )}

      {activeSubTab === 'triage' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Triage Anomaly List (5 cols) */}
          <div className="lg:col-span-5 glass-card rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs uppercase font-mono tracking-wider font-semibold text-[var(--text-main)]">
                Flagged Anomaly Drawer
              </h3>
              <div className="flex space-x-1 text-[11px] font-mono">
                {(['all', 'pending', 'severed', 'merged'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2 py-0.5 rounded capitalize ${
                      statusFilter === st ? 'bg-[var(--accent-color)] text-white font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredTriages.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedTriage(item)}
                  className={`p-4 rounded-xl cursor-pointer transition-all border ${
                    selectedTriage?.id === item.id
                      ? 'bg-white dark:bg-slate-800 border-[var(--accent-color)] shadow-md ring-1 ring-[var(--accent-color)]'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                      item.severity === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
                      item.severity === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {item.severity} severity
                    </span>

                    <span className={`text-[10px] font-mono capitalize px-2 py-0.5 rounded ${
                      item.status === 'pending' ? 'bg-amber-500/20 text-amber-600' :
                      item.status === 'severed' ? 'bg-rose-500/20 text-rose-600' :
                      'bg-emerald-500/20 text-emerald-600'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-[var(--text-main)] leading-snug">{item.anomaly}</h4>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono mt-2">Node: {item.nodeId}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostic Diff Viewer (7 cols) */}
          <div className="lg:col-span-7 glass-card rounded-2xl p-6 flex flex-col justify-between space-y-6">
            {selectedTriage ? (
              <>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent-color)] font-semibold">
                        Diagnostic Diff Viewer
                      </span>
                      <h3 className="text-sm font-bold text-[var(--text-main)] mt-0.5">{selectedTriage.anomaly}</h3>
                    </div>
                    <span className="text-xs font-mono text-[var(--text-muted)]">Target: {selectedTriage.nodeId}</span>
                  </div>

                  {/* Side-by-Side Panels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* AI Hallucination */}
                    <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                      <div className="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400 uppercase flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        AI Hallucinated Inference
                      </div>
                      <p className="text-xs text-[var(--text-main)] leading-relaxed font-mono">
                        {selectedTriage.aiInference}
                      </p>
                    </div>

                    {/* Ground Truth */}
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                      <div className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Verified Ground Truth
                      </div>
                      <p className="text-xs text-[var(--text-main)] leading-relaxed font-mono">
                        {selectedTriage.groundTruth}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Triage Actions */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3">
                  <button
                    onClick={() => handleTriageAction('sever')}
                    className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold shadow hover:bg-rose-600 transition-all flex items-center gap-1.5"
                  >
                    ✂️ Sever Link & Archive
                  </button>
                  <button
                    onClick={() => handleTriageAction('merge')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow hover:bg-emerald-700 transition-all flex items-center gap-1.5"
                  >
                    🔀 Merge & Overwrite Ground Truth
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] italic py-12">
                Select an anomaly record from the drawer to inspect the diagnostic diff.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Memory Registry SubTab */
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs uppercase font-mono tracking-wider font-semibold text-[var(--text-main)]">
              Cognitive Memories Explorer
            </h3>
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs font-mono px-3.5 py-1.5 rounded-xl glass-input outline-none focus:ring-2 focus:ring-[var(--accent-color)] text-[var(--text-main)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
            {memories.map(m => (
              <div key={m.id} className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)]">
                  <span>#{m.id}</span>
                  <span>{m.wing}/{m.room}</span>
                </div>
                <div className="prose prose-sm dark:prose-invert">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[10px]">
                  <button
                    onClick={() => deleteMutation.mutate(m.id)}
                    className="text-rose-500 hover:underline font-mono"
                  >
                    Prune Memory
                  </button>
                  <span className="text-[var(--text-muted)]">{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
