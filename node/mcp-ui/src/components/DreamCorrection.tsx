import React, { useState } from 'react';

interface MemoryItem {
  id: string;
  content: string;
  wing: string;
  room: string;
  hall: string;
  status: 'active' | 'flagged' | 'compacted';
}

export const DreamCorrection: React.FC = () => {
  const [memories, setMemories] = useState<MemoryItem[]>([
    { id: '1', content: 'Agent remembered Notion API integration requirements.', wing: 'default', room: 'notion', hall: 'setup', status: 'active' },
    { id: '2', content: 'Database migration triggers need proper exception handling.', wing: 'default', room: 'sqlite', hall: 'migrations', status: 'active' }
  ]);

  const handleEdit = (id: string, newContent: string) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, content: newContent } : m));
  };

  const handleDelete = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
      <h2 className="text-xl font-bold text-[#f0ecfa] mb-4">Dream-Correction (Triage Workspace)</h2>
      <p className="text-sm text-slate-400 mb-6">Review, refine, or clean your agent's memories to resolve hallucinations.</p>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-3 px-4">Hierarchy</th>
              <th className="py-3 px-4">Content</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {memories.map(m => (
              <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/25">
                <td className="py-3 px-4 text-xs font-mono text-indigo-400">
                  {m.wing}/{m.room}/{m.hall}
                </td>
                <td className="py-3 px-4">
                  <input
                    type="text"
                    value={m.content}
                    onChange={(e) => handleEdit(m.id, e.target.value)}
                    className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none w-full text-[#f0ecfa]"
                  />
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400">{m.status}</span>
                </td>
                <td className="py-3 px-4 space-x-2">
                  <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:text-red-300 text-xs font-semibold">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
