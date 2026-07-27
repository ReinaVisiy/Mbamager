import * as React from 'react';
import { Sun, Moon, Bell, LogOut, User as UserIcon, Search, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui/Button';

interface NavbarProps {
  onOpenSearch: () => void;
  onOpenMobileMenu?: () => void;
}

export function Navbar({ onOpenSearch, onOpenMobileMenu }: NavbarProps) {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { notifications } = useAppStore();
  
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="h-16 border-b border-slate-800/60 bg-slate-900 backdrop-blur px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 z-40 shadow-sm shrink-0">
      {/* Search Bar / Trigger button */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden shrink-0 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-slate-100 hover:border-gold/40 cursor-pointer transition-all duration-300"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-gold/40 text-slate-500 hover:text-slate-100 transition-all duration-300 text-xs font-medium cursor-pointer w-28 sm:w-48 md:w-64 justify-between min-w-0"
          title="Search anything (Cmd+K)"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] truncate hidden sm:inline">Search accounts, transactions...</span>
            <span className="text-[11px] sm:hidden">Search</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-900 rounded-md border border-slate-800 text-slate-500">
            ⌘K
          </kbd>
        </button>
        
        <span className="hidden md:inline-block text-[9px] font-mono text-gold font-bold bg-gold-50 border border-gold/20 dark:bg-gold-500/10 dark:border-gold/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
          Mbamager Premium OS
        </span>
      </div>

      {/* Toolbar / Actions */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Toggle Theme button */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-gold/40 text-slate-500 hover:text-gold-600 dark:hover:text-slate-100 cursor-pointer hover:bg-slate-800/60 transition-all duration-300"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-gold-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
        </button>

        {/* Notifications / Alerts center */}
        <div className="relative">
          <button
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-gold/40 text-slate-500 hover:text-gold-600 dark:hover:text-slate-100 cursor-pointer hover:bg-slate-800/60 transition-all duration-300"
            title="View Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* User profile dropdown and Logout */}
        <div className="flex items-center gap-2 sm:gap-3 border-l border-slate-800/80 pl-2 sm:pl-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-200">{user?.username || 'Guest'}</span>
            <span className="text-[9px] font-mono text-slate-500">{user?.phone_number || '+237'}</span>
          </div>
          
          <div className="p-2 rounded-xl bg-gradient-to-tr from-gold-500 to-gold-400 text-white font-extrabold shadow-sm shadow-gold-500/20">
            <UserIcon className="w-4 h-4 text-white" />
          </div>

          <button
            onClick={logout}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-500 hover:text-rose-500 hover:bg-rose-500/5 cursor-pointer transition-all duration-300"
            title="Log Out Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

