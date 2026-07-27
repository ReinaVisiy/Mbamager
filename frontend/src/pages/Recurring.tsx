import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Clock, 
  Check, 
  X, 
  Calendar, 
  TrendingUp, 
  Coins, 
  AlertTriangle, 
  ArrowUpRight,
  Filter,
  Play,
  RotateCcw,
  Activity,
  ArrowDownLeft,
  ToggleLeft,
  ToggleRight,
  Info
} from 'lucide-react';

import { PageHeader } from '../components/common/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/ui/SkeletonLoader';
import { formatXAF, formatDate } from '../utils/format';
import { financeService, CreateRecurringPayload, UpdateRecurringPayload } from '../services/finance';
import { accountsService } from '../services/accounts';
import { RecurringTransaction, RecurringFrequency, TransactionDirection, Account } from '../types';

export default function Recurring() {
  const queryClient = useQueryClient();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

  // Modal control states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [selectedRT, setSelectedRT] = React.useState<RecurringTransaction | null>(null);

  // Form field states
  const [formAccountId, setFormAccountId] = React.useState<number>(0);
  const [formAmount, setFormAmount] = React.useState<number>(0);
  const [formCategory, setFormCategory] = React.useState('Food & Groceries');
  const [formDirection, setFormDirection] = React.useState<TransactionDirection>('DEBIT');
  const [formFrequency, setFormFrequency] = React.useState<RecurringFrequency>('MONTHLY');
  const [formStartDate, setFormStartDate] = React.useState('');
  const [formEndDate, setFormEndDate] = React.useState('');
  const [formNarrative, setFormNarrative] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  // Toast / Manual Trigger State
  const [triggerStatus, setTriggerStatus] = React.useState<string | null>(null);
  const [isTriggering, setIsTriggering] = React.useState(false);

  // 1. Fetch Recurring Transactions
  const { 
    data: recurringList, 
    isLoading, 
    isError, 
    refetch: refetchRecurring 
  } = useQuery({
    queryKey: ['recurringTransactions'],
    queryFn: () => financeService.getRecurring()
  });

  // 2. Fetch User Accounts
  const { 
    data: accounts,
    isLoading: isAccountsLoading
  } = useQuery({
    queryKey: ['dashboardAccounts'],
    queryFn: () => accountsService.getAll()
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateRecurringPayload) => financeService.createRecurring(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err?.message || 'Failed to establish recurring payment schedule.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateRecurringPayload }) => 
      financeService.updateRecurring(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
      setIsEditOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err?.message || 'Failed to update recurring transaction.');
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => 
      financeService.updateRecurring(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
    },
    onError: (err: any) => {
      alert(err?.message || 'Failed to toggle status.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => financeService.deleteRecurring(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
      setIsDeleteOpen(false);
      setSelectedRT(null);
    },
    onError: (err: any) => {
      alert(err?.message || 'Failed to drop recurring transaction template.');
    }
  });

  const resetForm = () => {
    if (accounts && accounts.length > 0) {
      setFormAccountId(accounts[0].id);
    } else {
      setFormAccountId(0);
    }
    setFormAmount(0);
    setFormCategory('Food & Groceries');
    setFormDirection('DEBIT');
    setFormFrequency('MONTHLY');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate('');
    setFormNarrative('');
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (rt: RecurringTransaction) => {
    setFormAccountId(rt.account_id);
    setFormAmount(rt.amount);
    setFormCategory(rt.category);
    setFormDirection(rt.direction);
    setFormFrequency(rt.frequency);
    setFormStartDate(rt.start_date);
    setFormEndDate(rt.end_date || '');
    setFormNarrative(rt.narrative || '');
    setFormError(null);
    setSelectedRT(rt);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (rt: RecurringTransaction) => {
    setSelectedRT(rt);
    setIsDeleteOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccountId) {
      setFormError('A linked account is required');
      return;
    }
    if (formAmount <= 0) {
      setFormError('Transaction amount must be greater than 0');
      return;
    }
    if (!formStartDate) {
      setFormError('Start date is required');
      return;
    }
    if (!formNarrative.trim()) {
      setFormError('Description narrative is required');
      return;
    }

    createMutation.mutate({
      account_id: formAccountId,
      amount: formAmount,
      category: formCategory,
      direction: formDirection,
      frequency: formFrequency,
      start_date: formStartDate,
      end_date: formEndDate || undefined,
      narrative: formNarrative,
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRT) return;
    if (!formAccountId) {
      setFormError('A linked account is required');
      return;
    }
    if (formAmount <= 0) {
      setFormError('Transaction amount must be greater than 0');
      return;
    }
    if (!formStartDate) {
      setFormError('Start date is required');
      return;
    }
    if (!formNarrative.trim()) {
      setFormError('Description narrative is required');
      return;
    }

    updateMutation.mutate({
      id: selectedRT.id,
      payload: {
        account_id: formAccountId,
        amount: formAmount,
        category: formCategory,
        direction: formDirection,
        frequency: formFrequency,
        start_date: formStartDate,
        end_date: formEndDate || undefined,
        narrative: formNarrative,
      },
    });
  };

  const handleToggleActive = (rt: RecurringTransaction) => {
    toggleMutation.mutate({ id: rt.id, active: !rt.active });
  };

  const handleDeleteConfirm = () => {
    if (!selectedRT) return;
    deleteMutation.mutate(selectedRT.id);
  };

  const handleManualTrigger = async () => {
    setIsTriggering(true);
    setTriggerStatus(null);
    try {
      const res = await financeService.triggerProcessRecurring();
      setTriggerStatus(res.message);
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
      setTimeout(() => setTriggerStatus(null), 5000);
    } catch (err: any) {
      setTriggerStatus(err?.message || 'Failed to trigger cron evaluation daemon.');
    } finally {
      setIsTriggering(false);
    }
  };

  // Filter & Search computation
  const filteredRT = React.useMemo(() => {
    if (!recurringList) return [];
    return recurringList.filter((rt) => {
      const narrativeMatches = (rt.narrative || '').toLowerCase().includes(searchQuery.toLowerCase());
      const categoryMatches = rt.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSearch = narrativeMatches || categoryMatches;
      
      const matchesStatus = 
        statusFilter === 'ALL' || 
        (statusFilter === 'ACTIVE' && rt.active) ||
        (statusFilter === 'DISABLED' && !rt.active);
      return matchesSearch && matchesStatus;
    });
  }, [recurringList, searchQuery, statusFilter]);

  // Calculations for StatCards
  const stats = React.useMemo(() => {
    if (!recurringList || recurringList.length === 0) {
      return { totalOutflow: 0, totalInflow: 0, activeCount: 0, disabledCount: 0 };
    }
    const totalOutflow = recurringList
      .filter(rt => rt.active && rt.direction === 'DEBIT')
      .reduce((acc, rt) => acc + Number(rt.amount), 0);
    const totalInflow = recurringList
      .filter(rt => rt.active && rt.direction === 'CREDIT')
      .reduce((acc, rt) => acc + Number(rt.amount), 0);
    const activeCount = recurringList.filter(rt => rt.active).length;
    const disabledCount = recurringList.filter(rt => !rt.active).length;
    return { totalOutflow, totalInflow, activeCount, disabledCount };
  }, [recurringList]);

  // Compute next execution date accurately
  const computeNextExecution = (rt: RecurringTransaction): string => {
    if (!rt.active) return 'Disabled';
    const lastProcessed = rt.last_processed ? new Date(rt.last_processed) : null;
    const startDate = new Date(rt.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let baseDate = lastProcessed && lastProcessed > startDate ? lastProcessed : startDate;
    let nextDate = new Date(baseDate);

    while (nextDate <= today || (lastProcessed && nextDate.getTime() === lastProcessed.getTime())) {
      if (rt.frequency === 'DAILY') {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (rt.frequency === 'WEEKLY') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (rt.frequency === 'MONTHLY') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (rt.frequency === 'YEARLY') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      } else {
        break;
      }
    }
    
    if (rt.end_date) {
      const endDate = new Date(rt.end_date);
      if (nextDate > endDate) return 'Expired';
    }
    
    return formatDate(nextDate);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automated Recurring Payments"
        description="Schedule recurring transaction templates and automate standard mobile money logs."
        action={
          <Button variant="primary" size="sm" className="gap-2" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            Establish Schedule
          </Button>
        }
      />

      {/* Stats Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/40 border-slate-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Monthly Outflow</span>
              <p className="text-lg font-bold text-rose-400">-{formatXAF(stats.totalOutflow)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-rose-400">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Monthly Inflow</span>
              <p className="text-lg font-bold text-gold">+{formatXAF(stats.totalInflow)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-gold">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Active Schedules</span>
              <p className="text-lg font-bold text-slate-200">{stats.activeCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sky-400">
              <Activity className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Disabled Schedules</span>
              <p className="text-lg font-bold text-slate-500">{stats.disabledCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-500">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Daemon Control Bar */}
      {triggerStatus && (
        <div className="p-3 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs rounded-xl flex items-center gap-2.5">
          <Info className="w-4 h-4 shrink-0" />
          <span>{triggerStatus}</span>
        </div>
      )}

      <Card className="bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 border-slate-800/60">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="space-y-0.5 text-center sm:text-left">
            <h4 className="text-xs font-bold text-slate-200">Process Due Schedules</h4>
            <p className="text-[10px] text-slate-400 leading-relaxed">Manually run the automatic evaluator to clear pending recurring logs for today immediately.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 text-[11px] h-8 shrink-0 hover:bg-slate-800/40"
            onClick={handleManualTrigger}
            isLoading={isTriggering}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Evaluate Due Logs
          </Button>
        </CardContent>
      </Card>

      {/* Toolbar / Search & Filters */}
      <Card className="bg-slate-900/20 border-slate-800/60">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by narrative, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto self-end sm:self-auto justify-end">
            <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
            <Button
              variant={statusFilter === 'ALL' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('ALL')}
              className="text-[11px] px-3 py-1"
            >
              All
            </Button>
            <Button
              variant={statusFilter === 'ACTIVE' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('ACTIVE')}
              className="text-[11px] px-3 py-1"
            >
              Active
            </Button>
            <Button
              variant={statusFilter === 'DISABLED' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('DISABLED')}
              className="text-[11px] px-3 py-1"
            >
              Disabled
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      {isLoading || isAccountsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState 
          title="Failed to Load Recurring Payments" 
          message="A network exception occurred while fetching your active subscription schedules." 
          onRetry={refetchRecurring} 
        />
      ) : filteredRT.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={searchQuery ? "No recurring schedules match search" : "No recurring schedules yet"}
          description={searchQuery ? "Check spelling or switch active/disabled status filters to locate other templates." : "Create automated recurring templates to simulate monthly rent, subscription services, or Airtime logs."}
          actionText={searchQuery ? undefined : "Establish First Schedule"}
          onAction={searchQuery ? undefined : handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRT.map((rt) => {
            const linkedAcc = accounts?.find(a => a.id === rt.account_id);
            const nextExec = computeNextExecution(rt);

            return (
              <Card key={rt.id} className="relative overflow-hidden bg-slate-900/30 border-slate-800 hover:border-slate-700 transition-all">
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-100 tracking-tight">{rt.narrative}</h4>
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                        <Activity className="w-3.5 h-3.5 text-slate-500" />
                        <span>Account: {linkedAcc ? linkedAcc.name : `Account #${rt.account_id}`}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleToggleActive(rt)}
                        title={rt.active ? "Click to suspend schedule" : "Click to enable schedule"}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {rt.active ? (
                          <ToggleRight className="w-8 h-8 text-gold" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-slate-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Financial Metrics */}
                  <div className="flex items-baseline justify-between">
                    <span className={`text-base font-extrabold tracking-tight ${
                      rt.direction === 'CREDIT' ? 'text-gold' : 'text-slate-200'
                    }`}>
                      {rt.direction === 'CREDIT' ? '+' : '-'}{formatXAF(rt.amount)}
                    </span>

                    <span className="text-[10px] uppercase tracking-wider font-bold bg-slate-800/40 border border-slate-700/60 px-2 py-0.5 rounded text-slate-300">
                      {rt.frequency}
                    </span>
                  </div>

                  {/* Date details */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/60 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-500">Category Tag</span>
                      <p className="text-xs font-bold text-slate-300">{rt.category}</p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-500">Next Execution</span>
                      <p className={`text-xs font-bold ${
                        rt.active ? 'text-emerald-500' : 'text-slate-500'
                      }`}>{nextExec}</p>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="px-5 py-2.5 bg-slate-950/30 border-t border-slate-800/40 flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleOpenEdit(rt)}
                    className="h-7 gap-1.5 text-slate-400 hover:text-slate-100"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleOpenDelete(rt)}
                    className="h-7 gap-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE RECURRING MODAL */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Establish New Schedule">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Description Narrative</label>
            <Input
              placeholder="e.g. Monthly Canopy Rental Subscription"
              value={formNarrative}
              onChange={(e) => setFormNarrative(e.target.value)}
              className="h-10 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Linked Account</label>
              <select
                value={formAccountId}
                onChange={(e) => setFormAccountId(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl h-10 px-3 text-xs outline-none focus:border-slate-700"
              >
                {accounts?.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatXAF(acc.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Category Tag</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl h-10 px-3 text-xs outline-none focus:border-slate-700"
              >
                <option value="Salary / Wages">Salary / Income</option>
                <option value="Business / Trade">Business Logistics</option>
                <option value="Remittance / Support">Remittances</option>
                <option value="Food & Groceries">Food & Groceries</option>
                <option value="Electricity / Water / Internet">Bills & Subscriptions</option>
                <option value="Medical & Health">Health & Medical</option>
                <option value="School Fees / Education">Education & School Fees</option>
                <option value="Taxi / Moto / Transport">Transportation</option>
                <option value="Operator Cashout Fees">Fees & Commissions</option>
                <option value="Njangi / Savings Club">Njangi Contribution</option>
                <option value="Agriculture / Business Growth">Investments</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Transaction Direction</label>
              <select
                value={formDirection}
                onChange={(e) => setFormDirection(e.target.value as TransactionDirection)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl h-10 px-3 text-xs outline-none focus:border-slate-700"
              >
                <option value="DEBIT">DEBIT (Payment Outflow)</option>
                <option value="CREDIT">CREDIT (Income Inflow)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Schedule Frequency</label>
              <select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value as RecurringFrequency)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl h-10 px-3 text-xs outline-none focus:border-slate-700"
              >
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="YEARLY">YEARLY</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Amount (FCFA)</label>
              <Input
                type="number"
                placeholder="e.g. 15000"
                value={formAmount || ''}
                onChange={(e) => setFormAmount(Number(e.target.value))}
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Start Date</label>
              <Input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="h-10 text-xs text-slate-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">End Date (Optional)</label>
            <Input
              type="date"
              value={formEndDate}
              onChange={(e) => setFormEndDate(e.target.value)}
              className="h-10 text-xs text-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={createMutation.isPending}>
              Create Schedule
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT RECURRING MODAL */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Update Recurring Schedule">
        <form onSubmit={handleUpdateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Description Narrative</label>
            <Input
              placeholder="e.g. Monthly Canopy Rental Subscription"
              value={formNarrative}
              onChange={(e) => setFormNarrative(e.target.value)}
              className="h-10 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Linked Account</label>
              <select
                value={formAccountId}
                onChange={(e) => setFormAccountId(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl h-10 px-3 text-xs outline-none focus:border-slate-700"
              >
                {accounts?.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatXAF(acc.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Category Tag</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl h-10 px-3 text-xs outline-none focus:border-slate-700"
              >
                <option value="Salary / Wages">Salary / Income</option>
                <option value="Business / Trade">Business Logistics</option>
                <option value="Remittance / Support">Remittances</option>
                <option value="Food & Groceries">Food & Groceries</option>
                <option value="Electricity / Water / Internet">Bills & Subscriptions</option>
                <option value="Medical & Health">Health & Medical</option>
                <option value="School Fees / Education">Education & School Fees</option>
                <option value="Taxi / Moto / Transport">Transportation</option>
                <option value="Operator Cashout Fees">Fees & Commissions</option>
                <option value="Njangi / Savings Club">Njangi Contribution</option>
                <option value="Agriculture / Business Growth">Investments</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Transaction Direction</label>
              <select
                value={formDirection}
                onChange={(e) => setFormDirection(e.target.value as TransactionDirection)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl h-10 px-3 text-xs outline-none focus:border-slate-700"
              >
                <option value="DEBIT">DEBIT (Payment Outflow)</option>
                <option value="CREDIT">CREDIT (Income Inflow)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Schedule Frequency</label>
              <select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value as RecurringFrequency)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl h-10 px-3 text-xs outline-none focus:border-slate-700"
              >
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="YEARLY">YEARLY</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Amount (FCFA)</label>
              <Input
                type="number"
                placeholder="e.g. 15000"
                value={formAmount || ''}
                onChange={(e) => setFormAmount(Number(e.target.value))}
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Start Date</label>
              <Input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="h-10 text-xs text-slate-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">End Date (Optional)</label>
            <Input
              type="date"
              value={formEndDate}
              onChange={(e) => setFormEndDate(e.target.value)}
              className="h-10 text-xs text-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={updateMutation.isPending}>
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
        title="Delete Recurring Template"
        description={`Are you completely sure you want to drop your automated schedule "${selectedRT?.narrative}"? Future automatic transactions matching this template will no longer be generated. This action cannot be undone.`}
        confirmText="Permanently Delete"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

