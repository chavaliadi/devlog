import React, { useEffect, useState } from 'react';
import { Calendar, GitCommit, Bookmark, Sparkles, Server } from 'lucide-react';

interface TimelineEvent {
  id: string;
  date: string;
  milestone: string;
  description: string;
  repository: string;
  sha: string;
  impact: string;
}

export const EngineeringTimeline: React.FC = () => {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = async () => {
    try {
      const res = await fetch('/api/repos/timeline');
      if (!res.ok) {
        throw new Error('Failed to load engineering timeline.');
      }
      const json = await res.json();
      if (json.success) {
        setTimeline(json.timeline);
      } else {
        throw new Error(json.error || 'Server error');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to communicate with server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-rose-500/20 text-center max-w-lg mx-auto my-8">
        <h3 className="text-lg font-bold text-rose-400 mb-2">Failed to Load Timeline</h3>
        <p className="text-xs text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            fetchTimeline();
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all"
        >
          Retry Load
        </button>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="glass-panel p-8 rounded-3xl border border-glass-border text-center max-w-lg mx-auto my-8">
        <GitCommit className="w-10 h-10 text-gray-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">No Milestones Found</h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          No architectural milestones detected from your commits. Milestones are automatically identified when commits introduce technologies like Redis, BullMQ, JWT, OAuth, or encryption security.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between pb-4 border-b border-glass-border">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            Engineering Timeline
            <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-2 py-0.5 rounded-full">
              {timeline.length} Milestones Detected
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Chronological progression of core system architecture, key files, and library integration.
          </p>
        </div>
      </div>

      {/* Timeline Tree */}
      <div className="relative border-l border-indigo-500/30 ml-4 md:ml-6 pl-6 md:pl-8 space-y-8 py-2">
        {timeline.map((event) => (
          <div key={event.id} className="relative group">
            
            {/* Timeline node dot */}
            <span className="absolute -left-[31px] md:-left-[39px] top-1.5 flex h-4 h-4 w-4 w-4 items-center justify-center rounded-full bg-indigo-600 ring-4 ring-[#030712] transition-all group-hover:scale-125 group-hover:bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>

            {/* Timeline Card */}
            <div className="glass-panel p-5 rounded-2xl border border-glass-border group-hover:border-indigo-500/30 transition-all duration-300 transform group-hover:translate-x-0.5 relative overflow-hidden">
              {/* Highlight background glow on hover */}
              <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/10 transition-all" />
              
              {/* Meta Header */}
              <div className="flex flex-wrap items-center gap-3 justify-between mb-3 text-xs text-gray-400">
                <div className="flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  {event.date}
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-gray-900/60 border border-gray-800 text-[10px] font-mono tracking-tight text-gray-400 flex items-center gap-1">
                    <Server className="w-3 h-3 text-gray-500" /> {event.repository.split('/')[1]}
                  </span>
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/30 border border-indigo-900/40 px-1.5 py-0.5 rounded">
                    sha:{event.sha}
                  </span>
                </div>
              </div>

              {/* Milestone Details */}
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5 group-hover:text-indigo-300 transition-colors">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                {event.milestone}
              </h3>
              
              <p className="text-xs text-gray-300 mt-2 leading-relaxed font-semibold">
                "{event.description}"
              </p>

              {/* Impact Box */}
              {event.impact && (
                <div className="mt-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 text-[11px] text-gray-400 flex items-start gap-2">
                  <Bookmark className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-indigo-300 text-xs">Architectural Impact:</span> {event.impact}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
