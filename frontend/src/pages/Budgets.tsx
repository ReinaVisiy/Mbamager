import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  PieChart,
  Wallet,
  Sparkles,
  AlertTriangle,
  ShoppingCart,
  Zap,
  HeartPulse,
  GraduationCap,
  Car,
  Landmark,
  Coins,
  Sprout,
  Briefcase,
  ArrowLeftRight,
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
import {
  financeService,
  CreateBudgetPayload,
  UpdateBudgetPayload,
} from '../services/finance';
import { dashboardService } from '../services/dashboard';
import { Budget, BudgetProgress, BudgetCoaching } from '../types';

// Real TransactionCategory enum values the backend accepts — must match
// backend/app/constants/categories.py exactly (see the same list reused in
// Transactions.tsx and Recurring.tsx).
const BUDGET_CATEGORIES = [
  { value: 'Food & Groceries', label: 'Food & Groceries' },
  { value: 'Electricity / Water / Internet', label: 'Utilities & Telecom' },
  { value: 'Medical & Health', label: 'Health & Medical' },
  { value: 'School Fees / Education', label: 'Education & Tuition' },
  { value: 'Taxi / Moto / Transport', label: 'Transportation' },
  { value: 'Operator Cashout Fees', label: 'Fees & Commissions' },
  { value: 'Njangi / Savings Club', label: 'Njangi / Savings Club' },
  { value: 'Agriculture / Business Growth', label: 'Agriculture & Business Growth' },
  { value: 'Salary / Wages', label: 'Salary / Wages' },
  { value: 'Business / Trade', label: 'Business / Trade' },
  { value: 'Remittance / Support', label: 'Remittance / Support' },
];

const getCategoryIcon = (category: string) => {
  const cat = String(category).toUpperCase();
  if (cat.includes('FOOD')) return ShoppingCart;
  if (cat.includes('ELECTRICITY') || cat.includes('WATER') || cat.includes('INTERNET')) return Zap;
  if (cat.includes('MEDICAL') || cat.includes('HEALTH')) return HeartPulse;
  if (cat.includes('SCHOOL') || cat.includes('EDUCATION')) return GraduationCap;
  if (cat.includes('TAXI') || cat.includes('TRANSPORT')) return Car;
  if (cat.includes('COMMISSION') || cat.includes('FEE')) return Landmark;
  if (cat.includes('NJANGI') || cat.includes('SAVINGS')) return Coins;
  if (cat.includes('AGRICULTURE') || cat.includes('GROWTH')) return Sprout;
  if (cat.includes('BUSINESS') || cat.includes('TRADE')) return Briefcase;
  if (cat.includes('REMITTANCE')) return ArrowLeftRight;
  return Wallet;
};

const emptyBudgetForm = () => {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    category: BUDGET_CATEGORIES[0].value,
    limit_amount: '' as number | string,
    start_date: today.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
};

