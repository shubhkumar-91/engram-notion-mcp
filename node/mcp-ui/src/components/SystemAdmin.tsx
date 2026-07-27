import React, { useState, useEffect } from 'react';

interface SystemAdminProps {
  isAuthorized: boolean;
  onAuthorize: (safeWord: string) => boolean;
}

export function SystemAdmin({ isAuthorized, onAuthorize }: SystemAdminProps) {
  const [safeInput, setSafeInput] = useState('');
  const [authError, setAuthError] = useState(false);

  const [notionKey, setNotionKey] = useState('');
  const [pageId, setPageId] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [testResults, setTestResults] = useState<any | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  useEffect(() => {
    // Fetch initial notion status to prefill page_id or existing credentials
    fetch('/api/notion/status')
      .then(res => res.json())
      .then(data => {
        if (data.page_id) setPageId(data.page_id);
        if (data.api_key) setNotionKey(data.api_key);
      })
      .catch(() => {});
  }, []);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onAuthorize(safeInput);
    if (!ok) {
      setAuthError(true);
    } else {
      setAuthError(false);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/notion/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: notionKey, page_id: pageId })
      });
      const data = await res.json();
      setSaveStatus(data.message || 'Notion API credentials updated successfully!');
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (e: any) {
      setSaveStatus(`Failed to save credentials: ${e.message}`);
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/tests/run', { method: 'POST' });
      const data = await res.json();
      setTestResults(data);
    } catch (e: any) {
      setTestResults({ success: false, error: e.message });
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleSeedDatabase = async () => {
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      setSeedStatus(data.message || 'Database successfully seeded with mock entities and relations.');
      setTimeout(() => setSeedStatus(null), 4000);
    } catch (e: any) {
      setSeedStatus(`Failed to seed: ${e.message}`);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto my-12">
        <div className="glass-card rounded-2xl p-8 text-center space-y-5 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-xl font-mono font-bold border border-amber-500/20">
            🔒
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-main)]">System Admin Authenticator</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Enter the System Safe-Word (case-insensitive) to unlock elevated API credentials, test runner, and database management.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-mono text-[var(--text-muted)]">Safe-Word Verification (Case-Insensitive)</label>
              <input
                type="password"
                placeholder="Enter Safe-Word (Default: CITRUS)"
                value={safeInput}
                onChange={e => setSafeInput(e.target.value)}
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl glass-input outline-none focus:ring-2 focus:ring-[var(--accent-color)] text-[var(--text-main)] mt-1"
              />
              {authError && (
                <p className="text-[11px] text-rose-500 mt-1.5 font-medium">
                  Invalid Safe-Word. Default safe-word is <code className="font-mono bg-rose-100 dark:bg-rose-950 px-1 rounded">CITRUS</code> (case-insensitive).
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] text-white text-xs font-semibold shadow-md hover:opacity-90 transition-all"
            >
              Authenticate & Unlock Admin Mode
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Status Banner */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between border-emerald-500/30">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
          <div>
            <div className="text-xs font-semibold text-[var(--text-main)]">Admin Mode Authorized</div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono">Session Unlocked via Safe-Word 'CITRUS' (Case-Insensitive)</div>
          </div>
        </div>
        <button
          onClick={handleSeedDatabase}
          className="px-3.5 py-1.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-xs font-medium text-[var(--text-main)] hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
        >
          🌱 Seed Mock Database
        </button>
      </div>

      {seedStatus && (
        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-mono">
          {seedStatus}
        </div>
      )}

      {/* Notion API Credentials */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-bold font-mono text-[var(--text-main)] mb-1">Notion API Integration Guard</h3>
        <p className="text-xs text-[var(--text-muted)] mb-5">
          Configure your Notion Internal Integration Token and root Target Page ID to enable live Notion sync.
        </p>

        <form onSubmit={handleSaveCredentials} className="space-y-4">
          <div>
            <label className="text-xs font-mono text-[var(--text-main)] font-medium">NOTION_API_KEY</label>
            <input
              type="password"
              placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={notionKey}
              onChange={e => setNotionKey(e.target.value)}
              className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl glass-input outline-none focus:ring-2 focus:ring-[var(--accent-color)] text-[var(--text-main)] mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-[var(--text-main)] font-medium">NOTION_PAGE_ID</label>
            <input
              type="text"
              placeholder="e.g. 8f2a4b1c-9d0e-4f3a-8b1c-2d3e4f5a6b7c"
              value={pageId}
              onChange={e => setPageId(e.target.value)}
              className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl glass-input outline-none focus:ring-2 focus:ring-[var(--accent-color)] text-[var(--text-main)] mt-1"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[var(--accent-color)] text-white text-xs font-semibold shadow hover:opacity-90 transition-all"
            >
              Save API Configuration
            </button>
            {saveStatus && <span className="text-xs text-emerald-600 font-mono">{saveStatus}</span>}
          </div>
        </form>
      </div>

      {/* Test Suite Runner */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold font-mono text-[var(--text-main)]">Automated Test Suite Runner</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Run full unit test suite (Bun server tests & Notion block chunking validation).
            </p>
          </div>
          <button
            onClick={handleRunTests}
            disabled={isRunningTests}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] text-white text-xs font-semibold shadow hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isRunningTests ? 'Running Suite...' : '🧪 Execute Test Suite'}
          </button>
        </div>

        {testResults && (
          <div className="mt-4 p-4 bg-slate-950/90 rounded-xl font-mono text-xs text-slate-200 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-2">
              <span>{testResults.suite}</span>
              <span>{testResults.passed} / {testResults.total} PASSED ({testResults.durationMs}ms)</span>
            </div>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
              {testResults.cases?.map((c: any, i: number) => (
                <div key={i} className="flex justify-between text-[11px] leading-relaxed">
                  <span className="text-slate-300">✓ {c.name}</span>
                  <span className="text-emerald-400">{c.durationMs}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
