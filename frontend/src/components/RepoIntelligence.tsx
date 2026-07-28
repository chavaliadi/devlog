import React, { useEffect, useState } from 'react';
import { Brain, Layers, GitFork, Cpu, Shield, Sparkles } from 'lucide-react';

interface RepoIntelligenceProps {
  // Option to pass initial data or fetch inside
}

interface IntelligenceData {
  languages: { [key: string]: number };
  skills: {
    backend: number;
    frontend: number;
    databases: number;
    security: number;
  };
  patterns: { name: string; description: string }[];
  metrics: {
    modules: number;
    apis: number;
    tables: number;
    queues: number;
    services: number;
  };
  evaluation: string;
}

interface RepoIntelligenceProps {
  showToast?: (type: 'success' | 'error', message: string) => void;
}

export const RepoIntelligence: React.FC<RepoIntelligenceProps> = ({ showToast }) => {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligence = async () => {
    try {
      const res = await fetch('/api/repos/intelligence');
      if (res.status === 401) {
        showToast?.('error', 'Session expired, please log in again.');
        throw new Error('Session expired, please log in again.');
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Something went wrong, please try again.');
      }
      const json = await res.json();
      if (json.success) {
        setData(json.intelligence);
      } else {
        throw new Error(json.error || 'Something went wrong, please try again.');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Something went wrong, please try again.';
      setError(msg);
      showToast?.('error', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-rose-500/20 text-center max-w-lg mx-auto my-8">
        <h3 className="text-lg font-bold text-rose-400 mb-2">Analysis Failed</h3>
        <p className="text-xs text-gray-400 mb-4">{error || 'Unable to retrieve intelligence data.'}</p>
        <button
          onClick={() => {
            setLoading(true);
            fetchIntelligence();
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Evaluation Card */}
      <div className="relative overflow-hidden glass-panel p-6 rounded-3xl border border-glass-border">
        {/* Glow accent */}
        <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl" />
        
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-lg shadow-indigo-500/5">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Developer Profile Assessment
              <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Generated
              </span>
            </h2>
            <p className="text-sm text-gray-300 mt-2 leading-relaxed italic">
              "{data.evaluation}"
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Skill Profile & Language Stats (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Skill Breakdown */}
          <div className="glass-panel p-6 rounded-3xl border border-glass-border">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" /> Skill Category Profile
            </h3>
            
            <div className="space-y-4">
              {/* Backend */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-gray-300">Backend Engineering</span>
                  <span className="text-indigo-400">{data.skills.backend}%</span>
                </div>
                <div className="w-full bg-gray-900/60 h-2.5 rounded-full overflow-hidden border border-gray-800/50">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                    style={{ width: `${data.skills.backend}%` }} 
                  />
                </div>
              </div>

              {/* Databases */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-gray-300">Databases & Caching</span>
                  <span className="text-violet-400">{data.skills.databases}%</span>
                </div>
                <div className="w-full bg-gray-900/60 h-2.5 rounded-full overflow-hidden border border-gray-800/50">
                  <div 
                    className="bg-violet-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(139,92,246,0.5)]" 
                    style={{ width: `${data.skills.databases}%` }} 
                  />
                </div>
              </div>

              {/* Security */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-gray-300">Security & Webhooks</span>
                  <span className="text-emerald-400">{data.skills.security}%</span>
                </div>
                <div className="w-full bg-gray-900/60 h-2.5 rounded-full overflow-hidden border border-gray-800/50">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                    style={{ width: `${data.skills.security}%` }} 
                  />
                </div>
              </div>

              {/* Frontend */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-gray-300">Frontend / UI Development</span>
                  <span className="text-amber-400">{data.skills.frontend}%</span>
                </div>
                <div className="w-full bg-gray-900/60 h-2.5 rounded-full overflow-hidden border border-gray-800/50">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                    style={{ width: `${data.skills.frontend}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Codebase Metrics */}
          <div className="glass-panel p-6 rounded-3xl border border-glass-border">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-violet-400" /> Inferred Codebase Metrics
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="glass-card p-4 rounded-2xl border border-glass-border text-center">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Backend Modules</p>
                <p className="text-2xl font-bold text-white mt-1.5">{data.metrics.modules}</p>
              </div>
              <div className="glass-card p-4 rounded-2xl border border-glass-border text-center">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">API Endpoints</p>
                <p className="text-2xl font-bold text-indigo-400 mt-1.5">{data.metrics.apis}</p>
              </div>
              <div className="glass-card p-4 rounded-2xl border border-glass-border text-center">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Prisma Models</p>
                <p className="text-2xl font-bold text-violet-400 mt-1.5">{data.metrics.tables}</p>
              </div>
              <div className="glass-card p-4 rounded-2xl border border-glass-border text-center">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">BullMQ Queues</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1.5">{data.metrics.queues}</p>
              </div>
              <div className="glass-card p-4 rounded-2xl border border-glass-border text-center col-span-2 md:col-span-1">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Services Integrations</p>
                <p className="text-2xl font-bold text-amber-400 mt-1.5">{data.metrics.services}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Language Split & Architectural Patterns (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Languages stats */}
          <div className="glass-panel p-6 rounded-3xl border border-glass-border">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <GitFork className="w-4 h-4 text-emerald-400" /> Language Distribution
            </h3>
            
            <div className="space-y-3.5">
              {Object.entries(data.languages).map(([lang, pct]) => {
                let colorClass = 'bg-indigo-500';
                if (lang === 'Python') colorClass = 'bg-blue-400';
                if (lang === 'Prisma SQL') colorClass = 'bg-emerald-400';
                if (lang === 'CSS') colorClass = 'bg-rose-400';
                if (lang === 'JavaScript') colorClass = 'bg-yellow-400';

                return (
                  <div key={lang}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-300">{lang}</span>
                      <span className="text-gray-400">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-900/60 h-2 rounded-full overflow-hidden border border-gray-800/40">
                      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Architectural Patterns */}
          <div className="glass-panel p-6 rounded-3xl border border-glass-border">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" /> Detected Architecture Patterns
            </h3>
            
            <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
              {data.patterns.map((pat, idx) => (
                <div key={idx} className="glass-card p-3.5 rounded-xl border border-glass-border">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    {pat.name}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                    {pat.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
