import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Trash2,
  Users,
  Check,
  X,
  Calendar,
  Coins,
  AlertTriangle,
  Filter,
  CheckCircle2,
  Hourglass,
  Crown,
  UserPlus,
  Gift,
  Circle,
  CheckCircle,
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
  tontineService,
  CreateTontineGroupPayload,
} from '../services/tontine';
import { TontineGroup, TontineFrequency, TontineGroupStatus } from '../types';

export default function Tontine() {
  const queryClient = useQueryClient();

  // Search & filter state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | TontineGroupStatus>('ALL');

  // Modal control state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [manageGroup, setManageGroup] = React.useState<TontineGroup | null>(null);
  const [selectedGroup, setSelectedGroup] = React.useState<TontineGroup | null>(null);

  // Create form state
  const [formName, setFormName] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [formAmount, setFormAmount] = React.useState<number>(0);
  const [formFrequency, setFormFrequency] = React.useState<TontineFrequency>('MONTHLY');
  const [formError, setFormError] = React.useState<string | null>(null);

  const { data: groups, isLoading, isError, refetch } = useQuery({
    queryKey: ['tontineGroups'],
    queryFn: () => tontineService.getGroups(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateTontineGroupPayload) => tontineService.createGroup(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tontineGroups'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err?.message || 'Failed to create the tontine group.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tontineService.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tontineGroups'] });
      setIsDeleteOpen(false);
      setSelectedGroup(null);
    },
    onError: (err: any) => {
      alert(err?.message || 'Failed to delete the tontine group.');
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormAmount(0);
    setFormFrequency('MONTHLY');
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenDelete = (group: TontineGroup) => {
    setSelectedGroup(group);
    setIsDeleteOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Group name is required');
      return;
    }
    if (formAmount <= 0) {
      setFormError('Contribution amount must be greater than 0');
      return;
    }
    createMutation.mutate({
      name: formName,
      description: formDescription.trim() || undefined,
      contribution_amount: formAmount,
      frequency: formFrequency,
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedGroup) return;
    deleteMutation.mutate(selectedGroup.id);
  };

  const filteredGroups = React.useMemo(() => {
    if (!groups) return [];
    return groups.filter((g) => {
      const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || g.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [groups, searchQuery, statusFilter]);

  const stats = React.useMemo(() => {
    if (!groups || groups.length === 0) {
      return { total: 0, active: 0, completed: 0, activeMonthlyValue: 0 };
    }
    const active = groups.filter((g) => g.status === 'ACTIVE').length;
    const completed = groups.filter((g) => g.status === 'COMPLETED').length;
    const activeMonthlyValue = groups
      .filter((g) => g.status === 'ACTIVE')
      .reduce((acc, g) => acc + Number(g.contribution_amount), 0);
    return { total: groups.length, active, completed, activeMonthlyValue };
  }, [groups]);

  const statusBadgeClasses = (status: TontineGroupStatus) =>
    status === 'COMPLETED'
      ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
      : status === 'CANCELLED'
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Njangi / Tontine Groups"
        description="Run rotating savings circles: collect fixed contributions each cycle and hand the pot to whoever's turn it is."
        action={
          <Button variant="primary" size="sm" className="gap-2" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            New Group
          </Button>
        }
      />

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/40 border-slate-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Total Groups</span>
              <p className="text-lg font-bold text-slate-200">{stats.total}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-violet-400">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Active Cycles/mo</span>
              <p className="text-lg font-bold text-gold">{formatXAF(stats.activeMonthlyValue)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-gold">
              <Coins className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Active Groups</span>
              <p className="text-lg font-bold text-amber-500">{stats.active}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-amber-500">
              <Hourglass className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Completed Groups</span>
              <p className="text-lg font-bold text-sky-400">{stats.completed}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sky-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar / Search & Filters */}
      <Card className="bg-slate-900/20 border-slate-800/60">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search tontine groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto self-end sm:self-auto justify-end">
            <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
            {(['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className="text-[11px] px-3 py-1"
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Tontine Groups"
          message="A network exception occurred while fetching your rotating savings groups."
          onRetry={refetch}
        />
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchQuery ? 'No groups match search' : 'No tontine groups yet'}
          description={
            searchQuery
              ? 'Try adjusting your search or status filters.'
              : "Start a Njangi with friends, family, or colleagues — you'll be added as the first member automatically."
          }
          actionText={searchQuery ? undefined : 'Create Your First Group'}
          onAction={searchQuery ? undefined : handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGroups.map((group) => (
            <Card
              key={group.id}
              className="relative overflow-hidden bg-slate-900/30 border-slate-800 hover:border-slate-700 transition-all"
            >
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-100 tracking-tight">{group.name}</h4>
                    {group.description && (
                      <p className="text-[10px] text-slate-500 font-medium line-clamp-1">{group.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>Started {formatDate(group.start_date)}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${statusBadgeClasses(group.status)}`}>
                    {group.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-800/60">
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-500">Per Cycle</span>
                    <p className="text-xs font-bold text-gold">{formatXAF(group.contribution_amount)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-500">Frequency</span>
                    <p className="text-xs font-bold text-slate-300">{group.frequency}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-500">Cycle</span>
                    <p className="text-xs font-bold text-slate-300">#{group.current_cycle}</p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-2.5 bg-slate-950/30 border-t border-slate-800/40 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setManageGroup(group)}
                  className="h-7 gap-1.5 text-slate-400 hover:text-gold"
                >
                  <Users className="w-3.5 h-3.5" />
                  Manage
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDelete(group)}
                  className="h-7 gap-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create a Tontine / Njangi Group">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Group Name</label>
            <Input
              placeholder="e.g. Family Njangi"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="h-10 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Description (optional)</label>
            <Input
              placeholder="e.g. Monthly circle with cousins"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="h-10 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contribution / Cycle (FCFA)</label>
              <Input
                type="number"
                placeholder="e.g. 10000"
                value={formAmount || ''}
                onChange={(e) => setFormAmount(Number(e.target.value))}
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Frequency</label>
              <select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value as TontineFrequency)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl h-10 px-3 text-xs outline-none focus:border-slate-700"
              >
                <option value="WEEKLY">WEEKLY</option>
                <option value="BIWEEKLY">BIWEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
              </select>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            You'll be added automatically as the first member (rotation position 1). Add the rest of the group after creating it.
          </p>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={createMutation.isPending}>
              Create Group
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Tontine Group"
        description={`Are you sure you want to delete "${selectedGroup?.name}"? All members, contributions, and payout history will be permanently deleted. This cannot be undone.`}
        confirmText="Permanently Delete"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
      />

      {/* MANAGE GROUP MODAL */}
      {manageGroup && (
        <ManageGroupModal group={manageGroup} onClose={() => setManageGroup(null)} />
      )}
    </div>
  );
}

interface ManageGroupModalProps {
  group: TontineGroup;
  onClose: () => void;
}

function ManageGroupModal({ group, onClose }: ManageGroupModalProps) {
  const queryClient = useQueryClient();
  const [newMemberName, setNewMemberName] = React.useState('');
  const [actionError, setActionError] = React.useState<string | null>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['tontineGroups'] });
    queryClient.invalidateQueries({ queryKey: ['tontineMembers', group.id] });
    queryClient.invalidateQueries({ queryKey: ['tontineCycle', group.id] });
  };

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['tontineMembers', group.id],
    queryFn: () => tontineService.getMembers(group.id),
  });

  const { data: cycle, isLoading: cycleLoading } = useQuery({
    queryKey: ['tontineCycle', group.id, group.current_cycle],
    queryFn: () => tontineService.getCycleStatus(group.id, group.current_cycle),
  });

  const addMemberMutation = useMutation({
    mutationFn: () => tontineService.addMember(group.id, { display_name: newMemberName }),
    onSuccess: () => {
      setNewMemberName('');
      setActionError(null);
      invalidateAll();
    },
    onError: (err: any) => setActionError(err?.message || 'Failed to add member.'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: number) => tontineService.removeMember(group.id, memberId),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (err: any) => setActionError(err?.message || 'Failed to remove member.'),
  });

  const recordContributionMutation = useMutation({
    mutationFn: (memberId: number) => tontineService.recordContribution(group.id, { member_id: memberId }),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (err: any) => setActionError(err?.message || 'Failed to record contribution.'),
  });

  const recordPayoutMutation = useMutation({
    mutationFn: () => tontineService.recordPayout(group.id),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (err: any) => setActionError(err?.message || 'Failed to record payout.'),
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      setActionError('Member name is required');
      return;
    }
    addMemberMutation.mutate();
  };

  const recipient = members?.find((m) => m.payout_position === group.current_cycle);

  return (
    <Modal isOpen onClose={onClose} title={group.name} description={`Cycle ${group.current_cycle} • ${group.frequency} • ${formatXAF(group.contribution_amount)} per member`} size="lg">
      <div className="space-y-5">
        {actionError && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Cycle summary */}
        {cycleLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : cycle ? (
          <Card className="bg-slate-950/40 border-slate-800/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-500">Collected This Cycle</span>
                <p className="text-sm font-bold text-slate-100">
                  {formatXAF(cycle.collected_total)} <span className="text-slate-500 font-normal text-xs">/ {formatXAF(cycle.expected_total)}</span>
                </p>
              </div>
              <div className="space-y-0.5 text-right">
                <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-500">This Cycle's Payout Goes To</span>
                <p className="text-sm font-bold text-gold flex items-center gap-1.5 justify-end">
                  <Crown className="w-3.5 h-3.5" />
                  {recipient?.display_name || '—'}
                </p>
              </div>
            </div>

            <div className="w-full bg-slate-950/60 border border-slate-800/40 rounded-full h-2 overflow-hidden shadow-inner mt-3">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  cycle.all_members_paid ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-gold to-gold-300'
                }`}
                style={{ width: `${Math.min(100, (Number(cycle.collected_total) / Math.max(1, Number(cycle.expected_total))) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className={`text-[10px] font-semibold flex items-center gap-1.5 ${cycle.all_members_paid ? 'text-emerald-400' : 'text-slate-500'}`}>
                {cycle.all_members_paid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Hourglass className="w-3.5 h-3.5" />}
                {cycle.payout_made
                  ? 'Payout already made for this cycle'
                  : cycle.all_members_paid
                  ? 'Everyone has paid — ready for payout'
                  : 'Waiting on remaining members'}
              </span>

              {group.status === 'ACTIVE' && cycle.all_members_paid && !cycle.payout_made && (
                <Button
                  variant="success"
                  size="sm"
                  className="gap-1.5 h-8 text-[11px]"
                  onClick={() => recordPayoutMutation.mutate()}
                  isLoading={recordPayoutMutation.isPending}
                >
                  <Gift className="w-3.5 h-3.5" />
                  Pay Out Cycle {group.current_cycle}
                </Button>
              )}
            </div>
          </Card>
        ) : null}

        {/* Add member form */}
        <form onSubmit={handleAddMember} className="flex items-center gap-2">
          <Input
            placeholder="Add a member (e.g. Cousin Ada)"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            className="h-9 text-xs flex-1"
          />
          <Button variant="secondary" size="sm" type="submit" className="h-9 gap-1.5 shrink-0" isLoading={addMemberMutation.isPending}>
            <UserPlus className="w-3.5 h-3.5" />
            Add
          </Button>
        </form>

        {/* Members list */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {membersLoading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : members && members.length > 0 ? (
            members.map((member) => {
              const cycleMember = cycle?.members.find((m) => m.member_id === member.id);
              const hasPaid = cycleMember?.has_paid ?? false;
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-slate-500 w-5 text-center shrink-0">#{member.payout_position}</span>
                    <span className="text-xs font-bold text-slate-200 truncate">{member.display_name}</span>
                    {member.has_received_payout && (
                      <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full border bg-gold-500/10 text-gold border-gold-500/20 shrink-0">
                        Paid Out
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasPaid ? (
                      <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Paid
                      </span>
                    ) : group.status === 'ACTIVE' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] gap-1 text-slate-400 hover:text-gold"
                        onClick={() => recordContributionMutation.mutate(member.id)}
                        isLoading={recordContributionMutation.isPending}
                      >
                        <Circle className="w-3 h-3" />
                        Mark Paid
                      </Button>
                    ) : (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <X className="w-3.5 h-3.5" /> Unpaid
                      </span>
                    )}

                    {!member.has_received_payout && (
                      <button
                        onClick={() => removeMemberMutation.mutate(member.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 cursor-pointer transition-colors"
                        aria-label={`Remove ${member.display_name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500 text-center py-6">No members yet.</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
            <Check className="w-3.5 h-3.5" />
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
