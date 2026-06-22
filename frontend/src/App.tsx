import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Stats } from './components/Stats';
import { LogTimeline } from './components/LogTimeline';
import { LogEditor } from './components/LogEditor';
import { CommitList } from './components/CommitList';
import { PublicPortfolio } from './components/PublicPortfolio';
import { Sparkles, RefreshCw, XCircle, CheckCircle2 } from 'lucide-react';

const Github = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface Entry {
  id: string;
  date: string;
  content: string;
  status: string;
  createdAt: string;
}

interface Commit {
  id: string;
  sha: string;
  repository: string;
  message: string;
  diffText: string | null;
  commitDate: string;
}

interface UserProfile {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Automatically show toast and hide after 4 seconds
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const checkSession = async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        setUser(meData.user);
        setIsAuthenticated(true);
        // Load operational dashboard data scope to the authenticated user
        await fetchData();
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
      }
    } catch (e: any) {
      console.error('Auth verification failed:', e.message);
      setIsAuthenticated(false);
      setUser(null);
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      // 1. Fetch entries
      const entriesRes = await fetch('/api/entries');
      if (entriesRes.ok) {
        const entriesData = await entriesRes.json();
        setEntries(entriesData.entries || []);
      }

      // 2. Fetch commits
      const commitsRes = await fetch('/api/commits');
      if (commitsRes.ok) {
        const commitsData = await commitsRes.json();
        setCommits(commitsData.commits || []);
      }
    } catch (e: any) {
      console.error('Failed to fetch data:', e.message);
      showToast('error', 'Failed to communicate with backend database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleTriggerSummary = async () => {
    setIsCompiling(true);
    try {
      const res = await fetch('/api/entries/trigger-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      showToast('success', 'AI Daily Summary successfully generated!');
      await fetchData(); // Refresh local list

      // Navigate to the editor for this new entry immediately
      if (data.entryId) {
        setSelectedEntryId(data.entryId);
      }
    } catch (e: any) {
      console.error(e);
      showToast('error', e.message || 'No commits found for today or API key invalid.');
    } finally {
      setIsCompiling(false);
    }
  };

  const handleSaveEntry = async (id: string, content: string, status: string) => {
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, status }),
      });

      if (!res.ok) {
        throw new Error('Failed to update entry.');
      }

      showToast('success', status === 'published' ? 'Entry published successfully!' : 'Draft saved successfully.');
      await fetchData(); // Refresh data
    } catch (e: any) {
      console.error(e);
      showToast('error', e.message || 'Failed to update entry.');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete entry.');
      }

      showToast('success', 'Entry deleted successfully.');
      setSelectedEntryId(null);
      await fetchData();
    } catch (e: any) {
      console.error(e);
      showToast('error', e.message || 'Failed to delete entry.');
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setIsAuthenticated(false);
        setUser(null);
        setEntries([]);
        setCommits([]);
        showToast('success', 'Logged out successfully.');
      } else {
        throw new Error('Logout failed on backend.');
      }
    } catch (e: any) {
      console.error(e);
      showToast('error', 'Failed to logout correctly.');
    }
  };

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    setSelectedEntryId(null); // Clear selected editor if switching tabs
  };

  // Derive stats numbers
  const totalCommits = commits.length;
  const totalEntries = entries.length;
  const draftsCount = entries.filter(e => e.status === 'draft').length;
  const publishedCount = entries.filter(e => e.status === 'published').length;

  const selectedEntry = entries.find(e => e.id === selectedEntryId);
  
  // Filter commits corresponding to the selected entry's day (YYYY-MM-DD)
  const getCommitsForSelectedEntry = () => {
    if (!selectedEntry) return [];
    const entryDateStr = new Date(selectedEntry.date).toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [m, d, y] = entryDateStr.split('/');
    const formattedEntryDate = `${y}-${m}-${d}`;

    return commits.filter(commit => {
      const commitDateStr = new Date(commit.commitDate).toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const [cm, cd, cy] = commitDateStr.split('/');
      const formattedCommitDate = `${cy}-${cm}-${cd}`;
      return formattedCommitDate === formattedEntryDate;
    });
  };

  // Global loader when checking initial session state
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen bg-[#030712] justify-center items-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Premium Login Screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-[#030712] items-center justify-center p-4">
        {/* Toast Alert */}
        {toast && (
          <div className="fixed top-6 right-6 z-50 animate-bounce">
            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border shadow-lg glass-panel ${
              toast.type === 'success' ? 'border-emerald-500/30 text-emerald-400' : 'border-rose-500/30 text-rose-400'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <span className="text-sm font-semibold">{toast.message}</span>
            </div>
          </div>
        )}
        
        <div className="relative w-full max-w-md">
          {/* Background glow accent */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500 to-purple-600 opacity-25 blur-2xl filter" />
          
          <div className="relative glass-panel p-8 rounded-3xl border border-glass-border flex flex-col items-center text-center">
            {/* Logo Icon */}
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center font-extrabold text-white text-2xl shadow-lg shadow-indigo-500/20 mb-6">
              D
            </div>
            
            <h2 className="text-2xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Welcome to Devlog
            </h2>
            
            <p className="text-xs text-gray-400 mt-2 mb-8 leading-relaxed max-w-xs">
              Directly convert your daily Git commit history and code diffs into clean, recruiters-oriented portfolio logs.
            </p>

            <a
              href="/api/auth/github"
              className="w-full bg-[#1f2937] hover:bg-gray-800/80 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-3 border border-gray-700/50 hover:border-gray-600 transition-all duration-200 transform hover:scale-[1.01] cursor-pointer shadow-md"
            >
              <Github className="w-5 h-5 text-gray-100" />
              <span>Connect with GitHub</span>
            </a>
            
            <div className="mt-8 text-[11px] text-gray-500 max-w-[280px]">
              Access token usage is limited to repository log read actions. Credentials are fully encrypted.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#030712]">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Panel Content Area */}
      <main className="flex-1 ml-64 p-8 relative">
        {/* Toast Alert */}
        {toast && (
          <div className="fixed top-6 right-6 z-50 animate-bounce">
            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border shadow-lg glass-panel ${
              toast.type === 'success' ? 'border-emerald-500/30 text-emerald-400' : 'border-rose-500/30 text-rose-400'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <span className="text-sm font-semibold">{toast.message}</span>
            </div>
          </div>
        )}

        {/* Global Loading Overlay */}
        {isCompiling && (
          <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
            <div className="glass-panel p-8 rounded-3xl border border-glass-border max-w-sm text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 animate-spin border-2 border-indigo-500 border-t-transparent" />
              <h3 className="text-lg font-bold text-white mt-2">Compiling Devlog Summary...</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Groq AI is analyzing your daily commit logs and code diff patches to structure a professional developer log entry.
              </p>
            </div>
          </div>
        )}

        {/* Top Header */}
        <header className="flex justify-between items-center pb-6 border-b border-glass-border mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Devlog Dashboard
              <span className="text-xs font-semibold bg-indigo-600/10 text-indigo-400 border border-indigo-500/15 px-2 py-0.5 rounded-full">
                Developer MVP
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Automated portfolio devlog compiled directly from Git commit history.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-2.5 rounded-xl border border-glass-border text-gray-400 hover:text-white hover:bg-gray-800/40 transition-all cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleTriggerSummary}
              disabled={isCompiling}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/10 cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-indigo-200" />
              Trigger Today's Summary
            </button>
          </div>
        </header>

        {/* Dynamic Navigation Views */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : selectedEntryId && selectedEntry ? (
          /* Editor Tab View */
          <LogEditor
            entry={selectedEntry}
            commits={getCommitsForSelectedEntry()}
            onBack={() => setSelectedEntryId(null)}
            onSave={handleSaveEntry}
            onDelete={handleDeleteEntry}
          />
        ) : currentTab === 'dashboard' ? (
          /* Main Dashboard View */
          <div className="space-y-6">
            <Stats
              totalCommits={totalCommits}
              totalEntries={totalEntries}
              draftsCount={draftsCount}
              publishedCount={publishedCount}
            />
            <LogTimeline
              entries={entries}
              onSelectEntry={(id) => setSelectedEntryId(id)}
            />
          </div>
        ) : currentTab === 'commits' ? (
          /* Commits Feed Tab View */
          <CommitList commits={commits} />
        ) : (
          /* Public Share Mode Tab View */
          <PublicPortfolio entries={entries} user={user} />
        )}
      </main>
    </div>
  );
}

export default App;

