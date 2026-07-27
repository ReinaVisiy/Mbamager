import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  RefreshCcw, 
  Calendar, 
  Filter, 
  X, 
  Check, 
  Sparkles, 
  Brain, 
  Info, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  FileText, 
  ArrowUpDown, 
  Maximize2,
  CalendarDays,
  Percent,
  TrendingUp,
  Tag
} from 'lucide-react';
import { motion } from 'motion/react';

import { PageHeader } from '../components/common/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ErrorState } from '../components/common/ErrorState';
import { Skeleton } from '../components/ui/SkeletonLoader';
import { transactionsService, CreateTransactionPayload, UpdateTransactionPayload } from '../services/transactions';
import { accountsService } from '../services/accounts';
import { Transaction, TransactionDirection } from '../types';
import { formatXAF, formatDate } from '../utils/format';

// Available categories defined in backend models. `value` must be the exact
// TransactionCategory enum VALUE the backend accepts (see
// backend/app/constants/categories.py) — not the enum member name — since
// this value is sent as-is in create/update/filter requests.
const STANDARD_CATEGORIES = [
  { value: 'Salary / Wages', label: 'Salary & Wages', type: 'CREDIT' },
  { value: 'Business / Trade', label: 'Business Revenue', type: 'CREDIT' },
  { value: 'Remittance / Support', label: 'Remittances', type: 'CREDIT' },
  { value: 'Food & Groceries', label: 'Food & Groceries', type: 'DEBIT' },
  { value: 'Electricity / Water / Internet', label: 'Utilities & Telecom', type: 'DEBIT' },
  { value: 'Medical & Health', label: 'Health & Medical', type: 'DEBIT' },
  { value: 'School Fees / Education', label: 'Education & Tuition', type: 'DEBIT' },
  { value: 'Taxi / Moto / Transport', label: 'Transportation', type: 'DEBIT' },
  { value: 'Operator Cashout Fees', label: 'Fees & Commissions', type: 'DEBIT' },
  { value: 'Njangi / Savings Club', label: 'Savings & Deposits', type: 'DEBIT' },
  { value: 'Agriculture / Business Growth', label: 'Investments', type: 'DEBIT' }
];

