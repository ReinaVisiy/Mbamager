import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/common/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { accountsService } from '../services/accounts';
import { financeService } from '../services/finance';
import { notificationsService } from '../services/notifications';
import { formatXAF, formatDate } from '../utils/format';
import { 
  User, 
  Phone, 
  Calendar, 
  Wallet, 
  PiggyBank, 
  Bell, 
  TrendingUp,
  ShieldCheck,
  Building,
  Pencil,
  Save,
  X
} from 'lucide-react';
import { Skeleton } from '../components/ui/SkeletonLoader';

export default function Profile() {
  const { currentUser, updateProfile } = useAuthStore();
  const toast = useToastStore();

  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formValues, setFormValues] = React.useState({
    username: currentUser?.username || '',
    phone_number: currentUser?.phone_number || '',
    email: currentUser?.email || '',
  });

  // Keep the local form in sync whenever the stored profile changes
  // (e.g. after a save, or if it's loaded/refreshed elsewhere).
  React.useEffect(() => {
    if (!isEditing) {
      setFormValues({
        username: currentUser?.username || '',
        phone_number: currentUser?.phone_number || '',
        email: currentUser?.email || '',
      });
    }
  }, [currentUser, isEditing]);

  const startEditing = () => {
    setFormError(null);
    setFormValues({
      username: currentUser?.username || '',
      phone_number: currentUser?.phone_number || '',
      email: currentUser?.email || '',
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setFormError(null);
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    setFormError(null);
    setIsSaving(true);
    try {
      const updates: { username?: string; phone_number?: string; email?: string } = {};
      if (formValues.username !== (currentUser?.username || '')) updates.username = formValues.username;
      if (formValues.phone_number !== (currentUser?.phone_number || '')) updates.phone_number = formValues.phone_number;
      if (formValues.email !== (currentUser?.email || '')) updates.email = formValues.email;

      if (Object.keys(updates).length === 0) {
        setIsEditing(false);
        return;
      }

      await updateProfile(updates);
      toast.success('Your profile has been updated successfully.');
      setIsEditing(false);
    } catch (err: any) {
      const message = err?.message || 'Failed to update profile.';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Load accounts for financial summary stats
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts', 'profile-stats'],
    queryFn: () => accountsService.getAll(),
  });

  // Load savings goals for stats
  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['goals', 'profile-stats'],
    queryFn: () => financeService.getGoals(),
  });

  // Load unread notifications for stats
  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications', 'profile-stats'],
    queryFn: () => notificationsService.getNotifications(),
  });

  const isLoading = accountsLoading || goalsLoading || notificationsLoading;

  // Aggregate stats
  const totalBalance = accounts.reduce((acc, curr) => acc + (curr.balance || 0), 0);
  const activeGoalsCount = goals.filter(g => g.status === 'ACTIVE').length;
  const unreadNotifsCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <PageHeader
        title="User Identity Profile"
        description="Verify your authenticated identity, secure keys, connected assets, and financial profile telemetry."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border-slate-900 bg-slate-950/40 text-center py-8 px-6">
            <CardContent className="space-y-4">
              {/* Profile Graphic / Avatar */}
              <div className="relative w-24 h-24 mx-auto bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-950/40">
                <span className="text-3xl font-extrabold text-slate-950 select-none uppercase">
                  {currentUser?.username?.charAt(0) || 'U'}
                </span>
                <div className="absolute bottom-0 right-0 p-1.5 bg-slate-900 border-2 border-slate-950 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <h2 className="text-base font-extrabold text-slate-100">{currentUser?.username || 'Authenticated User'}</h2>
                <p className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                  Mbamager Operator ID: #{currentUser?.id || '0000'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-900/60 space-y-2 text-left">
                <div className="flex items-center gap-2.5 text-xs text-slate-400">
                  <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="font-mono">{currentUser?.phone_number || '+237'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-400">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Joined {currentUser?.created_at ? formatDate(currentUser.created_at) : 'recently'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Banner Card */}
          <Card className="border-emerald-500/10 bg-emerald-500/5 p-4.5 rounded-3xl">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-300 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-300">Identity Encrypted</h4>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400/80 leading-relaxed">
                  Your security tokens, linked mobile money endpoints, and processed SMS transactions are encrypted end-to-end on our secure servers.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side: Financial Stats & Settings Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Live Financial Profile Dashboard */}
          <Card className="border-slate-900 bg-slate-950/40">
            <CardHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <TrendingUp className="w-4.5 h-4.5 text-emerald-400" />
                <CardTitle className="text-sm font-bold text-slate-200">Financial Profile Telemetry</CardTitle>
              </div>
              <CardDescription className="text-[11px]">
                Real-time aggregated telemetry across all active accounts and wallets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="p-4 border border-slate-900 rounded-2xl space-y-2">
                      <Skeleton className="h-3 w-1/3 bg-slate-800 rounded" />
                      <Skeleton className="h-6 w-2/3 bg-slate-800 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Total Balance */}
                  <div className="p-4.5 border border-slate-900/60 bg-slate-900/20 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Net Worth</div>
                      <div className="text-sm font-extrabold text-slate-100 font-mono mt-0.5">{formatXAF(totalBalance)}</div>
                    </div>
                  </div>

                  {/* Connected Accounts */}
                  <div className="p-4.5 border border-slate-900/60 bg-slate-900/20 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Accounts Linked</div>
                      <div className="text-sm font-extrabold text-slate-100 font-mono mt-0.5">{accounts.length} Wallets</div>
                    </div>
                  </div>

                  {/* Active Saving Goals */}
                  <div className="p-4.5 border border-slate-900/60 bg-slate-900/20 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 rounded-xl">
                      <PiggyBank className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Active Savings Goals</div>
                      <div className="text-sm font-extrabold text-slate-100 font-mono mt-0.5">{activeGoalsCount} Targets</div>
                    </div>
                  </div>

                  {/* Alerts Pending */}
                  <div className="p-4.5 border border-slate-900/60 bg-slate-900/20 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Unread Alerts</div>
                      <div className="text-sm font-extrabold text-slate-100 font-mono mt-0.5">{unreadNotifsCount} Items</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Details - editable */}
          <Card className="border-slate-900 bg-slate-950/40">
            <CardHeader>
              <div className="flex items-center justify-between gap-2.5 mb-1">
                <div className="flex items-center gap-2.5">
                  <User className="w-4.5 h-4.5 text-emerald-400" />
                  <CardTitle className="text-sm font-bold text-slate-200">Personal Configurations</CardTitle>
                </div>
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 cursor-pointer"
                    onClick={startEditing}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                )}
              </div>
              <CardDescription className="text-[11px]">
                {isEditing
                  ? 'Update your name, phone, or email. Leave a field as-is to keep it unchanged.'
                  : 'Your security profile settings.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Primary Operator Name"
                      value={formValues.username}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, username: e.target.value }))}
                      disabled={isSaving}
                    />
                    <Input
                      label="Registered Phone Link"
                      value={formValues.phone_number}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="+2376XXXXXXXX"
                      disabled={isSaving}
                    />
                  </div>
                  <Input
                    label="Email Address"
                    type="email"
                    value={formValues.email}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="you@example.com"
                    disabled={isSaving}
                    error={formError || undefined}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      className="gap-1.5 cursor-pointer"
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                    >
                      <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 cursor-pointer"
                      onClick={cancelEditing}
                      disabled={isSaving}
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Primary Operator Name</div>
                    <div className="p-3 border border-slate-900 bg-slate-950 rounded-xl text-xs text-slate-300 font-semibold">
                      {currentUser?.username || 'Guest'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Registered Phone Link</div>
                    <div className="p-3 border border-slate-900 bg-slate-950 rounded-xl text-xs text-slate-300 font-mono">
                      {currentUser?.phone_number || '+237'}
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Email Address</div>
                    <div className="p-3 border border-slate-900 bg-slate-950 rounded-xl text-xs text-slate-300 font-mono">
                      {currentUser?.email || 'Not set'}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono mb-1">Account Privilege Rank</div>
                <div className="p-4 bg-slate-900/10 border border-slate-900 rounded-2xl flex items-center justify-between text-xs">
                  <span className="text-slate-400">Security Group:</span>
                  <span className="font-mono font-bold text-emerald-400">ADMINISTRATIVE SUPER-USER</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
