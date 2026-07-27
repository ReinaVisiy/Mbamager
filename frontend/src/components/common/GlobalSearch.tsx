import * as React from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  CreditCard,
  ArrowLeftRight,
  Target,
  Clock,
  Bell,
  Users,
  CornerDownLeft,
  Loader2
} from 'lucide-react';
import { searchService, SearchResultItem, SearchResultType } from '../../services/search';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEBOUNCE_MS = 250;

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounce the query before it ever reaches the network. This keeps
  // search fast and cheap: the server does one bounded, indexed query per
  // entity type instead of the client downloading entire collections and
  // filtering them locally.
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery('');
      return;
    }
    const timeout = setTimeout(() => setDebouncedQuery(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery),
    enabled: isOpen && debouncedQuery.length > 0,
    placeholderData: (previous) => previous,
  });

  const results = data?.results ?? [];
  // Show the spinner while the user is actively typing (debounce window)
  // as well as while the request itself is in flight.
  const isLoading = isFetching || (query.trim().length > 0 && query.trim() !== debouncedQuery);

  // Focus input when open
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Reset selection whenever the visible result set changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, debouncedQuery]);

  // Handle Keyboard Navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const handleSelect = (item: SearchResultItem) => {
    navigate(item.url);
    onClose();
  };

  const getIcon = (type: SearchResultType) => {
    switch (type) {
      case 'account': return <CreditCard className="w-4 h-4 text-sky-400" />;
      case 'transaction': return <ArrowLeftRight className="w-4 h-4 text-emerald-400" />;
      case 'goal': return <Target className="w-4 h-4 text-fuchsia-400" />;
      case 'recurring': return <Clock className="w-4 h-4 text-amber-400" />;
      case 'notification': return <Bell className="w-4 h-4 text-rose-400" />;
      case 'tontine': return <Users className="w-4 h-4 text-violet-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 cursor-pointer"
            aria-hidden="true"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Global search dialog"
          >
            {/* Input Bar */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search accounts, transactions, savings goals..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none w-full"
              />
              {isLoading && (
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
              )}
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-300 p-1.5 hover:bg-slate-800 rounded-xl cursor-pointer"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results Section */}
            <div className="max-h-[360px] overflow-y-auto p-3">
              {query.trim() === '' ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <Search className="w-8 h-8 text-slate-700 mx-auto mb-2.5" />
                  Type something to search across Mbamager OS...
                </div>
              ) : results.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {isLoading ? (
                    'Searching...'
                  ) : (
                    <>No matching items found for &ldquo;<span className="text-slate-300 font-semibold">{query}</span>&rdquo;</>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold text-slate-500 uppercase px-3 pb-1 tracking-wider">
                    Search Results ({results.length})
                  </div>
                  {results.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full flex items-center justify-between text-left p-3 rounded-2xl transition-colors cursor-pointer ${
                          isSelected ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/40 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl bg-slate-950/60 border border-slate-800`}>
                            {getIcon(item.type)}
                          </div>
                          <div>
                            <div className="text-xs font-bold line-clamp-1">{item.title}</div>
                            <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{item.subtitle}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pl-3">
                          {item.meta && (
                            <span className="text-xs font-mono text-slate-400 font-semibold">{item.meta}</span>
                          )}
                          {isSelected && (
                            <CornerDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Help footer */}
            <div className="bg-slate-950/60 px-5 py-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <div className="flex items-center gap-4">
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>esc close</span>
              </div>
              <span className="text-emerald-500/80">Mbamager Search Engine</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