const getCategoryMeta = (category: string) => {
  const cat = String(category).toUpperCase();
  if (cat.includes('SALARY')) {
    return { label: 'Salary & Wages', bgClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dotClass: 'bg-emerald-400' };
  }
  if (cat.includes('BUSINESS')) {
    return { label: 'Business Revenue', bgClass: 'bg-teal-500/10 text-teal-400 border-teal-500/20', dotClass: 'bg-teal-400' };
  }
  if (cat.includes('REMITTANCE')) {
    return { label: 'Remittances', bgClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', dotClass: 'bg-indigo-400' };
  }
  if (cat.includes('FOOD')) {
    return { label: 'Food & Groceries', bgClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dotClass: 'bg-amber-400' };
  }
  if (cat.includes('UTILITIES')) {
    return { label: 'Utilities & Telecom', bgClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20', dotClass: 'bg-sky-400' };
  }
  if (cat.includes('HEALTH')) {
    return { label: 'Health & Medical', bgClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20', dotClass: 'bg-rose-400' };
  }
  if (cat.includes('EDUCATION')) {
    return { label: 'Education & Tuition', bgClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20', dotClass: 'bg-purple-400' };
  }
  if (cat.includes('TRANSPORT')) {
    return { label: 'Transportation', bgClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20', dotClass: 'bg-blue-400' };
  }
  if (cat.includes('COMMISSION')) {
    return { label: 'Fees & Commissions', bgClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20', dotClass: 'bg-slate-400' };
  }
  if (cat.includes('SAVINGS')) {
    return { label: 'Savings & Deposits', bgClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dotClass: 'bg-emerald-400' };
  }
  if (cat.includes('AGRICULTURE') || cat.includes('GROWTH')) {
    return { label: 'Investments', bgClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', dotClass: 'bg-cyan-400' };
  }
  return { label: category.replace(/_/g, ' '), bgClass: 'bg-slate-800/60 text-slate-400 border-slate-700', dotClass: 'bg-slate-400' };
};

const getProviderBadge = (provider?: string) => {
  if (!provider) return null;
  const prov = String(provider).toUpperCase();
  if (prov.includes('MTN')) {
    return { label: 'MTN MoMo', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' };
  }
  if (prov.includes('ORANGE')) {
    return { label: 'Orange Money', className: 'bg-orange-500/15 text-orange-400 border-orange-500/20' };
  }
  if (prov.includes('CASH')) {
    return { label: 'Cash Box', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' };
  }
  if (prov.includes('SOCIETE') || prov.includes('BICEC') || prov.includes('UBA') || prov.includes('BANK')) {
    return { label: provider.replace(/_/g, ' '), className: 'bg-blue-500/15 text-blue-400 border-blue-500/20' };
  }
  return { label: provider.replace(/_/g, ' '), className: 'bg-slate-800/85 text-slate-400 border-slate-700' };
};

export default function Transactions() {
  const queryClient = useQueryClient();

  // Filter/Sort State variables
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('ALL');
  const [selectedDirection, setSelectedDirection] = React.useState<TransactionDirection | 'ALL'>('ALL');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [sortOrder, setSortOrder] = React.useState<'NEWEST' | 'OLDEST'>('NEWEST');

  // Modal display states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [selectedTx, setSelectedTx] = React.useState<Transaction | null>(null);

  // Form Fields State
  const [formAccountId, setFormAccountId] = React.useState<number>(0);
  const [formAmount, setFormAmount] = React.useState<string>('');
  const [formDirection, setFormDirection] = React.useState<TransactionDirection>('DEBIT');
  const [formCategory, setFormCategory] = React.useState<string>('Food & Groceries');
  const [formNarrative, setFormNarrative] = React.useState<string>('');
  const [formFee, setFormFee] = React.useState<string>('0');
  const [formTimestamp, setFormTimestamp] = React.useState<string>('');
  const [formTxIdExternal, setFormTxIdExternal] = React.useState<string>('');
  const [formError, setFormError] = React.useState<string | null>(null);

  // Reclassification specific states
  const [reclassificationResult, setReclassificationResult] = React.useState<{ predicted_category: string; confidence: number } | null>(null);
  const [reclassifyError, setReclassifyError] = React.useState<string | null>(null);

  // 1. Fetch user accounts to bind drop-downs
  const { data: accounts, isLoading: isAccountsLoading } = useQuery({
    queryKey: ['dashboardAccounts'],
    queryFn: () => accountsService.getAll()
  });

  // 2. Fetch Transactions (will fetch globally or per-account)
  const { 
    data: transactions, 
    isLoading: isTransactionsLoading, 
    isError: isTransactionsError, 
    refetch: refetchTransactions 
  } = useQuery({
    queryKey: ['transactions', selectedAccountId],
    queryFn: () => transactionsService.getAll({ 
      account_id: selectedAccountId === 'ALL' ? undefined : Number(selectedAccountId) 
    })
  });

  // 3. Fetch AI explanation for selected Transaction when Detail View is active
  const {
    data: explanation,
    isLoading: isExplainLoading,
    error: explainError,
    refetch: refetchExplanation
  } = useQuery({
    queryKey: ['transactionExplanation', selectedTx?.id],
    queryFn: () => transactionsService.explain(selectedTx!.id),
    enabled: !!selectedTx && isDetailOpen,
    retry: false
  });

  // Sync refresh helper
  const handleRefreshAll = async () => {
    await Promise.all([
      refetchTransactions(),
      queryClient.invalidateQueries({ queryKey: ['dashboardAccounts'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] })
    ]);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateTransactionPayload) => transactionsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || err.message || 'Failed to create financial transaction.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTransactionPayload }) => 
      transactionsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsEditOpen(false);
      
      // Update local state if the edited transaction was open in details
      if (selectedTx) {
        transactionsService.getById(selectedTx.id).then((updated) => {
          setSelectedTx(updated);
        });
      }
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || err.message || 'Failed to update transaction.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => transactionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsDeleteOpen(false);
      setIsDetailOpen(false);
      setSelectedTx(null);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || err.message || 'Failed to drop transaction record.');
    }
  });

  const reclassifyMutation = useMutation({
    mutationFn: (id: number) => transactionsService.reclassify(id),
    onSuccess: (data) => {
      setReclassificationResult(data);
    },
    onError: (err: any) => {
      setReclassifyError(err?.response?.data?.detail || err.message || 'Manual AI Reclassification failed.');
    }
  });

  const resetForm = () => {
    setFormAccountId(selectedAccountId !== 'ALL' ? Number(selectedAccountId) : (accounts?.[0]?.id ?? 0));
    setFormAmount('');
    setFormDirection('DEBIT');
    setFormCategory('Food & Groceries');
    setFormNarrative('');
    setFormFee('0');
    setFormTxIdExternal('');
    setFormTimestamp(new Date().toISOString().slice(0, 16));
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (tx: Transaction, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFormAccountId(tx.account_id);
    setFormAmount(String(tx.amount));
    setFormDirection(tx.direction);
    setFormCategory(tx.category);
    setFormNarrative(tx.narrative || '');
    setFormFee(String(tx.fee || '0'));
    setFormTxIdExternal(tx.tx_id_external || '');
    setFormTimestamp(tx.timestamp ? new Date(tx.timestamp).toISOString().slice(0, 16) : '');
    setFormError(null);
    setSelectedTx(tx);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (tx: Transaction, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTx(tx);
    setIsDeleteOpen(true);
  };

  const handleOpenDetail = (tx: Transaction) => {
    setSelectedTx(tx);
    setReclassificationResult(null);
    setReclassifyError(null);
    setIsDetailOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Amount must be a strictly positive number.');
      return;
    }

    const feeVal = parseFloat(formFee);
    if (isNaN(feeVal) || feeVal < 0) {
      setFormError('Fee must be 0 or a positive number.');
      return;
    }

    if (!formAccountId) {
      setFormError('Please select a valid connected account.');
      return;
    }

    createMutation.mutate({
      account_id: formAccountId,
      amount: amt,
      fee: feeVal,
      direction: formDirection,
      category: formCategory,
      narrative: formNarrative.trim() || undefined,
      tx_id_external: formTxIdExternal.trim() || undefined,
      timestamp: formTimestamp ? new Date(formTimestamp).toISOString() : undefined
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Amount must be a strictly positive number.');
      return;
    }

    const feeVal = parseFloat(formFee);
    if (isNaN(feeVal) || feeVal < 0) {
      setFormError('Fee must be 0 or a positive number.');
      return;
    }

    if (!selectedTx) return;

    updateMutation.mutate({
      id: selectedTx.id,
      payload: {
        amount: amt,
        fee: feeVal,
        direction: formDirection,
        category: formCategory,
        narrative: formNarrative.trim() || undefined,
        tx_id_external: formTxIdExternal.trim() || undefined,
        timestamp: formTimestamp ? new Date(formTimestamp).toISOString() : undefined
      }
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedTx) return;
    deleteMutation.mutate(selectedTx.id);
  };

  const handleRunReclassify = () => {
    if (!selectedTx) return;
    setReclassificationResult(null);
    setReclassifyError(null);
    reclassifyMutation.mutate(selectedTx.id);
  };

  const handleApplyReclassifiedCategory = () => {
    if (!selectedTx || !reclassificationResult) return;
    updateMutation.mutate({
      id: selectedTx.id,
      payload: {
        category: reclassificationResult.predicted_category
      }
    });
    setReclassificationResult(null);
  };

  // Perform multi-dimensional client-side filters on fetched transactions
  const processedTransactions = React.useMemo(() => {
    if (!transactions) return [];

    let result = [...transactions];

    // 1. Search Query filter (matches narrative, category, external ref id, or amount)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(tx => {
        const narrativeMatch = tx.narrative?.toLowerCase().includes(q) ?? false;
        const categoryMatch = tx.category.toLowerCase().includes(q);
        const extMatch = tx.tx_id_external?.toLowerCase().includes(q) ?? false;
        const amountMatch = String(tx.amount).includes(q);
        return narrativeMatch || categoryMatch || extMatch || amountMatch;
      });
    }

    // 2. Category filter
    if (selectedCategory !== 'ALL') {
      result = result.filter(tx => tx.category === selectedCategory);
    }

    // 3. Direction filter (Credit vs Debit)
    if (selectedDirection !== 'ALL') {
      result = result.filter(tx => tx.direction === selectedDirection);
    }

    // 4. Date Range filter (inclusive)
    if (startDate) {
      const startMs = new Date(startDate).setHours(0, 0, 0, 0);
      result = result.filter(tx => {
        const txMs = new Date(tx.timestamp || tx.created_at).getTime();
        return txMs >= startMs;
      });
    }
    if (endDate) {
      const endMs = new Date(endDate).setHours(23, 59, 59, 999);
      result = result.filter(tx => {
        const txMs = new Date(tx.timestamp || tx.created_at).getTime();
        return txMs <= endMs;
      });
    }

    // 5. Sorting
    result.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at).getTime();
      const timeB = new Date(b.timestamp || b.created_at).getTime();
      return sortOrder === 'NEWEST' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [transactions, searchQuery, selectedCategory, selectedDirection, startDate, endDate, sortOrder]);

  // Map transaction direction colors
  const getDirectionMeta = (dir: TransactionDirection) => {
    return dir === 'CREDIT'
      ? { text: 'Inflow', textClass: 'text-emerald-400', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <ArrowUpRight className="w-3 h-3" /> }
      : { text: 'Outflow', textClass: 'text-rose-400', badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: <ArrowDownLeft className="w-3 h-3" /> };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* PAGE HEADER */}
      <PageHeader
        title="Double-Entry Financial Ledger"
        description="Verify, filter, and audit all incoming and outgoing cash flows synchronized across MTN MoMo, Orange Money, and banks."
        action={
          <Button variant="primary" size="sm" className="gap-2 shrink-0" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            Log Transaction
          </Button>
        }
      />

      {/* FILTER & CONTROL PANEL */}
      <Card className="border border-slate-900 bg-slate-950/40">
        <CardContent className="p-4.5 space-y-4">
          {/* Row 1: Search & Quick Direction Filter Tabs */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
            {/* Narrative Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                id="txSearchNarrative"
                placeholder="Search narrative, external Reference ID, amount, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 text-xs text-slate-200 placeholder-slate-600 rounded-xl pl-10 pr-10 py-2.5 transition-all focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/50"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Direction Filters & Refresh */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex bg-slate-950 border border-slate-900 rounded-xl p-1">
                <button
                  id="directionFilterAll"
                  onClick={() => setSelectedDirection('ALL')}
                  className={`px-3.5 py-1.5 text-[10px] font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                    selectedDirection === 'ALL'
                      ? 'bg-slate-800 text-white border border-slate-700/40 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Directions
                </button>
                <button
                  id="directionFilterCredit"
                  onClick={() => setSelectedDirection('CREDIT')}
                  className={`px-3.5 py-1.5 text-[10px] font-mono font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                    selectedDirection === 'CREDIT'
                      ? 'bg-gold text-white shadow shadow-gold-500/10'
                      : 'text-slate-400 hover:text-gold'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Inflows
                </button>
                <button
                  id="directionFilterDebit"
                  onClick={() => setSelectedDirection('DEBIT')}
                  className={`px-3.5 py-1.5 text-[10px] font-mono font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                    selectedDirection === 'DEBIT'
                      ? 'bg-rose-500 text-white shadow shadow-rose-500/10'
                      : 'text-slate-400 hover:text-rose-400'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Outflows
                </button>
              </div>

              {/* Refresh trigger */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                title="Synchronize records with server"
                className="h-9 px-3 shrink-0"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Row 2: Account, Category, Date range & Sorting dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1 border-t border-slate-900/40">
            {/* Account filter */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filterAccount" className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Connected Ledger Account
              </label>
              <select
                id="filterAccount"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 text-xs text-slate-200 rounded-xl px-3 py-2 transition-all focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/50 cursor-pointer"
              >
                <option value="ALL">All Wallet & Bank Accounts</option>
                {accounts?.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filterCategory" className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Classification Category
              </label>
              <select
                id="filterCategory"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 text-xs text-slate-200 rounded-xl px-3 py-2 transition-all focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/50 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {STANDARD_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filterStartDate" className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500">
                From Date
              </label>
              <input
                type="date"
                id="filterStartDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 text-xs text-slate-200 rounded-xl px-3 py-2 transition-all focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/50"
              />
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filterEndDate" className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500">
                To Date
              </label>
              <input
                type="date"
                id="filterEndDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 text-xs text-slate-200 rounded-xl px-3 py-2 transition-all focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/50"
              />
            </div>

            {/* Sort Order */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filterSort" className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Journal Sorting
              </label>
              <select
                id="filterSort"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'NEWEST' | 'OLDEST')}
                className="w-full bg-slate-950 border border-slate-900 text-xs text-slate-200 rounded-xl px-3 py-2 transition-all focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/50 cursor-pointer"
              >
                <option value="NEWEST">Newest entries first</option>
                <option value="OLDEST">Oldest entries first</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SKELETON LOADERS FOR TRANSACTIONS */}
      {isTransactionsLoading || isAccountsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </div>
      ) : isTransactionsError ? (
        /* ERROR STATE */
        <ErrorState 
          title="Ledger Synch Interrupted" 
          message="We failed to retrieve transaction records from the backend database. Check network parameters and retry." 
          onRetry={handleRefreshAll}
        />
      ) : processedTransactions.length === 0 ? (
        /* EMPTY STATE DISPLAY */
        <Card className="border border-slate-800 border-dashed bg-slate-900/10 py-16 text-center max-w-xl mx-auto rounded-3xl mt-6">
          <div className="p-4.5 bg-gold-50 border border-gold-200 text-gold rounded-2xl w-fit mx-auto mb-4.5 dark:bg-gold-500/10 dark:border-gold-500/20">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 tracking-tight">No Transactions Found</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mt-2 leading-relaxed">
            There are no double-entry ledger transactions matching your filter criteria. Log a manual transaction or parse mobile operator SMS logs.
          </p>
          <div className="flex gap-2 justify-center mt-6">
            {(searchQuery || selectedCategory !== 'ALL' || selectedDirection !== 'ALL' || startDate || endDate || selectedAccountId !== 'ALL') && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setSelectedDirection('ALL');
                  setStartDate('');
                  setEndDate('');
                  setSelectedAccountId('ALL');
                }}
              >
                Reset Filters
              </Button>
            )}
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleOpenCreate}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Log First Entry
            </Button>
          </div>
        </Card>
      ) : (
        /* TRANSACTION JOURNAL LEDGER TABLE / CARDS */
        <Card className="border border-slate-900 bg-slate-950/20 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            {/* Desktop and Tablet Ledger Journal View */}
            <table className="w-full text-left border-collapse min-w-[900px] hidden md:table">
              <thead>
                <tr className="bg-slate-900/40 border-b border-slate-900 text-[10px] font-mono font-bold text-slate-400">
                  <th className="py-4.5 px-5 w-40">TIMESTAMP & DATE</th>
                  <th className="py-4.5 px-4 w-40">ACCOUNT / NETWORK</th>
                  <th className="py-4.5 px-4">NARRATIVE REFERENCE</th>
                  <th className="py-4.5 px-4 w-44">CLASSIFIED CATEGORY</th>
                  <th className="py-4.5 px-4 w-32 text-right">FEES</th>
                  <th className="py-4.5 px-5 w-44 text-right">LEDGER AMOUNT</th>
                  <th className="py-4.5 px-4 w-28 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60 text-xs">
                {processedTransactions.map((tx) => {
                  const directionMeta = getDirectionMeta(tx.direction);
                  const categoryMeta = getCategoryMeta(tx.category);
                  const account = accounts?.find(a => a.id === tx.account_id);
                  const providerBadge = getProviderBadge(account?.provider);

                  return (
                    <tr 
                      key={tx.id} 
                      onClick={() => handleOpenDetail(tx)}
                      className="hover:bg-slate-900/30 transition-colors group cursor-pointer"
                    >
                      {/* Timestamp */}
                      <td className="py-4 px-5">
                        <div className="font-mono text-[10px] text-slate-200 font-semibold">
                          {tx.timestamp ? formatDate(tx.timestamp) : formatDate(tx.created_at)}
                        </div>
                        <div className="font-mono text-[9px] text-slate-500 pt-0.5">
                          {tx.timestamp 
                            ? new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                            : new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Account & Network Badge */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-300 truncate max-w-[150px]" title={account?.name}>
                          {account?.name || `Account #${tx.account_id}`}
                        </div>
                        {providerBadge && (
                          <span className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border mt-1 scale-95 origin-left ${providerBadge.className}`}>
                            {providerBadge.label}
                          </span>
                        )}
                      </td>

                      {/* Narrative Description */}
                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-100 line-clamp-1 break-all pr-4 font-sans text-xs">
                          {tx.narrative || <span className="text-slate-600 font-mono text-[10px]">No memo attached</span>}
                        </div>
                        {tx.tx_id_external && (
                          <div className="font-mono text-[9px] text-slate-500 pt-0.5" title={`External ID: ${tx.tx_id_external}`}>
                            Ref: {tx.tx_id_external}
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 border rounded-lg ${categoryMeta.bgClass}`}>
                            <span className={`w-1 h-1 rounded-full ${categoryMeta.dotClass}`} />
                            {categoryMeta.label}
                          </span>
                          {tx.ai_confidence !== undefined && tx.ai_confidence !== null && Number(tx.ai_confidence) > 0 && (
                            <span className="text-[9px] text-emerald-400 font-mono" title={`AI Confidence: ${Math.round(Number(tx.ai_confidence) * 100)}%`}>
                              <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
                              {Math.round(Number(tx.ai_confidence) * 100)}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Fees */}
                      <td className="py-4 px-4 text-right font-mono text-slate-400">
                        {tx.fee && Number(tx.fee) > 0 ? formatXAF(tx.fee) : '—'}
                      </td>

                      {/* Amount with Inflow / Outflow indicator */}
                      <td className="py-4 px-5 text-right font-mono font-bold text-sm">
                        <span className={directionMeta.textClass}>
                          {tx.direction === 'CREDIT' ? '+' : '-'}{formatXAF(tx.amount)}
                        </span>
                      </td>

                      {/* Quick row controls */}
                      <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleOpenEdit(tx, e)}
                            className="p-1.5 hover:bg-slate-900 hover:text-emerald-400 border border-transparent hover:border-slate-800 rounded-lg cursor-pointer transition-all"
                            title="Edit entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleOpenDelete(tx, e)}
                            className="p-1.5 hover:bg-rose-950/20 hover:text-rose-400 border border-transparent hover:border-rose-950/50 rounded-lg cursor-pointer transition-all"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Cozy Card Ledger View */}
            <div className="block md:hidden divide-y divide-slate-900/60 p-1">
              {processedTransactions.map((tx) => {
                const directionMeta = getDirectionMeta(tx.direction);
                const categoryMeta = getCategoryMeta(tx.category);
                const account = accounts?.find(a => a.id === tx.account_id);
                const providerBadge = getProviderBadge(account?.provider);

                return (
                  <div 
                    key={tx.id} 
                    onClick={() => handleOpenDetail(tx)}
                    className="p-4 hover:bg-slate-900/20 active:bg-slate-900/40 transition-colors cursor-pointer space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-white">
                          {account?.name || `Account #${tx.account_id}`}
                        </div>
                        <div className="font-mono text-[9px] text-slate-500">
                          {tx.timestamp ? formatDate(tx.timestamp, true) : formatDate(tx.created_at, true)}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`font-mono font-black text-sm ${directionMeta.textClass}`}>
                          {tx.direction === 'CREDIT' ? '+' : '-'}{formatXAF(tx.amount)}
                        </span>
                        {tx.fee && Number(tx.fee) > 0 && (
                          <div className="text-[9px] font-mono text-slate-500 pt-0.5">
                            Fee: {formatXAF(tx.fee)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="font-medium text-slate-200 text-xs break-words">
                      {tx.narrative || <span className="text-slate-600 font-mono text-[10px]">No memo attached</span>}
                    </div>

                    <div className="flex justify-between items-center pt-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded ${categoryMeta.bgClass}`}>
                          {categoryMeta.label}
                        </span>
                        {providerBadge && (
                          <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded border uppercase scale-95 ${providerBadge.className}`}>
                            {providerBadge.label}
                          </span>
                        )}
                      </div>

                      {/* Action buttons on card */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleOpenEdit(tx, e)}
                          className="p-2 hover:bg-slate-900 text-slate-400 hover:text-emerald-400 border border-slate-900 rounded-lg cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleOpenDelete(tx, e)}
                          className="p-2 hover:bg-slate-900 text-slate-400 hover:text-rose-400 border border-slate-900 rounded-lg cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* CREATE TRANSACTION MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Log Ledger Transaction"
        description="Record a new transaction manually to update ledger accounts."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-3">
          {formError && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl text-xs text-rose-400 font-semibold mb-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Account selector */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="createTxAccount" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
              Account *
            </label>
            <select
              id="createTxAccount"
              value={formAccountId}
              onChange={(e) => setFormAccountId(Number(e.target.value))}
              disabled={createMutation.isPending}
              required
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="" disabled>Select an account</option>
              {accounts?.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <Input
              label="MONETARY AMOUNT (XAF / FCFA) *"
              type="number"
              placeholder="e.g. 25000"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              disabled={createMutation.isPending}
              required
              min="0.01"
              step="any"
              helperText="Strictly positive value"
            />

            {/* Direction */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="createTxDirection" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
                Transaction Direction *
              </label>
              <select
                id="createTxDirection"
                value={formDirection}
                onChange={(e) => setFormDirection(e.target.value as TransactionDirection)}
                disabled={createMutation.isPending}
                required
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 cursor-pointer"
              >
                <option value="DEBIT">Outflow (Debit)</option>
                <option value="CREDIT">Inflow (Credit)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="createTxCategory" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
                Classification Category *
              </label>
              <select
                id="createTxCategory"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                disabled={createMutation.isPending}
                required
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 cursor-pointer"
              >
                {STANDARD_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Fee */}
            <Input
              label="TRANSACTION FEE (IF APPLICABLE)"
              type="number"
              placeholder="0"
              value={formFee}
              onChange={(e) => setFormFee(e.target.value)}
              disabled={createMutation.isPending}
              min="0"
              step="any"
              helperText="Fee charged by mobile operators or banks"
            />
          </div>

          {/* Narrative */}
          <Input
            label="NARRATIVE MEMO / MESSAGE TEXT"
            type="text"
            placeholder="e.g. Purchase of monthly internet bundle"
            value={formNarrative}
            onChange={(e) => setFormNarrative(e.target.value)}
            disabled={createMutation.isPending}
            maxLength={255}
            helperText="Brief summary explaining what this transaction was about"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Timestamp */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="createTxTimestamp" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
                Transaction Date & Time
              </label>
              <input
                type="datetime-local"
                id="createTxTimestamp"
                value={formTimestamp}
                onChange={(e) => setFormTimestamp(e.target.value)}
                disabled={createMutation.isPending}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 cursor-pointer"
              />
              <span className="text-[9px] text-slate-500 font-mono">Defaults to current time if left blank</span>
            </div>

            {/* External ID */}
            <Input
              label="OPERATOR REFERENCE ID (TXID)"
              type="text"
              placeholder="e.g. TX1234567890"
              value={formTxIdExternal}
              onChange={(e) => setFormTxIdExternal(e.target.value)}
              disabled={createMutation.isPending}
              maxLength={64}
              helperText="Telecom operator or bank transfer ID reference"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-900">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setIsCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              isLoading={createMutation.isPending}
              disabled={createMutation.isPending}
            >
              Log Transaction
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT TRANSACTION MODAL */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Modify Ledger Transaction"
        description="Update amount, category classification, narrative memos, or fees."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 pt-3">
          {formError && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl text-xs text-rose-400 font-semibold mb-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Selected Account display (disabled for double-entry lock) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-500 font-mono font-semibold tracking-wider uppercase">
              Assigned Account
            </label>
            <div className="w-full bg-slate-950/60 border border-slate-900/60 text-xs text-slate-400 rounded-xl px-3.5 py-2.5 select-none font-mono">
              {accounts?.find(a => a.id === formAccountId)?.name || `Account #${formAccountId}`} (Account-ID Lock)
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <Input
              label="MONETARY AMOUNT (XAF / FCFA) *"
              type="number"
              placeholder="e.g. 25000"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              disabled={updateMutation.isPending}
              required
              min="0.01"
              step="any"
            />

            {/* Direction */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="editTxDirection" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
                Transaction Direction *
              </label>
              <select
                id="editTxDirection"
                value={formDirection}
                onChange={(e) => setFormDirection(e.target.value as TransactionDirection)}
                disabled={updateMutation.isPending}
                required
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
              >
                <option value="DEBIT">Outflow (Debit)</option>
                <option value="CREDIT">Inflow (Credit)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="editTxCategory" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
                Classification Category *
              </label>
              <select
                id="editTxCategory"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                disabled={updateMutation.isPending}
                required
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 cursor-pointer"
              >
                {STANDARD_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Fee */}
            <Input
              label="TRANSACTION FEE (IF APPLICABLE)"
              type="number"
              placeholder="0"
              value={formFee}
              onChange={(e) => setFormFee(e.target.value)}
              disabled={updateMutation.isPending}
              min="0"
              step="any"
            />
          </div>

          {/* Narrative */}
          <Input
            label="NARRATIVE MEMO / MESSAGE TEXT"
            type="text"
            placeholder="e.g. Purchase of monthly internet bundle"
            value={formNarrative}
            onChange={(e) => setFormNarrative(e.target.value)}
            disabled={updateMutation.isPending}
            maxLength={255}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Timestamp */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="editTxTimestamp" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
                Transaction Date & Time
              </label>
              <input
                type="datetime-local"
                id="editTxTimestamp"
                value={formTimestamp}
                onChange={(e) => setFormTimestamp(e.target.value)}
                disabled={updateMutation.isPending}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 cursor-pointer"
              />
            </div>

            {/* External ID */}
            <Input
              label="OPERATOR REFERENCE ID (TXID)"
              type="text"
              placeholder="e.g. TX1234567890"
              value={formTxIdExternal}
              onChange={(e) => setFormTxIdExternal(e.target.value)}
              disabled={updateMutation.isPending}
              maxLength={64}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-900">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setIsEditOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              isLoading={updateMutation.isPending}
              disabled={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMutation.isPending}
        title="Drop Ledger Transaction"
        description={`Are you absolutely sure you want to drop and delete this transaction record? This action is irreversible and will permanently adjust the dynamic account balance for "${accounts?.find(a => a.id === selectedTx?.account_id)?.name || 'the account'}" by ${selectedTx ? formatXAF(selectedTx.amount) : ''}.`}
        confirmText="Confirm & Purge"
        cancelText="Abort"
        isDestructive
      />

      {/* LEDGER TRANSACTION DETAIL VIEW MODAL (WITH AI EXPLANATION & RECLASSIFY) */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Double-Entry Audit Ledger Detail"
        description="Inspect full system metadata, audit trails, and invoke server-side AI categorization engines."
        size="lg"
      >
        {selectedTx && (
          <div className="space-y-6 pt-2">
            {/* Main transaction details box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-950/60 p-4 rounded-2xl border border-slate-900">
              <div className="space-y-3">
                <div>
                  <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Transaction ID</span>
                  <span className="text-xs font-mono font-bold text-slate-300">#TX-LGR-{selectedTx.id}</span>
                </div>

                <div>
                  <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Wallet Account</span>
                  <span className="text-xs text-white font-semibold block">
                    {accounts?.find(a => a.id === selectedTx.account_id)?.name || `Account #${selectedTx.account_id}`}
                  </span>
                  {accounts?.find(a => a.id === selectedTx.account_id)?.provider && (
                    <span className="text-[9px] font-mono text-slate-400">
                      Network: {accounts?.find(a => a.id === selectedTx.account_id)?.provider.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Timestamp</span>
                  <span className="text-xs text-slate-300 font-semibold block">
                    {selectedTx.timestamp ? formatDate(selectedTx.timestamp, true) : formatDate(selectedTx.created_at, true)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">External reference ID</span>
                  <span className="text-xs font-mono text-slate-300">
                    {selectedTx.tx_id_external || <span className="text-slate-600 font-normal">None synchronized</span>}
                  </span>
                </div>
              </div>

              <div className="space-y-3 md:border-l md:border-slate-900/60 md:pl-5">
                <div>
                  <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Ledger Volume</span>
                  <span className={`text-base font-black font-mono block ${getDirectionMeta(selectedTx.direction).textClass}`}>
                    {selectedTx.direction === 'CREDIT' ? '+' : '-'}{formatXAF(selectedTx.amount)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Fee Paid</span>
                  <span className="text-xs font-mono font-bold text-slate-300 block">
                    {selectedTx.fee && Number(selectedTx.fee) > 0 ? formatXAF(selectedTx.fee) : '0 FCFA (Free)'}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Narrative Memo</span>
                  <span className="text-xs text-slate-200 font-medium block italic leading-relaxed">
                    "{selectedTx.narrative || 'No description attached.'}"
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Current Classification Category</span>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 border rounded-lg mt-1 ${getCategoryMeta(selectedTx.category).bgClass}`}>
                    <span className={`w-1 h-1 rounded-full ${getCategoryMeta(selectedTx.category).dotClass}`} />
                    {getCategoryMeta(selectedTx.category).label}
                  </span>
                </div>
              </div>
            </div>

            {/* AI DECISION SUPPORT BLOCK */}
            <div className="border border-slate-900 bg-slate-950/20 rounded-2xl p-4 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-900/60">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-100 tracking-tight">AI Classification Decision Support</h4>
                </div>

                {selectedTx.ai_confidence !== undefined && selectedTx.ai_confidence !== null && (
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 bg-slate-950 border border-slate-900 px-2.5 py-1 rounded-lg">
                    <Percent className="w-3 h-3 text-emerald-400" />
                    Confidence: {Math.round(Number(selectedTx.ai_confidence) * 100)}%
                  </span>
                )}
              </div>

              {/* AI Explanation fetched via TanStack query */}
              <div className="space-y-3">
                {isExplainLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : explainError ? (
                  <div className="text-[11px] text-slate-500 font-medium italic flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span>No structured AI decision trail available for manually logged cash entries.</span>
                  </div>
                ) : explanation ? (
                  <div className="space-y-3 text-xs leading-relaxed">
                    <div className="text-slate-300 font-medium">
                      <span className="text-[10px] text-slate-500 font-mono block uppercase tracking-wider mb-1">AI Classification Trail</span>
                      "{explanation.explanation}"
                    </div>

                    {explanation.alternatives && explanation.alternatives.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[10px] text-slate-500 font-mono block uppercase tracking-wider mb-2">Alternative Suggestions Evaluated</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {explanation.alternatives.map((alt, i) => {
                            const meta = getCategoryMeta(alt.category);
                            return (
                              <div key={i} className="bg-slate-950 border border-slate-900 p-2.5 rounded-xl flex flex-col justify-between">
                                <div className="flex justify-between items-center">
                                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 border rounded ${meta.bgClass}`}>
                                    {meta.label}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono font-bold">
                                    {Math.round(alt.confidence * 100)}%
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-500 italic mt-1.5 block">
                                  "{alt.reason}"
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* MANUAL RECLASSIFICATION ACTION */}
              <div className="pt-2.5 border-t border-slate-900/60 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <h5 className="text-[11px] font-bold text-slate-300">Run manual AI category re-evaluation</h5>
                    <p className="text-[10px] text-slate-500">Query Mbamager LLM model to predict categories without modifying records.</p>
                  </div>

                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRunReclassify}
                    isLoading={reclassifyMutation.isPending}
                    disabled={reclassifyMutation.isPending}
                    className="gap-1.5 shrink-0"
                  >
                    <Brain className="w-3.5 h-3.5 text-emerald-400" />
                    Query AI
                  </Button>
                </div>

                {reclassifyError && (
                  <div className="text-[10px] text-rose-400 font-bold bg-rose-500/5 p-2 rounded-lg border border-rose-500/20">
                    {reclassifyError}
                  </div>
                )}

                {reclassificationResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-950 border border-emerald-950/40 p-3 rounded-xl flex flex-col sm:flex-row gap-3.5 justify-between items-start sm:items-center"
                  >
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">AI PREDICTION RESULT</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 border rounded-lg ${getCategoryMeta(reclassificationResult.predicted_category).bgClass}`}>
                          {getCategoryMeta(reclassificationResult.predicted_category).label}
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-bold">
                          Confidence: {Math.round(reclassificationResult.confidence * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Allow applying on click */}
                    {reclassificationResult.predicted_category !== selectedTx.category ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleApplyReclassifiedCategory}
                        isLoading={updateMutation.isPending}
                        disabled={updateMutation.isPending}
                        className="gap-1 px-3 h-8 text-[10px]"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Apply Classification
                      </Button>
                    ) : (
                      <span className="text-[10px] text-emerald-500/80 font-semibold flex items-center gap-1 self-center">
                        <Check className="w-3.5 h-3.5" /> Already matches database
                      </span>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            {/* MODAL CONTROL FOOTER */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-900">
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="gap-1"
                  onClick={() => handleOpenEdit(selectedTx)}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Entry
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/50 gap-1"
                  onClick={() => handleOpenDelete(selectedTx)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Entry
                </Button>
              </div>

              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={() => setIsDetailOpen(false)}
              >
                Close Audit
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
