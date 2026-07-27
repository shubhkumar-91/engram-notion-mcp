import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export function ArchivedVault() {
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const { data: archivedMemories = [], refetch } = useQuery({
    queryKey: ['archivedMemories', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/memories/archived?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const handleUnarchive = async (id: string) => {
    try {
      const res = await fetch('/api/memories/unarchive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`Memory #${id} successfully restored to active cognitive memory.`);
        refetch();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (e: any) {
      setNotification(`Failed to unarchive: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="glass-card p-6 rounded-2xl border-l-4 border-amber-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-xs uppercase font-mono tracking-wider font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Read-Only Archived Vault
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            Archived Memories Registry ({archivedMemories.length})
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Archived items are read-only and strictly protected from schema updates, edits, or compaction pruning algorithms.
          </p>
        </div>

        <input
          type="text"
          placeholder="Search archived vault..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full md:w-72 text-xs font-mono px-3.5 py-2 rounded-xl glass-input outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
        />
      </div>

      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-xs font-mono text-emerald-800 dark:text-emerald-200">
          ✓ {notification}
        </div>
      )}

      {/* Grid of Archived Memories */}
      {archivedMemories.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-3">
          <div className="text-3xl">📦</div>
          <h3 className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">No Archived Memories Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            When memories are marked for archiving from Spatial Palace or Dream Correction, they will appear here in read-only protected storage.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {archivedMemories.map((mem: any) => (
            <div
              key={mem.id}
              className="glass-card p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500 font-semibold">ID: #{mem.id}</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                    {mem.room || 'general'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1">
                    🔒 Archived (Read-Only)
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-normal bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
                {mem.content}
              </p>

              <div className="flex justify-between items-center pt-1 text-[11px] text-slate-500 font-mono">
                <span>Created: {new Date(mem.created_at || Date.now()).toLocaleDateString()}</span>
                <button
                  onClick={() => handleUnarchive(mem.id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  🔄 Restore to Active
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
