import React, { useState } from 'react';
import { Search, Sparkles, AlertCircle, FileText, ArrowRight, HelpCircle } from 'lucide-react';

interface Entry {
  id: string;
  date: string;
  content: string;
  status: string;
  createdAt: string;
}

interface SearchResult extends Entry {
  relevanceScore: number;
  matchReason: string;
}

interface SemanticSearchProps {
  onSelectEntry: (id: string) => void;
  showToast?: (type: 'success' | 'error', message: string) => void;
}

export const SemanticSearch: React.FC<SemanticSearchProps> = ({ onSelectEntry, showToast }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const sampleQueries = [
    'redis queue processing',
    'webhook verification security',
    'database schema and indexes',
    'authentication token encryption',
  ];

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/entries/search?query=${encodeURIComponent(searchQuery)}`);
      if (res.status === 401) {
        showToast?.('error', 'Session expired, please log in again.');
        throw new Error('Session expired, please log in again.');
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Something went wrong during search, please try again.');
      }
      const json = await res.json();
      if (json.success) {
        setResults(json.results || []);
      } else {
        throw new Error(json.error || 'Something went wrong, please try again.');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Something went wrong, please try again.';
      setError(msg);
      showToast?.('error', msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          Semantic Search Console
          <span className="text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-300 animate-pulse" /> LLM-Powered
          </span>
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Query your developer journals by technology concepts, features, or design patterns rather than raw matching keywords.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="glass-panel p-6 rounded-3xl border border-glass-border space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(query);
          }}
          className="flex gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="e.g. 'caching layer' or 'webhook signature verification'..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-gray-900/60 border border-glass-border hover:border-gray-700 focus:border-indigo-500 rounded-xl py-3 pl-12 pr-4 text-sm text-gray-200 focus:outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white font-semibold px-6 rounded-xl text-sm transition-all duration-200 shadow-md shadow-indigo-600/10 cursor-pointer flex items-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              'Search'
            )}
          </button>
        </form>

        {/* Suggestion pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500 flex items-center gap-1 pr-1">
            <HelpCircle className="w-3.5 h-3.5" /> Try asking:
          </span>
          {sampleQueries.map((q) => (
            <button
              key={q}
              onClick={() => handleSearch(q)}
              className="px-3 py-1.5 rounded-full bg-gray-800/40 hover:bg-gray-800 border border-gray-700/30 text-gray-400 hover:text-indigo-400 transition-all cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Results Display */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="glass-panel p-6 rounded-2xl border border-rose-500/20 text-center text-rose-400">
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : hasSearched && results.length === 0 ? (
          <div className="glass-panel p-12 rounded-3xl border border-glass-border text-center">
            <AlertCircle className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-300">No Semantic Matches</h3>
            <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
              No entries matched your query with high relevance. Try checking if daily entries are generated, or refine your query description.
            </p>
          </div>
        ) : (
          results.map((result) => (
            <div
              key={result.id}
              onClick={() => onSelectEntry(result.id)}
              className="glass-panel p-6 rounded-2xl border border-glass-border hover:border-indigo-500/30 transition-all duration-300 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group relative overflow-hidden"
            >
              {/* Relevance background glow */}
              <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/10 transition-all" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-200">
                    {formatDate(result.date)}
                  </span>
                  
                  {/* Relevance Score Badge */}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/25 text-indigo-400">
                    {result.relevanceScore}/10 Relevance
                  </span>
                </div>

                <div className="mt-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 text-xs text-gray-400 leading-relaxed flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <span className="font-bold text-indigo-300">Relevance Reasoning:</span> {result.matchReason}
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-3 line-clamp-2 leading-relaxed">
                  {result.content.replace(/[#*`_-]/g, '').trim().substring(0, 200)}...
                </p>
              </div>

              <div className="flex items-center justify-end shrink-0">
                <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-400 bg-gray-800/40 border border-gray-700/20 group-hover:border-indigo-500/30 group-hover:text-indigo-400 px-3.5 py-2 rounded-xl transition-all duration-200">
                  <FileText className="w-3.5 h-3.5" />
                  View Log
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
