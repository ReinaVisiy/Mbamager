import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CreditCard, 
  Check, 
  X, 
  AlertTriangle, 
  RefreshCcw, 
  Info,
  Calendar,
  Building2,
  Coins,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Filter
} from 'lucide-react';

import { PageHeader } from '../components/common/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ErrorState } from '../components/common/ErrorState';
import { Skeleton } from '../components/ui/SkeletonLoader';
import { useAuthStore } from '../store/authStore';
import { formatXAF, formatDate } from '../utils/format';
import { accountsService, CreateAccountPayload, UpdateAccountPayload } from '../services/accounts';
import { dashboardService } from '../services/dashboard';
import { Account, AccountType, AccountProvider } from '../types';

// Provider aesthetic configurations
const getProviderMeta = (provider: AccountProvider) => {
  const prov = String(provider).toUpperCase();
  if (prov.includes('MTN')) {
    return {
      name: 'MTN Mobile Money',
      bgClass: 'from-gold-500/15 via-yellow-500/5 to-slate-900/10 border-yellow-500/20 hover:border-yellow-500/40',
      badgeClass: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20 dark:text-yellow-400',
      iconColor: 'text-yellow-500',
    };
  }
  if (prov.includes('ORANGE')) {
    return {
      name: 'Orange Money',
      bgClass: 'from-orange-500/15 via-orange-500/5 to-slate-900/10 border-orange-500/20 hover:border-orange-500/40',
      badgeClass: 'bg-orange-500/15 text-orange-600 border-orange-500/20 dark:text-orange-400',
      iconColor: 'text-orange-500',
    };
  }
  if (prov.includes('EU') || prov.includes('EXPRESS') || prov.includes('SOCIETE') || prov.includes('BICEC') || prov.includes('UBA')) {
    return {
      name: provider.replace(/_/g, ' '),
      bgClass: 'from-gold-500/15 via-gold-500/5 to-slate-900/10 border-gold-500/20 hover:border-gold-500/40',
      badgeClass: 'bg-gold-50 text-gold border-gold/20 dark:bg-gold-500/10 dark:text-gold',
      iconColor: 'text-gold',
    };
  }
  if (prov.includes('CASH')) {
    return {
      name: 'Cash Wallet',
      bgClass: 'from-emerald-500/15 via-emerald-500/5 to-slate-900/10 border-emerald-500/20 hover:border-emerald-500/40',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
      iconColor: 'text-emerald-500',
    };
  }
  return {
    name: provider.replace(/_/g, ' '),
    bgClass: 'from-slate-700/10 via-slate-700/5 to-slate-900/10 border-slate-800 hover:border-slate-700',
    badgeClass: 'bg-slate-800/60 text-slate-400 border-slate-700',
    iconColor: 'text-slate-400',
  };
};

const getAccountTypeLabel = (type: AccountType) => {
  switch (type) {
    case 'MOBILE_MONEY': return 'Mobile Wallet';
    case 'BANK': return 'Digital Banking';
    case 'CASH': return 'Physical Vault';
    default: return 'Other Asset';
  }
};

