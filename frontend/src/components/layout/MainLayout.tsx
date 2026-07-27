import * as React from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { GlobalSearch } from '../common/GlobalSearch';
import { ToastContainer } from '../ui/Toast';
import { WifiOff, RefreshCcw } from 'lucide-react';

export function MainLayout() {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-gold-200 selection:text-gold-900">
      {/* Background ambient radial glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-slate-950 to-slate-950 pointer-events-none z-0" />

      {/* Sidebar navigation */}
      <Sidebar mobileOpen={isMobileMenuOpen} onCloseMobile={() => setIsMobileMenuOpen(false)} />

      {/* Main viewport area */}
      <div className="relative flex flex-col flex-1 h-full overflow-hidden z-10 min-w-0">
        {/* Network status banner */}
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-amber-500/10 border-b border-amber-500/20 text-amber-400 px-4 sm:px-8 py-2.5 text-xs font-medium flex items-center justify-between gap-4 backdrop-blur z-50 shrink-0"
              role="status"
            >
              <div className="flex items-center gap-2 min-w-0">
                <WifiOff className="w-4 h-4 animate-pulse text-amber-500 shrink-0" />
                <span className="truncate">Operating offline. Restored changes will synchronize once the network reconnects.</span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="shrink-0 flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCcw className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">Retry connection</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <Navbar onOpenSearch={() => setIsSearchOpen(true)} onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

        {/* Content canvas with custom animated page transition entry */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="max-w-6xl mx-auto h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

