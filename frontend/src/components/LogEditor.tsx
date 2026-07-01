import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, ArrowLeft, Eye, GitBranch, Trash2, Sparkles } from 'lucide-react';

interface Commit {
  id: string;
  sha: string;
  repository: string;
  message: string;
  diffText: string | null;
  aiSummary: string | null;
  commitDate: string;
}

interface Entry {
  id: string;
  date: string;
  content: string;
  status: string;
  createdAt: string;
}

interface LogEditorProps {
  entry: Entry;
  commits: Commit[];
  onBack: () => void;
  onSave: (id: string, content: string, status: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

// A simple local Markdown parser to avoid external dependencies
const renderMarkdown = (markdown: string) => {
  if (!markdown) return '';

  const lines = markdown.split('\n');
  let inList = false;
  const htmlLines = lines.map((line) => {
    let cleanLine = line.trim();

    // Headers
    if (cleanLine.startsWith('## ')) {
      if (inList) { inList = false; return '</ul><h2 class="text-xl font-bold text-indigo-300 mt-6 mb-3 border-b border-gray-800 pb-1">' + cleanLine.substring(3) + '</h2>'; }
      return '<h2 class="text-xl font-bold text-indigo-300 mt-6 mb-3 border-b border-gray-800 pb-1">' + cleanLine.substring(3) + '</h2>';
    }
    if (cleanLine.startsWith('### ')) {
      if (inList) { inList = false; return '</ul><h3 class="text-lg font-bold text-gray-200 mt-4 mb-2">' + cleanLine.substring(4) + '</h3>'; }
      return '<h3 class="text-lg font-bold text-gray-200 mt-4 mb-2">' + cleanLine.substring(4) + '</h3>';
    }

    // Bullet Lists
    if (cleanLine.startsWith('* ') || cleanLine.startsWith('- ')) {
      const content = cleanLine.substring(2);
      let out = '';
      if (!inList) {
        inList = true;
        out += '<ul class="list-disc pl-5 space-y-2 text-gray-300 text-sm my-3">';
      }
      // Inline styles like bold, code
      const formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.*?)`/g, '<code class="bg-gray-800/80 px-1.5 py-0.5 rounded text-indigo-400 text-xs font-mono">$1</code>');
      
      out += '<li>' + formattedContent + '</li>';
      return out;
    }

    // Close list if we hit a non-list line
    let prefix = '';
    if (inList && cleanLine !== '') {
      inList = false;
      prefix = '</ul>';
    }

    if (cleanLine === '') {
      return prefix;
    }

    // Regular Paragraph with inline formatting
    const formattedParagraph = cleanLine
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-800/80 px-1.5 py-0.5 rounded text-indigo-400 text-xs font-mono">$1</code>');
    
    return prefix + '<p class="text-gray-300 text-sm leading-relaxed mb-4">' + formattedParagraph + '</p>';
  });

  if (inList) {
    htmlLines.push('</ul>');
  }

  return htmlLines.join('\n');
};

export const LogEditor: React.FC<LogEditorProps> = ({
  entry,
  commits,
  onBack,
  onSave,
  onDelete,
}) => {
  const [content, setContent] = useState(entry.content);
  const [status, setStatus] = useState(entry.status);
  const [isSaving, setIsSaving] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'commits'>('preview');
  const [selectedCommitDiff, setSelectedCommitDiff] = useState<string | null>(null);

  // Resume Bullets State
  const [isGeneratingBullets, setIsGeneratingBullets] = useState(false);
  const [resumeBullets, setResumeBullets] = useState<string | null>(null);
  const [showBulletsModal, setShowBulletsModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateBullets = async () => {
    setIsGeneratingBullets(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}/resume-bullets`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setResumeBullets(data.bullets);
        setShowBulletsModal(true);
      } else {
        alert(data.error || 'Failed to generate resume bullets.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect to bullet generator service.');
    } finally {
      setIsGeneratingBullets(false);
    }
  };

  const handleCopyBullets = () => {
    if (resumeBullets) {
      navigator.clipboard.writeText(resumeBullets);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    setContent(entry.content);
    setStatus(entry.status);
  }, [entry]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleAction = async (newStatus: string) => {
    setIsSaving(true);
    try {
      await onSave(entry.id, content, newStatus);
      setStatus(newStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (confirm('Are you sure you want to delete this summary entry?')) {
      setIsSaving(true);
      try {
        await onDelete(entry.id);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Editor Header */}
      <div className="flex items-center justify-between pb-4 border-b border-glass-border mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-800/50 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-white">
              Edit Log: {formatDate(entry.date)}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Customize and finalize your developer log.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}

          <button
            onClick={() => handleAction('draft')}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:bg-gray-800/60 border border-gray-700/50 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {isSaving && status === 'draft' ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            onClick={() => handleAction('published')}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/15 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            {isSaving && status === 'published' ? 'Publishing...' : 'Publish log'}
          </button>

          <button
            onClick={handleGenerateBullets}
            disabled={isGeneratingBullets || isSaving}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-800 text-indigo-400 hover:bg-gray-800/80 border border-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            {isGeneratingBullets ? 'Compiling Bullets...' : 'Resume Bullets'}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left Side: Markdown Textarea */}
        <div className="w-1/2 flex flex-col glass-panel rounded-2xl border border-glass-border overflow-hidden p-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Markdown Content Editor
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your devlog summary in markdown here..."
            className="w-full flex-1 bg-transparent resize-none outline-none text-gray-200 text-sm font-mono leading-relaxed border-none focus:ring-0"
          />
          <div className="text-xs text-gray-500 pt-2 border-t border-glass-border flex justify-between">
            <span>Character Count: {content.length}</span>
            <span>Status: <span className={status === 'published' ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>{status.toUpperCase()}</span></span>
          </div>
        </div>

        {/* Right Side: Tab panel (Preview / Commits) */}
        <div className="w-1/2 flex flex-col glass-panel rounded-2xl border border-glass-border overflow-hidden">
          {/* Right Tabs Header */}
          <div className="flex border-b border-glass-border px-4 py-2 bg-gray-900/20 justify-between items-center shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => { setActiveRightTab('preview'); setSelectedCommitDiff(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeRightTab === 'preview'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Live Preview
              </button>
              <button
                onClick={() => setActiveRightTab('commits')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeRightTab === 'commits'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Seeded Commits ({commits.length})
              </button>
            </div>
            {selectedCommitDiff && (
              <button
                onClick={() => setSelectedCommitDiff(null)}
                className="text-[10px] text-indigo-400 hover:underline"
              >
                ← Back to lists
              </button>
            )}
          </div>

          {/* Right Tab Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeRightTab === 'preview' ? (
              <div 
                className="prose prose-invert max-w-none text-gray-300"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            ) : (
              // Commits list or Specific diff details
              selectedCommitDiff ? (
                <div className="font-mono text-xs text-gray-300 whitespace-pre bg-gray-950/80 p-4 rounded-xl border border-glass-border">
                  {selectedCommitDiff}
                </div>
              ) : (
                <div className="space-y-4">
                  {commits.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      No matching commits were found for this calendar day.
                    </p>
                  ) : (
                    commits.map((commit) => (
                      <div
                        key={commit.id}
                        onClick={() => commit.diffText && setSelectedCommitDiff(commit.diffText)}
                        className={`p-4 rounded-xl border bg-gray-800/20 border-glass-border flex flex-col gap-2 transition-all ${
                          commit.diffText ? 'hover:border-indigo-500/20 cursor-pointer hover:bg-gray-800/40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 px-2 py-0.5 rounded">
                            {commit.sha.substring(0, 7)}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {commit.repository}
                          </span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">
                          {commit.message}
                        </p>
                        {commit.aiSummary && (
                          <div className="bg-indigo-600/5 border border-indigo-500/10 p-2.5 rounded-lg text-xs text-indigo-300 italic flex flex-col gap-1 mt-1">
                            <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-bold not-italic">AI Summary</span>
                            "{commit.aiSummary}"
                          </div>
                        )}
                        {commit.diffText && (
                          <span className="text-[10px] text-indigo-400/80 mt-1 flex items-center gap-1">
                            Click to view filtered git diff patches
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {showBulletsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full rounded-2xl border border-glass-border p-6 shadow-2xl relative animate-in fade-in duration-200">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Generated Resume Bullets
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              AI-generated software engineering bullet points from this daily log. Copy and paste them directly into your resume!
            </p>
            
            <div className="bg-gray-950/60 p-4 rounded-xl border border-glass-border font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto custom-scrollbar mb-4 select-text">
              {resumeBullets || 'No bullets generated.'}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCopyBullets}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer min-w-[120px]"
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
              <button
                onClick={() => setShowBulletsModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:bg-gray-800/60 border border-gray-700/50 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