export default function Accounts() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterActiveOnly, setFilterActiveOnly] = React.useState(false);
  const [providerFilter, setProviderFilter] = React.useState<string>('ALL');

  // Modal control states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [selectedAccount, setSelectedAccount] = React.useState<Account | null>(null);

  // Form field states
  const [formName, setFormName] = React.useState('');
  const [formType, setFormType] = React.useState<AccountType>('MOBILE_MONEY');
  const [formProvider, setFormProvider] = React.useState<AccountProvider>('MTN_MOMO');
  const [formCurrency, setFormCurrency] = React.useState('XAF');
  const [formIsActive, setFormIsActive] = React.useState(true);
  const [formError, setFormError] = React.useState<string | null>(null);

  // 1. Fetch Accounts
  const { 
    data: accounts, 
    isLoading: isAccountsLoading, 
    isError: isAccountsError, 
    refetch: refetchAccounts 
  } = useQuery({
    queryKey: ['dashboardAccounts'],
    queryFn: () => accountsService.getAll()
  });

  // 2. Fetch Dashboard Summary to display actual calculated transaction balances
  const { 
    data: summary,
    refetch: refetchSummary
  } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: () => dashboardService.getSummary()
  });

  const handleRefreshAll = async () => {
    await Promise.all([refetchAccounts(), refetchSummary()]);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateAccountPayload) => accountsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || err.message || 'Failed to establish new account.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateAccountPayload }) => 
      accountsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsEditOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || err.message || 'Failed to update account.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => accountsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsDeleteOpen(false);
      setSelectedAccount(null);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || err.message || 'Failed to drop account connection.');
    }
  });

  const resetForm = () => {
    setFormName('');
    setFormType('MOBILE_MONEY');
    setFormProvider('MTN_MOMO');
    setFormCurrency('XAF');
    setFormIsActive(true);
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (account: Account) => {
    setFormName(account.name);
    setFormType(account.type || account.account_type || 'MOBILE_MONEY');
    setFormProvider(account.provider || 'MTN_MOMO');
    setFormCurrency(account.currency || 'XAF');
    setFormIsActive(account.is_active);
    setFormError(null);
    setSelectedAccount(account);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (account: Account) => {
    setSelectedAccount(account);
    setIsDeleteOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Account name is required.');
      return;
    }

    if (!user?.id) {
      setFormError('Session invalid. Please log in again.');
      return;
    }

    createMutation.mutate({
      name: formName.trim(),
      account_type: formType,
      provider: formProvider,
      currency: formCurrency.toUpperCase(),
      is_active: formIsActive,
      user_id: user.id
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Account name is required.');
      return;
    }

    if (!selectedAccount) return;

    updateMutation.mutate({
      id: selectedAccount.id,
      payload: {
        name: formName.trim(),
        account_type: formType,
        provider: formProvider,
        currency: formCurrency.toUpperCase(),
        is_active: formIsActive
      }
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedAccount) return;
    deleteMutation.mutate(selectedAccount.id);
  };

  // Filter and search logic
  const filteredAccounts = React.useMemo(() => {
    if (!accounts) return [];

    return accounts.filter(acc => {
      // 1. Search filter (Name or Provider)
      const matchesSearch = 
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.provider.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Active filter
      const matchesActive = !filterActiveOnly || acc.is_active;

      // 3. Provider Type Filter
      let matchesProvider = true;
      if (providerFilter !== 'ALL') {
        if (providerFilter === 'MOMO') {
          matchesProvider = acc.provider === 'MTN_MOMO' || acc.provider === 'ORANGE_MONEY';
        } else if (providerFilter === 'BANK') {
          matchesProvider = acc.provider === 'BANK' || ['SOCIETE_GENERALE', 'BICEC', 'UBA'].includes(acc.provider);
        } else if (providerFilter === 'CASH') {
          matchesProvider = acc.provider === 'CASH';
        } else {
          matchesProvider = acc.provider === providerFilter;
        }
      }

      return matchesSearch && matchesActive && matchesProvider;
    });
  }, [accounts, searchQuery, filterActiveOnly, providerFilter]);

  if (isAccountsError) {
    return (
      <div className="py-12 max-w-xl mx-auto">
        <ErrorState 
          title="Account Synchronization Failed" 
          message="We were unable to establish a secure link with your Mbamager local API. Ensure your backend server is online." 
          onRetry={handleRefreshAll}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Mobile Wallets & Bank Accounts"
        description="Configure your Mobile Money networks, digital banking ledgers, and cash containers."
        action={
          <Button variant="primary" size="sm" className="gap-2 shrink-0" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            Integrate Wallet
          </Button>
        }
      />

      {/* FILTER CONTROL PANEL */}
      <Card className="border border-slate-900 bg-slate-950/40">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Search bar */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              id="accountSearchInput"
              placeholder="Search by account display name or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-900 text-xs text-slate-200 placeholder-slate-600 rounded-xl pl-10 pr-4 py-2.5 transition-all focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/50"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Categorized Filter controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex bg-slate-950 border border-slate-900 rounded-xl p-1 shrink-0">
              <button
                id="providerFilterAll"
                onClick={() => setProviderFilter('ALL')}
                className={`px-3 py-1.5 text-[10px] font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                  providerFilter === 'ALL'
                    ? 'bg-gold text-white shadow-md shadow-gold-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Providers
              </button>
              <button
                id="providerFilterMomo"
                onClick={() => setProviderFilter('MOMO')}
                className={`px-3 py-1.5 text-[10px] font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                  providerFilter === 'MOMO'
                    ? 'bg-gold text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mobile Money
              </button>
              <button
                id="providerFilterBank"
                onClick={() => setProviderFilter('BANK')}
                className={`px-3 py-1.5 text-[10px] font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                  providerFilter === 'BANK'
                    ? 'bg-gold text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Banks
              </button>
              <button
                id="providerFilterCash"
                onClick={() => setProviderFilter('CASH')}
                className={`px-3 py-1.5 text-[10px] font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                  providerFilter === 'CASH'
                    ? 'bg-gold text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cash
              </button>
            </div>

            {/* Active Switch */}
            <button
              id="filterActiveOnlyToggle"
              onClick={() => setFilterActiveOnly(!filterActiveOnly)}
              className={`flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                filterActiveOnly 
                  ? 'bg-gold-50/20 text-gold border-gold/30' 
                  : 'bg-slate-950 text-slate-400 border-slate-900 hover:text-slate-200 hover:border-slate-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${filterActiveOnly ? 'bg-gold animate-pulse' : 'bg-slate-600'}`} />
              Active Only
            </button>

            {/* Manual Sync Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              title="Sync Account Records"
              className="h-9 px-3 shrink-0"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SKELETON LOADER GRID */}
      {isAccountsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-44 rounded-3xl" />
        </div>
      ) : filteredAccounts.length === 0 ? (
        /* EMPTY STATE DISPLAY */
        <Card className="border border-slate-800 border-dashed bg-slate-900/20 p-12 text-center rounded-3xl max-w-xl mx-auto mt-6">
          <div className="p-4 bg-gold-50 border border-gold-200/40 text-gold rounded-2xl w-fit mx-auto mb-4.5 dark:bg-gold-500/10 dark:border-gold-500/20">
            <CreditCard className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 tracking-tight">No Accounts Registered</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
            Configure your MTN Mobile Money network, Orange Money SIM, cash boxes, or banking accounts to automatically parsing receipts and synchronise balance tracking.
          </p>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleOpenCreate} 
            className="mt-6 gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Establish First Account
          </Button>
        </Card>
      ) : (
        /* ACCOUNTS CARD GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAccounts.map((account) => {
            const meta = getProviderMeta(account.provider);
            const dynamicBalance = summary?.account_balances?.[account.id] ?? account.balance ?? 0;
            const typeLabel = getAccountTypeLabel(account.type || account.account_type || 'MOBILE_MONEY');

            return (
              <Card 
                key={account.id} 
                hoverEffect 
                className={`bg-gradient-to-br ${meta.bgClass} relative overflow-hidden flex flex-col justify-between min-h-[180px] p-5.5 rounded-3xl border`}
              >
                <div>
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1">
                      <span className={`text-[9px] font-black font-mono px-2 py-0.5 border rounded-full uppercase tracking-widest ${meta.badgeClass}`}>
                        {meta.name}
                      </span>
                      <h3 className="text-sm font-bold text-slate-100 tracking-tight pt-1 truncate max-w-[180px]">
                        {account.name}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium font-mono">
                        Type: {typeLabel}
                      </p>
                    </div>

                    {/* Status & Menu Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase text-slate-400">
                        <span className={`w-1.5 h-1.5 rounded-full ${account.is_active ? 'bg-gold animate-pulse' : 'bg-slate-500'}`} />
                        {account.is_active ? 'Active' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 text-xl font-black text-slate-100 tracking-tight font-mono">
                    {formatXAF(dynamicBalance)}
                  </div>
                </div>

                <div className="flex justify-between items-center mt-5 pt-3.5 border-t border-slate-900/60 text-[9px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-600" />
                    Sync: {account.created_at ? formatDate(account.created_at) : 'N/A'}
                  </span>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(account)}
                      className="p-1.5 hover:bg-slate-900/60 text-slate-400 hover:text-gold border border-transparent hover:border-slate-800 rounded-lg cursor-pointer transition-all"
                      title="Edit Account"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenDelete(account)}
                      className="p-1.5 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-950/50 rounded-lg cursor-pointer transition-all"
                      title="Delete Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE ACCOUNT MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Integrate Account & Wallet"
        description="Connect a new mobile network SIM, digital bank, or offline cash container ledger."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-3">
          {formError && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl text-xs text-rose-400 font-semibold mb-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="ACCOUNT DISPLAY NAME"
            type="text"
            placeholder="e.g. MTN Mobile Money SIM 1"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            disabled={createMutation.isPending}
            maxLength={64}
            required
            helperText="An identifiable display name shown inside the ledger hub"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="createAccountType" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
                Account Type
              </label>
              <select
                id="createAccountType"
                value={formType}
                onChange={(e) => setFormType(e.target.value as AccountType)}
                disabled={createMutation.isPending}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 cursor-pointer"
              >
                <option value="MOBILE_MONEY">Mobile Money Wallet</option>
                <option value="BANK">Digital Banking Ledger</option>
                <option value="CASH">Physical Cash Container</option>
                <option value="OTHER">Other Financial Asset</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="createAccountProvider" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
                Financial Network Provider
              </label>
              <select
                id="createAccountProvider"
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value as AccountProvider)}
                disabled={createMutation.isPending}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 cursor-pointer"
              >
                <option value="MTN_MOMO">MTN Mobile Money</option>
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="BANK">Commercial Bank</option>
                <option value="CASH">Cash Drawer</option>
                <option value="OTHER">Other Network</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="CURRENCY CODE"
              type="text"
              placeholder="XAF"
              value={formCurrency}
              onChange={(e) => setFormCurrency(e.target.value)}
              disabled={createMutation.isPending}
              maxLength={3}
              required
              helperText="ISO 3-Letter currency code (Default: XAF)"
            />

            <div className="flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase mb-1.5">
                Operating Status
              </span>
              <label className="flex items-center gap-3 bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs text-slate-300 font-medium cursor-pointer transition-colors hover:border-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  disabled={createMutation.isPending}
                  className="rounded border-slate-800 bg-slate-950 text-gold-500 focus:ring-gold-500 w-4 h-4 cursor-pointer accent-gold-500"
                />
                <span>Account is currently active</span>
              </label>
            </div>
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
              Connect Wallet
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT ACCOUNT MODAL */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Modify Connection Details"
        description="Update labels, currencies, or offline/active flags for the synced wallet."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 pt-3">
          {formError && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl text-xs text-rose-400 font-semibold mb-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="ACCOUNT DISPLAY NAME"
            type="text"
            placeholder="e.g. Personal MTN Mobile Money"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            disabled={updateMutation.isPending}
            maxLength={64}
            required
            helperText="The display label shown in dashboard bento cards"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="editAccountType" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
                Account Type
              </label>
              <select
                id="editAccountType"
                value={formType}
                onChange={(e) => setFormType(e.target.value as AccountType)}
                disabled={updateMutation.isPending}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 cursor-pointer"
              >
                <option value="MOBILE_MONEY">Mobile Money Wallet</option>
                <option value="BANK">Digital Banking Ledger</option>
                <option value="CASH">Physical Cash Container</option>
                <option value="OTHER">Other Financial Asset</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="editAccountProvider" className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">
                Financial Network Provider
              </label>
              <select
                id="editAccountProvider"
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value as AccountProvider)}
                disabled={updateMutation.isPending}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 cursor-pointer"
              >
                <option value="MTN_MOMO">MTN Mobile Money</option>
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="BANK">Commercial Bank</option>
                <option value="CASH">Cash Drawer</option>
                <option value="OTHER">Other Network</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="CURRENCY CODE"
              type="text"
              placeholder="XAF"
              value={formCurrency}
              onChange={(e) => setFormCurrency(e.target.value)}
              disabled={updateMutation.isPending}
              maxLength={3}
              required
              helperText="ISO 3-Letter currency code"
            />

            <div className="flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase mb-1.5">
                Operating Status
              </span>
              <label className="flex items-center gap-3 bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs text-slate-300 font-medium cursor-pointer transition-colors hover:border-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  disabled={updateMutation.isPending}
                  className="rounded border-slate-800 bg-slate-950 text-gold-500 focus:ring-gold-500 w-4 h-4 cursor-pointer accent-gold-500"
                />
                <span>Account is currently active</span>
              </label>
            </div>
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
        title="Confirm Disconnection"
        description={`Are you absolutely sure you want to disconnect and delete the account "${selectedAccount?.name || 'this account'}"? This action is irreversible and will purge its entire transactional ledger history and balance tracking.`}
        confirmText="Disconnect & Drop"
        cancelText="Keep Connected"
        isDestructive
      />
    </div>
  );
}
