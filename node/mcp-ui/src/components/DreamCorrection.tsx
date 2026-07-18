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

// API Helper to deduplicate requests
const correctMemoryApi = async (id: string, action: 'edit' | 'delete', content?: string) => {
  const response = await fetch('/api/memories/correct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, id, content })
  });
  if (!response.ok) throw new Error('Failed to correct memory');
  return response.json();
};

const MemoryCard = ({ m, onEdit, onDelete }: { m: MemoryItem, onEdit: (id: string, c: string) => void, onDelete: (id: string) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(m.content);

  const handleSave = () => {
    setIsEditing(false);
    if (editValue !== m.content) {
      onEdit(m.id, editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className={`p-4 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-xl backdrop-blur-md shadow-sm transition-all duration-300 ${expanded ? 'col-span-1 md:col-span-2 lg:col-span-3 row-span-2' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="text-[10px] text-[var(--accent-secondary)] font-mono tracking-tight font-normal bg-[var(--accent-secondary)]/10 px-2 py-0.5 rounded-full">
          {m.wing}/{m.room}/{m.hall}
        </div>
        <div className="flex space-x-1">
          <button onClick={() => setExpanded(!expanded)} className="text-[10px] px-2 py-1 bg-[var(--panel-border)] hover:bg-[var(--panel-border-hover)] rounded transition-colors text-[var(--text-muted)] font-normal cursor-pointer">
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button onClick={() => onDelete(m.id)} className="text-[10px] px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors font-normal cursor-pointer">
            Prune
          </button>
        </div>
      </div>
      
      <div className="mt-2 text-sm text-[var(--text-main)] overflow-hidden" style={{ maxHeight: expanded ? 'none' : '4.5rem' }}>
        {isEditing ? (
          <textarea
            autoFocus
            className="w-full bg-transparent border border-[var(--panel-border)] focus:border-[var(--accent-color)] rounded-md p-2 text-sm outline-none transition-colors font-normal"
            rows={expanded ? 6 : 3}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div 
            onClick={() => setIsEditing(true)}
            className="prose prose-sm prose-invert max-w-none prose-p:leading-snug prose-headings:text-[var(--text-main)] prose-a:text-[var(--accent-secondary)] cursor-pointer hover:bg-slate-500/5 p-1 rounded transition-colors font-normal"
            title="Click to edit inline"
          >
            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        )}
      </div>

      <div className="mt-4 pt-2 border-t border-[var(--panel-border)] flex justify-between items-center text-[10px] text-[var(--text-muted)]">
        <div>
          {m.agent_name ? <span className="font-normal text-[var(--text-main)]">{m.agent_name}</span> : 'legacy'}
          {m.harness_name && <span className="ml-1 opacity-70">({m.harness_name})</span>}
        </div>
        <div>{new Date(m.created_at).toLocaleDateString()}</div>
      </div>
    </div>
  );
};

export const DreamCorrection: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Debouncing search query input
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
      } else {
        showNotification('Server failed to update memory', 'error');
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
      } else {
        showNotification('Server failed to delete memory', 'error');
      }
    }
  });

  const compactMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/compaction', { method: 'POST' });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        showNotification('Compaction complete: duplicate memories resolved!', 'success');
        queryClient.invalidateQueries({ queryKey: ['memories'] });
      } else {
        showNotification('Server failed to run compaction', 'error');
      }
    }
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to permanently prune this memory fact?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="bg-[var(--panel-bg)] backdrop-blur-md border border-[var(--panel-border)] rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-normal text-[var(--text-main)]">Dream-Correction</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-normal">Review, correct, or prune your agent's long-term memory records.</p>
        </div>

        <button
          onClick={() => compactMutation.mutate()}
          disabled={compactMutation.isPending}
          className="px-4 py-2 bg-[var(--accent-color)] hover:opacity-90 text-white rounded-lg text-xs font-normal tracking-wide transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center space-x-2 cursor-pointer"
        >
          {compactMutation.isPending ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Dreaming...</span>
            </>
          ) : (
            <span>Run Memory Compaction</span>
          )}
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-xs font-normal border transition-all ${
          message.type === 'success' 
            ? 'bg-green-500/10 text-green-600 border-green-500/20' 
            : 'bg-red-500/10 text-red-600 border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Filter memories by content keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent border border-[var(--panel-border)] focus:border-[var(--accent-color)] outline-none px-4 py-2.5 rounded-lg text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] transition-colors font-normal"
        />
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center items-center space-x-2 text-[var(--text-muted)] font-normal">
          <div className="w-4 h-4 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm">Reading database records...</span>
        </div>
      ) : memories.length === 0 ? (
        <div className="py-10 text-center text-[var(--text-muted)] text-sm font-normal">
          No memories found. Stored facts will appear here once agents use the MCP tools.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
          {memories.map((m) => (
            <MemoryCard 
              key={m.id} 
              m={m} 
              onEdit={(id, content) => editMutation.mutate({ id, content })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
