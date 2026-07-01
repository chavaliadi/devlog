import React from 'react';
import { LayoutDashboard, GitCommit, BookOpen, LogOut, Settings, Activity } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  user?: {
    username: string;
    avatarUrl: string | null;
    email: string | null;
  } | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, user, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'commits', label: 'Commits Feed', icon: GitCommit },
    { id: 'repositories', label: 'Repositories', icon: Settings },
    { id: 'health', label: 'System Status', icon: Activity },
    { id: 'portfolio', label: 'Recruiter Portfolio', icon: BookOpen },
  ];

  return (
    <aside className="w-64 glass-panel h-screen fixed left-0 top-0 flex flex-col justify-between py-6 px-4 z-20 border-r border-glass-border">
      <div>
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
            D
          </div>
          <span className="font-bold text-lg tracking-wide bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Devlog
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 border border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-gray-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Logout */}
      <div>
        {user && (
          <div className="border-t border-glass-border pt-4 px-2 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-8 h-8 rounded-full border border-glass-border"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-gray-200 truncate">{user.username}</span>
                <span className="text-[10px] text-gray-500 truncate">GitHub Connected</span>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="border-t border-glass-border pt-4 px-3 text-xs text-gray-500">
          <p className="font-semibold text-gray-400">Devlog MVP v1.0</p>
          <p className="mt-1">Auto-summarizing daily commits using Groq AI.</p>
        </div>
      </div>
    </aside>
  );
};

