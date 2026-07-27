import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { 
  Sparkles, 
  Send, 
  RefreshCcw, 
  Search, 
  Filter, 
  AlertTriangle, 
  TrendingUp, 
  Wallet, 
  Percent, 
  ArrowUpRight, 
  ChevronRight, 
  Calendar, 
  User, 
  Bot, 
  Info, 
  Check, 
  MessageSquare, 
  Lock, 
  Eye, 
  ArrowDownLeft, 
  Activity, 
  Sparkle,
  XCircle
} from 'lucide-react';

import { PageHeader } from '../components/common/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ErrorState } from '../components/common/ErrorState';
import { Skeleton } from '../components/ui/SkeletonLoader';
import { dashboardService } from '../services/dashboard';
import { transactionsService } from '../services/transactions';
import { assistantService } from '../services/assistant';
import { formatXAF, formatDate } from '../utils/format';
import { Transaction } from '../types';

// Friendly labels for backend categories
export const CATEGORY_LABELS: Record<string, string> = {
  INCOME_SALARY: 'Salary / Income',
  INCOME_BUSINESS: 'Business Revenues',
  INCOME_REMITTANCE: 'Remittance Inflow',
  EXPENSE_FOOD: 'Food & Groceries',
  EXPENSE_UTILITIES: 'Utilities & Bills',
  EXPENSE_HEALTH: 'Health & Medical',
  EXPENSE_EDUCATION: 'Education / Tuition',
  EXPENSE_TRANSPORT: 'Transport & Fuel',
  EXPENSE_COMMISSION: 'Transaction Fees / Commissions',
  SAVINGS: 'Savings Archive',
  INVESTMENT: 'Investments / Njangi',
};

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function Ai() {
  const queryClient = useQueryClient();
  
  // Tab control: "insights" | "assistant" | "transactions" | "recommendations"
  const [activeTab, setActiveTab] = React.useState<'insights' | 'assistant' | 'transactions' | 'recommendations'>('insights');

  // --- 1. Queries ---
  // AI-powered dashboard insights and budget recommendations
  const { 
    data: insights, 
    isLoading: isInsightsLoading, 
    isError: isInsightsError,
    refetch: refetchInsights,
    isRefetching: isInsightsRefetching
  } = useQuery({
    queryKey: ['aiInsights'],
    queryFn: () => dashboardService.getInsights(),
  });

  // Summary statistics for financial calculations (income, expenses, goals, etc.)
  const { 
    data: summary,
    isLoading: isSummaryLoading
  } = useQuery({
    queryKey: ['aiSummary'],
    queryFn: () => dashboardService.getSummary(),
  });

  // Fetch full transaction history
  const { 
    data: transactions, 
    isLoading: isTransactionsLoading, 
    isError: isTransactionsError,
    refetch: refetchTransactions
  } = useQuery({
    queryKey: ['aiTransactions'],
    queryFn: () => transactionsService.getAll(),
  });

  // --- 2. Recalculate Insights Trigger ---
  const handleRecalculate = async () => {
    await Promise.all([
      refetchInsights(),
      refetchTransactions()
    ]);
  };

  // --- 3. Section 1: AI Financial Assistant (Chat) ---
  const [chatInput, setChatInput] = React.useState('');
  const [messages, setMessages] = React.useState<Message[]>(() => {
    const saved = sessionStorage.getItem('mbamager_ai_chat');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved chat session', e);
      }
    }
    return [
      {
        id: 'welcome',
        sender: 'assistant',
        content: "Hello! I am your **AI Financial Assistant**. I've analyzed your MTN MoMo/Orange Money accounts, budgets, and savings landmarks.\n\nAsk me anything about your finances, or use one of the suggested prompts below to get started!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  
  const [isTyping, setIsTyping] = React.useState(false);
  const [chatSearchQuery, setChatSearchQuery] = React.useState('');
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Persist chat session locally
  React.useEffect(() => {
    sessionStorage.setItem('mbamager_ai_chat', JSON.stringify(messages));
  }, [messages]);

  // Handle suggested prompt clicks
  const handleSuggestedPrompt = (promptText: string) => {
    sendMessage(promptText);
  };

  // Message Sender: delegates language generation to the real GUIDE backend
  // (POST /assistant/chat), which grounds its reply in the user's actual
  // transactions and budgets fetched server-side. No local mock logic.
  const chatMutation = useMutation({
    mutationFn: (payload: { message: string; history: Message[] }) =>
      assistantService.chat({
        message: payload.message,
        conversation_history: payload.history.slice(-10).map(m => ({
          sender: m.sender,
          content: m.content,
        })),
      }),
  });

  const sendMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const historyForRequest = messages;
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    chatMutation.mutate(
      { message: textToSend, history: historyForRequest },
      {
        onSuccess: (data) => {
          const assistantMsg: Message = {
            id: `msg-${Date.now()}-assistant`,
            sender: 'assistant',
            content: data.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, assistantMsg]);
          setIsTyping(false);
        },
        onError: () => {
          const errorMsg: Message = {
            id: `msg-${Date.now()}-assistant`,
            sender: 'assistant',
            content: "I couldn't reach the assistant service just now. Please check your connection and try again.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, errorMsg]);
          setIsTyping(false);
        },
      }
    );
  };

  // Filter messages in current chat history
  const filteredMessages = React.useMemo(() => {
    if (!chatSearchQuery.trim()) return messages;
    return messages.filter(msg => msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase()));
  }, [messages, chatSearchQuery]);

  const handleClearChat = () => {
    const clearWelcome: Message[] = [
      {
        id: 'welcome',
        sender: 'assistant',
        content: "Chat cleared! Ask me anything about your finances, or use one of the suggested prompts to get started.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    setMessages(clearWelcome);
    sessionStorage.setItem('mbamager_ai_chat', JSON.stringify(clearWelcome));
  };

  // --- 4. Section 3: Transaction Intelligence (Ledger AI Explainer) ---
  const [txSearchQuery, setTxSearchQuery] = React.useState('');
  const [txCategoryFilter, setTxCategoryFilter] = React.useState('all');
  const [txConfidenceFilter, setTxConfidenceFilter] = React.useState('all');
  const [txDateFilter, setTxDateFilter] = React.useState('all');
  
  // Selected Transaction for AI Panel Modal
  const [selectedTxId, setSelectedTxId] = React.useState<number | null>(null);

  // Dynamic lists for filters
  const uniqueCategories = React.useMemo(() => {
    if (!transactions) return [];
    const cats = new Set<string>();
    transactions.forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats);
  }, [transactions]);

  // Client-side filtering logic
  const filteredTransactions = React.useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => {
      // Search Match
      const searchMatch = !txSearchQuery || 
        (tx.narrative || '').toLowerCase().includes(txSearchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(txSearchQuery.toLowerCase()) ||
        (CATEGORY_LABELS[tx.category] || '').toLowerCase().includes(txSearchQuery.toLowerCase());
      
      // Category Match
      const categoryMatch = txCategoryFilter === 'all' || tx.category === txCategoryFilter;
      
      // Confidence Match
      let confidenceMatch = true;
      if (txConfidenceFilter !== 'all') {
        const conf = tx.ai_confidence !== undefined && tx.ai_confidence !== null ? Number(tx.ai_confidence) : 0;
        if (txConfidenceFilter === 'high') {
          confidenceMatch = conf >= 0.8;
        } else if (txConfidenceFilter === 'medium') {
          confidenceMatch = conf >= 0.5 && conf < 0.8;
        } else if (txConfidenceFilter === 'low') {
          confidenceMatch = conf < 0.5;
        }
      }
      
      // Date Match
      let dateMatch = true;
      if (txDateFilter !== 'all') {
        if (!tx.timestamp) {
          dateMatch = false;
        } else {
          const txDate = new Date(tx.timestamp);
          const today = new Date();
          today.setHours(0,0,0,0);
          if (txDateFilter === 'today') {
            dateMatch = txDate >= today;
          } else if (txDateFilter === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateMatch = txDate >= weekAgo;
          } else if (txDateFilter === 'month') {
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateMatch = txDate >= monthAgo;
          } else if (txDateFilter === 'year') {
            const yearAgo = new Date();
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            dateMatch = txDate >= yearAgo;
          }
        }
      }
      
      return searchMatch && categoryMatch && confidenceMatch && dateMatch;
    });
  }, [transactions, txSearchQuery, txCategoryFilter, txConfidenceFilter, txDateFilter]);

  // Retrieve selected transaction object details
  const selectedTx = React.useMemo(() => {
    if (selectedTxId === null || !transactions) return null;
    return transactions.find(t => t.id === selectedTxId) || null;
  }, [selectedTxId, transactions]);

  // AI Explanation Query (fetches when active and transaction selected)
  const { 
    data: txExplanation, 
    isLoading: isTxExplainLoading, 
    isError: isTxExplainError,
    refetch: refetchExplanation
  } = useQuery({
    queryKey: ['transactionExplain', selectedTxId],
    queryFn: () => transactionsService.explain(selectedTxId!),
    enabled: selectedTxId !== null,
  });

  // AI Reclassification Mutation (manual preview trigger)
  const [reclassifyPreview, setReclassifyPreview] = React.useState<{predicted_category: string, confidence: number} | null>(null);
  
  const reclassifyMutation = useMutation({
    mutationFn: (txId: number) => transactionsService.reclassify(txId),
    onSuccess: (data) => {
      setReclassifyPreview(data);
    },
    onError: (err) => {
      console.error('Failed to trigger manual reclassification', err);
    }
  });

  // Save manual reclassified category to ledger database
  const applyReclassificationMutation = useMutation({
    mutationFn: ({ txId, category }: { txId: number, category: string }) => 
      transactionsService.update(txId, { category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['aiInsights'] });
      // Reset modal state
      setSelectedTxId(null);
      setReclassifyPreview(null);
    },
    onError: (err) => {
      console.error('Failed to update ledger category', err);
    }
  });

  const handleOpenTxExplain = (id: number) => {
    setSelectedTxId(id);
    setReclassifyPreview(null);
  };

  const handleCloseTxExplain = () => {
    setSelectedTxId(null);
    setReclassifyPreview(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Frame */}
      <PageHeader
        title="Financial Intelligence Center"
        description="Google Gemini-powered autonomous assistant, transaction reclassification matrix, and personalized micro-savings models."
        action={
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleRecalculate} 
            disabled={isInsightsLoading || isInsightsRefetching}
            className="gap-2 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${(isInsightsLoading || isInsightsRefetching) ? 'animate-spin' : ''}`} />
            {isInsightsRefetching ? 'Recalculating...' : 'Recalculate Insights'}
          </Button>
        }
      />

      {/* 2. Primary Navigation Tabs */}
      <div className="flex border-b border-slate-800 scrollbar-none overflow-x-auto">
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-semibold text-xs tracking-wide uppercase cursor-pointer transition-all ${
            activeTab === 'insights'
              ? 'border-gold text-gold font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Financial Insights
        </button>
        <button
          onClick={() => setActiveTab('assistant')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-semibold text-xs tracking-wide uppercase cursor-pointer transition-all ${
            activeTab === 'assistant'
              ? 'border-gold text-gold font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          AI Assistant
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-semibold text-xs tracking-wide uppercase cursor-pointer transition-all ${
            activeTab === 'transactions'
              ? 'border-gold text-gold font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          Transaction Intelligence
        </button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-semibold text-xs tracking-wide uppercase cursor-pointer transition-all ${
            activeTab === 'recommendations'
              ? 'border-gold text-gold font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
          }`}
        >
          <Info className="w-4 h-4" />
          Smart Recommendations
        </button>
      </div>

      {/* --- CONTENT AREA PANELS --- */}
      <AnimatePresence mode="wait">
        {/* SECTION 1: FINANCIAL INSIGHTS */}
        {activeTab === 'insights' && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {isInsightsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <Card key={idx} className="border-slate-800 bg-slate-900/50">
                    <CardHeader className="space-y-2">
                      <Skeleton className="h-4 w-1/3 bg-slate-800 rounded" />
                      <Skeleton className="h-3 w-1/2 bg-slate-800 rounded" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-12 w-full bg-slate-800 rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : isInsightsError ? (
              <ErrorState 
                title="Failed to Load AI Insights" 
                message="Your portfolio summary could not be analyzed. Please check your network connection or configure additional transactions." 
              />
            ) : !insights ? (
              <Card className="border-slate-800 p-8 text-center bg-slate-900/50">
                <p className="text-sm text-slate-500">No insights available. Ensure you have registered accounts with valid transactions.</p>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Insights Summary Bento-grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Largest Expense Card */}
                  <Card className="border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-colors duration-300 shadow-xl rounded-3xl">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-rose-400 tracking-wider uppercase bg-rose-500/10 px-2.5 py-1 rounded-full">Largest Outflow</span>
                        <ArrowUpRight className="w-4 h-4 text-rose-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="text-xs text-slate-400 uppercase font-medium">Narrative / Target</div>
                        <div className="text-lg font-bold text-slate-100 truncate mt-1">
                          {insights.largest_expense?.narrative || 'No expenses logged'}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-800/50">
                        <span className="text-2xl font-black text-rose-400">
                          {formatXAF(insights.largest_expense?.amount || 0)}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">FCFA</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Spending Category Card */}
                  <Card className="border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-colors duration-300 shadow-xl rounded-3xl">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase bg-emerald-500/10 px-2.5 py-1 rounded-full">Top Category</span>
                        <Percent className="w-4 h-4 text-emerald-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="text-xs text-slate-400 uppercase font-medium">Category</div>
                        <div className="text-lg font-bold text-slate-100 truncate mt-1">
                          {insights.top_spending_categories?.[0] 
                            ? CATEGORY_LABELS[insights.top_spending_categories[0].category] || insights.top_spending_categories[0].category 
                            : 'No expense logged'
                          }
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-800/50 flex justify-between items-baseline">
                        <div>
                          <span className="text-2xl font-black text-emerald-400">
                            {formatXAF(insights.top_spending_categories?.[0]?.amount || 0)}
                          </span>
                          <span className="text-xs text-slate-500 ml-1">FCFA</span>
                        </div>
                        {insights.top_spending_categories?.[0]?.percentage && (
                          <div className="text-xs text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                            {Number(insights.top_spending_categories[0].percentage).toFixed(1)}% of total
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Income Trend Card */}
                  <Card className="border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-colors duration-300 shadow-xl rounded-3xl md:col-span-2 lg:col-span-1">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-cyan-400 tracking-wider uppercase bg-cyan-500/10 px-2.5 py-1 rounded-full">Income Trajectory</span>
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="text-xs text-slate-400 uppercase font-medium">AI Description</div>
                        <p className="text-xs text-slate-300 font-medium leading-relaxed mt-2 line-clamp-4">
                          {insights.income_trend || 'No regular salary or secondary income stream is detected yet.'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sub-Alert grids */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Budget warnings */}
                  <Card className="border-slate-800 bg-slate-900/40 rounded-3xl">
                    <CardHeader className="border-b border-slate-850">
                      <CardTitle className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        Budget Warnings & Limit Excesses
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {insights.budget_warnings && insights.budget_warnings.length > 0 ? (
                        <div className="space-y-3">
                          {insights.budget_warnings.map((warn, i) => (
                            <div key={i} className="flex gap-3 items-start p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                              <span className="mt-0.5 p-1 bg-amber-500/10 text-amber-400 rounded-lg">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </span>
                              <span className="text-xs text-slate-300 leading-relaxed">{warn}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                          <Check className="w-5 h-5 text-emerald-500 p-1 bg-emerald-500/10 rounded-full" />
                          No active budget warnings. You are operating within your allocations!
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Unusual Spending (Anomaly alerts) */}
                  <Card className="border-slate-800 bg-slate-900/40 rounded-3xl">
                    <CardHeader className="border-b border-slate-850">
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        <Sparkle className="w-4 h-4 text-emerald-400" />
                        Anomalous Payments & Unusual Spikes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {insights.unusual_spending_alerts && insights.unusual_spending_alerts.length > 0 ? (
                        <div className="space-y-3">
                          {insights.unusual_spending_alerts.map((alert, i) => (
                            <div key={i} className="flex gap-3 items-start p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                              <span className="mt-0.5 p-1 bg-emerald-500/10 text-emerald-400 rounded-lg">
                                <Sparkles className="w-3.5 h-3.5" />
                              </span>
                              <span className="text-xs text-slate-300 leading-relaxed">{alert}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                          <Check className="w-5 h-5 text-emerald-500 p-1 bg-emerald-500/10 rounded-full" />
                          No unusual spikes or payment surges identified recently.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* SECTION 2: AI FINANCIAL ASSISTANT (CHAT) */}
        {activeTab === 'assistant' && (
          <motion.div
            key="assistant"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-4 gap-6"
          >
            {/* Left side: Suggested guidelines & search panel */}
            <div className="space-y-6 lg:col-span-1">
              <Card className="border-slate-800 bg-slate-900/50 rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-wider text-slate-400 font-bold">Search Chat</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Search messages..."
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      className="pl-9 text-xs bg-slate-950 border-slate-800 text-white rounded-xl focus:border-gold placeholder:text-slate-600 focus:ring-0 w-full"
                    />
                  </div>
                  <Button 
                    onClick={handleClearChat}
                    variant="outline" 
                    className="w-full justify-center text-slate-400 hover:text-white border-slate-800 rounded-xl py-2 text-xs font-semibold cursor-pointer"
                  >
                    Clear Chat History
                  </Button>
                </CardContent>
              </Card>

              {/* System Stats context */}
              <Card className="border-slate-800 bg-slate-900/50 rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-gold" />
                    Security Framework
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-400 space-y-2 font-medium leading-relaxed">
                  <p>Mbamager executes all language analyses via server-side Google GenAI channels.</p>
                  <p>Your raw account pins and API keys are strictly hidden. Analyses are local and confidential.</p>
                </CardContent>
              </Card>
            </div>

            {/* Right side: Active chat dialog */}
            <div className="lg:col-span-3 flex flex-col h-[600px] border border-slate-800 bg-slate-900/30 rounded-3xl overflow-hidden shadow-2xl">
              {/* Top info bar */}
              <div className="flex justify-between items-center bg-slate-900/90 border-b border-slate-800/80 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-gold-500/10 text-gold border border-gold-500/20 rounded-xl">
                    <Bot className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">Financial Advisor Console</h3>
                    <p className="text-[10px] text-gold font-semibold flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
                      Gemini model connected
                    </p>
                  </div>
                </div>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 max-w-[85%] ${
                      msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`p-2 rounded-xl text-xs h-8 w-8 flex items-center justify-center border shrink-0 ${
                      msg.sender === 'user' 
                        ? 'bg-gold border-gold text-white' 
                        : 'bg-gold-500/10 border-gold-500/20 text-gold'
                    }`}>
                      {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Chat Bubble content */}
                    <div className="flex flex-col gap-1">
                      <div className={`p-4 rounded-3xl text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-gold text-white rounded-tr-none border border-gold/20 shadow-md shadow-gold-500/10'
                          : 'bg-slate-900/40 text-slate-200 rounded-tl-none border border-slate-900/60 shadow-md'
                      }`}>
                        <div className="markdown-body max-w-none text-slate-200">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                      <span className={`text-[10px] text-slate-500 px-1 font-medium ${
                        msg.sender === 'user' ? 'text-right' : ''
                      }`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Simulated typing indicator */}
                {isTyping && (
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="p-2 rounded-xl h-8 w-8 flex items-center justify-center bg-gold-500/10 border border-gold-500/20 text-gold shrink-0">
                      <Bot className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="bg-slate-900/90 border border-slate-850 p-4 rounded-3xl rounded-tl-none flex items-center gap-1.5 shadow-md">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Bottom input section with Suggested prompts */}
              <div className="bg-slate-900/80 border-t border-slate-800 p-4 space-y-4">
                {/* Clickable suggest pill list */}
                <div className="flex flex-wrap gap-2">
                  {[
                    "Where did I spend the most this month?",
                    "How much did I save?",
                    "What should I reduce?",
                    "Explain my spending."
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestedPrompt(p)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-950/80 hover:bg-slate-950 border border-slate-850 hover:border-slate-700 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-300"
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Main input bar */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage(chatInput);
                  }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder="Ask about budgets, Orange/MTN transactions, savings..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 text-xs bg-slate-950 border-slate-800 text-white rounded-2xl focus:border-gold placeholder:text-slate-600 focus:ring-0 py-3"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!chatInput.trim() || isTyping}
                    className="p-3 bg-gold hover:bg-gold-600 text-white border-0 rounded-2xl cursor-pointer transition-all shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          </motion.div>
        )}

        {/* SECTION 3: TRANSACTION INTELLIGENCE */}
        {activeTab === 'transactions' && (
          <motion.div
            key="transactions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Filter controls card */}
            <Card className="border-slate-800 bg-slate-900/50 rounded-3xl">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Search narrative..."
                      value={txSearchQuery}
                      onChange={(e) => setTxSearchQuery(e.target.value)}
                      className="pl-9 text-xs bg-slate-950 border-slate-800 text-white rounded-xl focus:border-emerald-500 focus:ring-0 placeholder:text-slate-600 w-full"
                    />
                  </div>

                  {/* Category Filter */}
                  <div className="relative">
                    <Filter className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-500" />
                    <select
                      value={txCategoryFilter}
                      onChange={(e) => setTxCategoryFilter(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl focus:border-emerald-500 focus:outline-none w-full appearance-none cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABELS[cat] || cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Confidence Filter */}
                  <div className="relative">
                    <Percent className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-500" />
                    <select
                      value={txConfidenceFilter}
                      onChange={(e) => setTxConfidenceFilter(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl focus:border-emerald-500 focus:outline-none w-full appearance-none cursor-pointer"
                    >
                      <option value="all">All Confidences</option>
                      <option value="high">High (&gt;80%)</option>
                      <option value="medium">Medium (50%-80%)</option>
                      <option value="low">Low (&lt;50%)</option>
                    </select>
                  </div>

                  {/* Date Filter */}
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-500" />
                    <select
                      value={txDateFilter}
                      onChange={(e) => setTxDateFilter(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl focus:border-emerald-500 focus:outline-none w-full appearance-none cursor-pointer"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">This Month</option>
                      <option value="year">This Year</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ledger transactions list table */}
            <Card className="border-slate-800 bg-slate-900/40 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/85 bg-slate-950/60">
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Timestamp</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Narrative / Description</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Category</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Amount</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">AI Confidence</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {isTransactionsLoading ? (
                      [1, 2, 3, 4, 5].map((idx) => (
                        <tr key={idx} className="bg-slate-900/10">
                          <td className="p-4"><Skeleton className="h-4 w-20 bg-slate-800 rounded" /></td>
                          <td className="p-4"><Skeleton className="h-4 w-48 bg-slate-800 rounded" /></td>
                          <td className="p-4"><Skeleton className="h-4 w-24 bg-slate-800 rounded" /></td>
                          <td className="p-4"><Skeleton className="h-4 w-16 bg-slate-800 rounded" /></td>
                          <td className="p-4"><Skeleton className="h-4 w-12 bg-slate-800 rounded" /></td>
                          <td className="p-4 text-right"><Skeleton className="h-8 w-16 bg-slate-800 rounded ml-auto" /></td>
                        </tr>
                      ))
                    ) : isTransactionsError ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center">
                          <ErrorState title="Error Loading Ledger" message="Failed to load user transactions." />
                        </td>
                      </tr>
                    ) : filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 text-xs font-medium">
                          No transactions match the active filter criteria. Clear some parameters to refresh.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const isCredit = tx.direction === 'CREDIT';
                        const amountStr = `${isCredit ? '+' : '-'}${formatXAF(tx.amount)}`;
                        const confidence = tx.ai_confidence !== undefined && tx.ai_confidence !== null ? Number(tx.ai_confidence) : null;
                        
                        // Confidence color map
                        let confBadge = 'bg-slate-800 text-slate-400 border border-slate-700';
                        let confText = 'Manual/N/A';
                        if (confidence !== null) {
                          const pct = Math.round(confidence * 100);
                          confText = `${pct}%`;
                          if (confidence >= 0.8) {
                            confBadge = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                          } else if (confidence >= 0.5) {
                            confBadge = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                          } else {
                            confBadge = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                          }
                        }

                        return (
                          <tr key={tx.id} className="hover:bg-slate-900/40 transition-colors duration-200">
                            <td className="p-4 text-xs font-medium text-slate-400">
                              {tx.timestamp ? formatDate(tx.timestamp, true) : 'N/A'}
                            </td>
                            <td className="p-4 text-xs font-bold text-white max-w-xs truncate">
                              {tx.narrative || 'Mobile wallet payment'}
                            </td>
                            <td className="p-4 text-xs font-semibold text-slate-300">
                              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-750">
                                {CATEGORY_LABELS[tx.category] || tx.category}
                              </span>
                            </td>
                            <td className={`p-4 text-xs font-black ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {amountStr}
                            </td>
                            <td className="p-4 text-xs">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${confBadge}`}>
                                {confText}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <Button
                                onClick={() => handleOpenTxExplain(tx.id)}
                                variant="outline"
                                size="sm"
                                className="gap-1.5 rounded-xl border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/30 font-semibold cursor-pointer py-1.5 px-3"
                              >
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                AI Explainer
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}

        {/* SECTION 4: SMART RECOMMENDATIONS */}
        {activeTab === 'recommendations' && (
          <motion.div
            key="recommendations"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {isInsightsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((idx) => (
                  <Card key={idx} className="border-slate-800 bg-slate-900/50">
                    <CardHeader><Skeleton className="h-4 w-1/3 bg-slate-800 rounded" /></CardHeader>
                    <CardContent className="space-y-2">
                      <Skeleton className="h-3 w-full bg-slate-800 rounded" />
                      <Skeleton className="h-3 w-4/5 bg-slate-800 rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : isInsightsError ? (
              <ErrorState title="Fails to render recommendations" message="Check network or configure budgets/savings goals first." />
            ) : !insights ? (
              <Card className="border-slate-800 p-8 text-center bg-slate-900/50">
                <p className="text-sm text-slate-500">No active guidelines or budget criteria detected.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Category-grouped Savings Accrual */}
                <Card className="border-slate-800 bg-slate-900/40 rounded-3xl">
                  <CardHeader className="border-b border-slate-850">
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      Savings Optimization Strategies
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">Tailored suggestions on saving opportunities and transfer efficiency.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {insights.savings_suggestions && insights.savings_suggestions.length > 0 ? (
                      <div className="space-y-3">
                        {insights.savings_suggestions.map((sug, i) => (
                          <div key={i} className="flex gap-3 items-start p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                            <span className="p-1 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-xs text-slate-300 leading-relaxed font-medium">{sug}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-slate-500 text-xs">
                        No suggestions found. Try setting up savings targets to guide the analyzer.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. Category-grouped Budget Recommendations */}
                <Card className="border-slate-800 bg-slate-900/40 rounded-3xl">
                  <CardHeader className="border-b border-slate-850">
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-400" />
                      Dynamic Budget Adjustments
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">Recommended category allocation shifts based on recent transactions.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {insights.budget_recommendations && insights.budget_recommendations.length > 0 ? (
                      <div className="space-y-3">
                        {insights.budget_recommendations.map((rec, i) => (
                          <div key={i} className="flex gap-3 items-start p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                            <span className="p-1 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
                              <TrendingUp className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-xs text-slate-300 leading-relaxed font-medium">{rec}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-slate-500 text-xs">
                        All allocations look highly efficient. No category shift recommendations.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- TRANSACTION AI EXPLAINER MODAL (PANEL) --- */}
      <Modal
        isOpen={selectedTxId !== null}
        onClose={handleCloseTxExplain}
        title="Ledger AI Analysis Engine"
        description="Comprehensive classification explanations, structural risk values, and manual re-evaluation predictions."
        size="lg"
      >
        {selectedTxId !== null && selectedTx && (
          <div className="space-y-5">
            {/* Primary Details Block */}
            <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-2xl grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Narrative</span>
                <p className="text-xs font-bold text-white mt-1 max-w-xs truncate">{selectedTx.narrative || 'Mobile payment'}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Amount</span>
                <p className={`text-xs font-bold mt-1 ${selectedTx.direction === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedTx.direction === 'CREDIT' ? '+' : '-'}{formatXAF(selectedTx.amount)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Assigned Category</span>
                <p className="text-xs font-semibold text-slate-300 mt-1">{CATEGORY_LABELS[selectedTx.category] || selectedTx.category}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Confidence Metric</span>
                <p className="text-xs font-bold text-slate-300 mt-1">
                  {selectedTx.ai_confidence !== undefined && selectedTx.ai_confidence !== null 
                    ? `${Math.round(Number(selectedTx.ai_confidence) * 100)}%` 
                    : 'Manual Override'
                  }
                </p>
              </div>
            </div>

            {/* AI Explanation Loader */}
            {isTxExplainLoading ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-4 w-1/4 bg-slate-800 rounded" />
                <Skeleton className="h-3 w-full bg-slate-800 rounded" />
                <Skeleton className="h-3 w-5/6 bg-slate-800 rounded" />
              </div>
            ) : isTxExplainError ? (
              <div className="p-4 bg-rose-500/5 border border-rose-500/10 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Failed to retrieve AI explanation. Check active Gemini server status.
              </div>
            ) : txExplanation ? (
              <div className="space-y-4">
                {/* Text Explanation */}
                <div className="p-4 bg-slate-900 border border-slate-850 rounded-2xl space-y-2">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    Category Classification Logic
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium pt-1">
                    {txExplanation.explanation || 'No reasoning text returned from the underlying model.'}
                  </p>
                </div>

                {/* Alternatives List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400">Alternative Classifications Considered</h4>
                  {txExplanation.alternatives && txExplanation.alternatives.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {txExplanation.alternatives.map((alt, i) => (
                        <div key={i} className="p-3 bg-slate-900 border border-slate-850 rounded-xl flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-slate-200">{CATEGORY_LABELS[alt.category] || alt.category}</span>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">{alt.reason}</p>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-850">
                            {Math.round(alt.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500">The classification logic reports absolute certainty; no secondary clusters considered.</p>
                  )}
                </div>
              </div>
            ) : null}

            {/* AI RECLASSIFICATION preview/interactive block */}
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => reclassifyMutation.mutate(selectedTx.id)}
                  disabled={reclassifyMutation.isPending}
                  variant="outline"
                  size="sm"
                  className="flex-1 justify-center gap-2 border-slate-800 text-slate-300 hover:text-white cursor-pointer rounded-2xl py-2.5 font-bold"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${reclassifyMutation.isPending ? 'animate-spin' : ''}`} />
                  {reclassifyMutation.isPending ? 'Triggering Model...' : 'Run Reclassification Model'}
                </Button>
                
                <Button
                  onClick={handleCloseTxExplain}
                  variant="outline"
                  size="sm"
                  className="border-slate-800 text-slate-400 hover:text-white cursor-pointer rounded-2xl px-5 font-semibold"
                >
                  Close
                </Button>
              </div>

              {/* Show Prediction Preview */}
              {reclassifyPreview && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Predicted Category</span>
                      <p className="text-xs font-black text-emerald-400 mt-0.5">
                        {CATEGORY_LABELS[reclassifyPreview.predicted_category] || reclassifyPreview.predicted_category}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Model Confidence</span>
                      <p className="text-xs font-black text-emerald-400 mt-0.5">
                        {Math.round(reclassifyPreview.confidence * 100)}%
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                    *Manual Override Warning: Applying this change will modify your transaction record permanently in the secure database. Re-runs are always allowed.
                  </p>

                  <Button
                    onClick={() => applyReclassificationMutation.mutate({
                      txId: selectedTx.id,
                      category: reclassifyPreview.predicted_category
                    })}
                    disabled={applyReclassificationMutation.isPending}
                    variant="primary"
                    size="sm"
                    className="w-full justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-2 font-bold cursor-pointer transition-colors duration-200"
                  >
                    {applyReclassificationMutation.isPending ? 'Applying Change...' : 'Apply Predicted Category'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
