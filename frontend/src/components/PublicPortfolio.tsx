import React, { useState } from 'react';
import { BookOpen, User, Mail, Calendar, Eye, FileText, ArrowLeft } from 'lucide-react';

interface Entry {
  id: string;
  date: string;
  content: string;
  status: string;
  createdAt: string;
}

interface UserProfile {
  username: string;
  email: string | null;
  avatarUrl: string | null;
}

interface PublicPortfolioProps {
  entries: Entry[];
  user: UserProfile | null;
}

// Reuse the Markdown parser
const renderMarkdown = (markdown: string) => {
  if (!markdown) return '';

  const lines = markdown.split('\n');
  let inList = false;
  const htmlLines = lines.map((line) => {
    let cleanLine = line.trim();

    if (cleanLine.startsWith('## ')) {
      if (inList) { inList = false; return '</ul><h2 class="text-lg font-bold text-indigo-400 mt-6 mb-3 border-b border-gray-800 pb-1">' + cleanLine.substring(3) + '</h2>'; }
      return '<h2 class="text-lg font-bold text-indigo-400 mt-6 mb-3 border-b border-gray-800 pb-1">' + cleanLine.substring(3) + '</h2>';
    }
    if (cleanLine.startsWith('### ')) {
      if (inList) { inList = false; return '</ul><h3 class="text-md font-bold text-gray-200 mt-4 mb-2">' + cleanLine.substring(4) + '</h3>'; }
      return '<h3 class="text-md font-bold text-gray-200 mt-4 mb-2">' + cleanLine.substring(4) + '</h3>';
    }

    if (cleanLine.startsWith('* ') || cleanLine.startsWith('- ')) {
      const content = cleanLine.substring(2);
      let out = '';
      if (!inList) {
        inList = true;
        out += '<ul class="list-disc pl-5 space-y-2 text-gray-300 text-sm my-3">';
      }
      const formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.*?)`/g, '<code class="bg-gray-800/80 px-1.5 py-0.5 rounded text-indigo-400 text-xs font-mono">$1</code>');
      
      out += '<li>' + formattedContent + '</li>';
      return out;
    }

    let prefix = '';
    if (inList && cleanLine !== '') {
      inList = false;
      prefix = '</ul>';
    }

    if (cleanLine === '') {
      return prefix;
    }

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

export const PublicPortfolio: React.FC<PublicPortfolioProps> = ({ entries, user }) => {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  // Filter only published entries
  const publishedEntries = entries.filter((e) => e.status === 'published');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTeaser = (markdown: string) => {
    const cleanText = markdown.replace(/[#*`_-]/g, '').trim();
    return cleanText.substring(0, 160) + (cleanText.length > 160 ? '...' : '');
  };

  if (selectedEntry) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => setSelectedEntry(null)}
          className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer bg-gray-900/40 px-3 py-1.5 border border-glass-border rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Portfolio
        </button>

        <div className="glass-panel p-8 rounded-3xl border border-glass-border">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            {formatDate(selectedEntry.date)}
          </div>
          <h1 className="text-2xl font-bold text-white mb-6 tracking-tight">
            Developer Log — {new Date(selectedEntry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </h1>
          <div
            className="prose prose-invert max-w-none text-gray-300"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedEntry.content) }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Portfolio User Profile Header */}
      <div className="glass-panel p-6 rounded-3xl border border-glass-border flex flex-col md:flex-row items-center gap-6">
        <div className="relative">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-20 h-20 rounded-2xl border-2 border-indigo-500/20 object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <User className="w-10 h-10" />
            </div>
          )}
        </div>

        <div className="flex-1 text-center md:text-left">
          <h1 className="text-xl font-bold text-white tracking-tight">
            @{user?.username || 'developer'}
          </h1>
          <p className="text-xs text-indigo-400 font-medium mt-1 uppercase tracking-wider flex items-center justify-center md:justify-start gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Developer Progress Log
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-3 text-xs text-gray-400">
            {user?.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-500" />
                {user.email}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              {publishedEntries.length} Published Entries
            </span>
          </div>
        </div>
      </div>

      {/* Published Entries Timeline */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider pl-2">
          Published Entries
        </h2>

        {publishedEntries.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-3xl border border-glass-border">
            <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-400">No Public Entries</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
              This developer hasn't published any entries to their portfolio yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {publishedEntries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className="glass-card p-6 rounded-2xl cursor-pointer flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400/80" />
                    {formatDate(entry.date)}
                  </div>
                  <span className="text-[10px] text-indigo-400 flex items-center gap-1 hover:underline">
                    <Eye className="w-3 h-3" />
                    Read Log
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-100 group-hover:text-indigo-400 transition-colors">
                  Journal Entry for {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </h3>
                <p className="text-sm text-gray-400 line-clamp-2">
                  {getTeaser(entry.content)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