export default function Budgets() {
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isCoachOpen, setIsCoachOpen] = React.useState(false);
  const [selectedBudget, setSelectedBudget] = React.useState<Budget | null>(null);
  const [coaching, setCoaching] = React.useState<BudgetCoaching | null>(null);

  const [form, setForm] = React.useState(emptyBudgetForm());
  const [formError, setFormError] = React.useState<string | null>(null);

  // 1. All budgets (full CRUD list, includes past/future/inactive periods)
  const {
    data: budgets,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => financeService.getBudgets(),
  });

  // 2. Progress metrics for currently-active budgets only (no AI call —
  // deterministic numbers computed by BudgetService, same source Dashboard uses)
  const { data: activeProgress } = useQuery({
    queryKey: ['dashboardBudgetProgress'],
    queryFn: () => dashboardService.getBudgets(),
  });

  const progressByBudgetId = React.useMemo(() => {
    const map = new Map<number, BudgetProgress>();
    (activeProgress || []).forEach((p) => map.set(p.budget_id, p));
    return map;
  }, [activeProgress]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateBudgetPayload) => financeService.createBudget(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardBudgetProgress'] });
      setIsCreateOpen(false);
      setForm(emptyBudgetForm());
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || err?.message || 'Failed to create budget.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateBudgetPayload }) =>
      financeService.updateBudget(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardBudgetProgress'] });
      setIsEditOpen(false);
      setSelectedBudget(null);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || err?.message || 'Failed to update budget.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => financeService.deleteBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardBudgetProgress'] });
      setIsDeleteOpen(false);
      setSelectedBudget(null);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || err?.message || 'Failed to delete budget.');
      setIsDeleteOpen(false);
    },
  });

  const coachMutation = useMutation({
    mutationFn: (id: number) => financeService.getBudgetCoaching(id),
    onSuccess: (data) => {
      setCoaching(data);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || err?.message || 'Failed to fetch AI coaching for this budget.');
      setIsCoachOpen(false);
    },
  });

  const handleOpenCreate = () => {
    setForm(emptyBudgetForm());
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (budget: Budget) => {
    setForm({
      category: budget.category,
      limit_amount: Number(budget.limit_amount),
      start_date: budget.start_date,
      end_date: budget.end_date,
    });
    setFormError(null);
    setSelectedBudget(budget);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (budget: Budget) => {
    setSelectedBudget(budget);
    setIsDeleteOpen(true);
  };

  const handleOpenCoach = (budget: Budget) => {
    setSelectedBudget(budget);
    setCoaching(null);
    setFormError(null);
    setIsCoachOpen(true);
    coachMutation.mutate(budget.id);
  };

  const validateForm = (): string | null => {
    const limit = Number(form.limit_amount);
    if (!form.category) return 'Please select a category.';
    if (!limit || limit <= 0) return 'Limit amount must be greater than 0.';
    if (!form.start_date || !form.end_date) return 'Start and end dates are required.';
    if (form.end_date < form.start_date) return 'End date must be on or after the start date.';
    return null;
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    createMutation.mutate({
      category: form.category,
      limit_amount: Number(form.limit_amount),
      start_date: form.start_date,
      end_date: form.end_date,
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBudget) return;
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    updateMutation.mutate({
      id: selectedBudget.id,
      payload: {
        category: form.category,
        limit_amount: Number(form.limit_amount),
        start_date: form.start_date,
        end_date: form.end_date,
      },
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedBudget) return;
    deleteMutation.mutate(selectedBudget.id);
  };

  // Stats derived from active-progress data only (matches Dashboard semantics)
  const stats = React.useMemo(() => {
    const list = activeProgress || [];
    const totalLimit = list.reduce((acc, p) => acc + Number(p.limit_amount), 0);
    const totalSpent = list.reduce((acc, p) => acc + Number(p.spent_amount), 0);
    const overCount = list.filter((p) => Number(p.percentage_used) >= 100).length;
    const nearingCount = list.filter((p) => Number(p.percentage_used) >= 80 && Number(p.percentage_used) < 100).length;
    return { totalLimit, totalSpent, activeCount: list.length, overCount, nearingCount };
  }, [activeProgress]);

  const isFormPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Category Budgets"
        description="Limit your category spending and get real-time, AI-narrated budget coaching."
        action={
          <Button variant="primary" size="sm" className="gap-2" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            Set Budget Limit
          </Button>
        }
      />

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/40 border-slate-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Active Limits Total</span>
              <p className="text-lg font-bold text-slate-200">{formatXAF(stats.totalLimit)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
              <PieChart className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Spent This Period</span>
              <p className="text-lg font-bold text-slate-200">{formatXAF(stats.totalSpent)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
              <Wallet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Active Budgets</span>
              <p className="text-lg font-bold text-slate-200">{stats.activeCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
              <Coins className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className={stats.overCount > 0 ? 'bg-rose-950/10 border-rose-900/40' : 'bg-slate-900/40 border-slate-800/80'}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Exceeded / Nearing</span>
              <p className="text-lg font-bold text-slate-200">{stats.overCount} / {stats.nearingCount}</p>
            </div>
            <div className={`p-2.5 rounded-xl border ${stats.overCount > 0 ? 'bg-rose-950/30 border-rose-900/40 text-rose-400' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load your budgets"
          message="A connection failure occurred while contacting the server."
          onRetry={() => refetch()}
        />
      ) : !budgets || budgets.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No category budgets yet"
          description="Set a spending limit for a category (e.g. Food & Groceries) to get real-time threshold warnings and AI-powered coaching."
          actionText="Set Budget Limit"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((budget) => {
            const progress = progressByBudgetId.get(budget.id);
            const pct = progress ? Number(progress.percentage_used) : null;
            const CategoryIcon = getCategoryIcon(budget.category);

            let progressColor = 'bg-gradient-to-r from-gold to-gold-300';
            let bgBorderColor = 'border-slate-800/80';
            if (pct !== null) {
              if (pct >= 100) {
                progressColor = 'bg-rose-500';
                bgBorderColor = 'border-rose-950/50';
              } else if (pct >= 80) {
                progressColor = 'bg-gradient-to-r from-amber-500 to-orange-400';
              }
            }

            return (
              <Card key={budget.id} className={`bg-slate-900/40 ${bgBorderColor}`}>
                <CardContent className="p-5 flex flex-col gap-3.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 bg-slate-950/60 rounded-xl text-slate-400 border border-slate-800">
                        <CategoryIcon className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-200">{budget.category}</p>
                        <p className="text-[9px] font-mono text-slate-500 mt-0.5 uppercase">
                          {formatDate(budget.start_date)} — {formatDate(budget.end_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenCoach(budget)}
                        title="Get AI coaching"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-gold hover:bg-slate-950/60 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(budget)}
                        title="Edit budget"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-950/60 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(budget)}
                        title="Delete budget"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-950/60 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {progress ? (
                    <>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="font-bold text-slate-100 font-mono">{formatXAF(Number(progress.spent_amount))}</span>
                        <span className="text-slate-500 font-medium">of {formatXAF(Number(progress.limit_amount))}</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`${progressColor} h-1.5 rounded-full transition-all`}
                          style={{ width: `${Math.min(100, pct ?? 0)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {pct !== null && pct >= 100
                          ? `Exceeded by ${formatXAF(Number(progress.spent_amount) - Number(progress.limit_amount))}`
                          : `${formatXAF(Number(progress.remaining_amount))} remaining · ${pct?.toFixed(0)}% used`}
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-slate-500 font-medium italic">
                      {new Date(budget.end_date) < new Date()
                        ? 'This budget period has ended.'
                        : 'This budget period has not started yet.'}{' '}
                      Limit: {formatXAF(Number(budget.limit_amount))}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Set Budget Limit"
        description="Cap spending in a category over a date range and get real-time threshold warnings."
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4 mt-1">
          <BudgetFormFields form={form} setForm={setForm} disabled={isFormPending} />
          {formError && <p className="text-[11px] font-mono text-rose-500 font-semibold">{formError}</p>}
          <div className="flex justify-end gap-2.5 mt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} disabled={isFormPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={createMutation.isPending}>
              Create Budget
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Budget Limit"
        description="Adjust the category, limit, or date range for this budget."
      >
        <form onSubmit={handleUpdateSubmit} className="flex flex-col gap-4 mt-1">
          <BudgetFormFields form={form} setForm={setForm} disabled={isFormPending} />
          {formError && <p className="text-[11px] font-mono text-rose-500 font-semibold">{formError}</p>}
          <div className="flex justify-end gap-2.5 mt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditOpen(false)} disabled={isFormPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete this budget?"
        description={`Are you sure you want to delete the "${selectedBudget?.category || 'this'}" budget? This will stop tracking spending against it. This action cannot be undone.`}
        confirmText="Delete Budget"
        isDestructive
        isLoading={deleteMutation.isPending}
      />

      {/* AI Coaching Modal (COMPASS) */}
      <Modal
        isOpen={isCoachOpen}
        onClose={() => setIsCoachOpen(false)}
        title={`COMPASS Coaching — ${selectedBudget?.category || ''}`}
        description="AI-narrated guidance on top of deterministic progress metrics. Advisory only."
        size="lg"
      >
        <div className="flex flex-col gap-4 mt-1 min-h-[140px]">
          {coachMutation.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-16" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : coaching ? (
            <>
              <div className="flex items-center gap-3">
                <div className="text-xs">
                  <span className="font-bold text-slate-100 font-mono">{formatXAF(Number(coaching.spent_amount))}</span>
                  <span className="text-slate-500"> / {formatXAF(Number(coaching.limit_amount))}</span>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    coaching.risk_level === 'EXCEEDED'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : coaching.risk_level === 'WARNING'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {coaching.risk_level}
                </span>
              </div>

              <p className="text-sm text-slate-200 leading-relaxed font-medium">{coaching.message}</p>

              {coaching.tips.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {coaching.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                      <span className="text-gold mt-0.5">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              )}

              {coaching.encouragement && (
                <p className="text-xs text-gold font-semibold italic">{coaching.encouragement}</p>
              )}
            </>
          ) : formError ? (
            <p className="text-xs text-rose-400 font-medium">{formError}</p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

interface BudgetFormFieldsProps {
  form: ReturnType<typeof emptyBudgetForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyBudgetForm>>>;
  disabled: boolean;
}

function BudgetFormFields({ form, setForm, disabled }: BudgetFormFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="budgetCategory" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
          Category
        </label>
        <select
          id="budgetCategory"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          disabled={disabled}
          className="w-full bg-slate-950/60 border border-slate-800 text-sm text-slate-100 rounded-xl px-4 py-3 transition-all focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold cursor-pointer"
        >
          {BUDGET_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      <Input
        label="Limit Amount (FCFA)"
        type="number"
        min="1"
        placeholder="e.g. 100000"
        value={form.limit_amount}
        onChange={(e) => setForm((f) => ({ ...f, limit_amount: e.target.value }))}
        disabled={disabled}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Start Date"
          type="date"
          value={form.start_date}
          onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
          disabled={disabled}
          required
        />
        <Input
          label="End Date"
          type="date"
          value={form.end_date}
          onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
          disabled={disabled}
          required
        />
      </div>
    </>
  );
}
