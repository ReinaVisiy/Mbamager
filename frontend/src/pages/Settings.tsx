import * as React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useThemeStore } from '../store/themeStore';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { authStorage } from '../utils/format';
import { 
  Settings as SettingsIcon, 
  Save, 
  Palette, 
  Coins, 
  BellRing, 
  Clock, 
  ShieldCheck,
  Smartphone,
  Sparkles
} from 'lucide-react';

export default function Settings() {
  const { theme, setTheme } = useThemeStore();
  const { settings, updateSettings } = useAppStore();
  const { setRememberSession } = useAuthStore();
  const toast = useToastStore();

  // Local state for notification preferences (not in core settings, we'll store them in a separate local state or localStorage)
  const [notifBudget, setNotifBudget] = React.useState(() => {
    return localStorage.getItem('mb_settings_notif_budget') !== 'false';
  });
  const [notifRecurring, setNotifRecurring] = React.useState(() => {
    return localStorage.getItem('mb_settings_notif_recurring') !== 'false';
  });
  const [notifSms, setNotifSms] = React.useState(() => {
    return localStorage.getItem('mb_settings_notif_sms') !== 'false';
  });

  // Local state for auto-refresh interval
  const [refreshInterval, setRefreshInterval] = React.useState(() => {
    return localStorage.getItem('mb_settings_refresh_interval') || 'none';
  });

  // Local state for session preference - initialized from the actual
  // storage backing (localStorage vs sessionStorage) the active session
  // is using, so this toggle can never drift from reality.
  const [persistSession, setPersistSession] = React.useState(() => {
    return authStorage.isRemembered();
  });

  // Local state for currency preference
  const [selectedCurrency, setSelectedCurrency] = React.useState(settings.preferredCurrency || 'XAF');

  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = () => {
    setIsSaving(true);
    
    // Simulate minor network delay for UI polish
    setTimeout(() => {
      // 1. Update core app store settings
      updateSettings({
        preferredCurrency: selectedCurrency,
      });

      // 2. Persist other settings to localStorage
      localStorage.setItem('mb_settings_notif_budget', String(notifBudget));
      localStorage.setItem('mb_settings_notif_recurring', String(notifRecurring));
      localStorage.setItem('mb_settings_notif_sms', String(notifSms));
      localStorage.setItem('mb_settings_refresh_interval', refreshInterval);

      // 3. Move the live session token/profile between localStorage and
      // sessionStorage to match the preference immediately.
      setRememberSession(persistSession);

      setIsSaving(false);
      toast.success('Your preferences have been saved successfully.');
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <PageHeader
        title="Application Settings"
        description="Configure your financial operating system preferences, UI themes, alerts, and offline configurations."
        action={
          <Button 
            variant="primary" 
            size="sm" 
            className="gap-2 cursor-pointer"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Sidebar inside settings for desktop */}
        <div className="space-y-2 md:col-span-1">
          <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-3xl space-y-1">
            <h3 className="text-xs font-mono font-bold text-slate-500 uppercase px-2 mb-3 tracking-wider">
              System Configuration
            </h3>
            <button className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900/40 text-slate-100 border border-slate-900 flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-emerald-400" />
              General Preferences
            </button>
            <div className="p-3 text-[11px] text-slate-500 leading-relaxed pt-4 border-t border-slate-900 mt-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500/80 mb-1" />
              Adjusting currency preferences, automatic fetch speeds, and alerts keeps Mbamager responsive.
            </div>
          </div>
        </div>

        {/* Setting Modules */}
        <div className="space-y-6 md:col-span-2">
          {/* Appearance Section */}
          <Card className="border-slate-900 bg-slate-950/40">
            <CardHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <Palette className="w-4.5 h-4.5 text-emerald-400" />
                <CardTitle className="text-sm font-bold text-slate-200">System Theme & Appearance</CardTitle>
              </div>
              <CardDescription className="text-[11px]">
                Toggle the aesthetic mode of your operational cockpit interface.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', label: 'Light Mode', desc: 'Crisp & clear' },
                  { value: 'dark', label: 'Dark Mode', desc: 'Eye-safe twilight' },
                  { value: 'system', label: 'System Mode', desc: 'Sync with OS' }
                ].map((mode) => {
                  const active = theme === mode.value;
                  return (
                    <button
                      key={mode.value}
                      onClick={() => setTheme(mode.value as any)}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                        active 
                          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-300 shadow-md shadow-emerald-950/15' 
                          : 'border-slate-900 bg-slate-900/10 text-slate-400 hover:border-slate-800 hover:text-slate-200'
                      }`}
                      aria-pressed={active}
                    >
                      <div className="text-xs font-bold">{mode.label}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">{mode.desc}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Regional & Currency Options */}
          <Card className="border-slate-900 bg-slate-950/40">
            <CardHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <Coins className="w-4.5 h-4.5 text-sky-400" />
                <CardTitle className="text-sm font-bold text-slate-200">Base Currency Display</CardTitle>
              </div>
              <CardDescription className="text-[11px]">
                Set the standard reference currency to perform balance aggregations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA Franc' },
                  { code: 'USD', symbol: '$', name: 'United States Dollar' },
                  { code: 'EUR', symbol: '€', name: 'Euro Union Currency' }
                ].map((curr) => {
                  const active = selectedCurrency === curr.code;
                  return (
                    <button
                      key={curr.code}
                      onClick={() => setSelectedCurrency(curr.code)}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                        active 
                          ? 'border-sky-500/30 bg-sky-500/5 text-white shadow-md shadow-sky-950/15' 
                          : 'border-slate-900 bg-slate-900/10 text-slate-400 hover:border-slate-800 hover:text-slate-200'
                      }`}
                      aria-pressed={active}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{curr.code}</span>
                        <span className="text-xs font-mono font-bold text-slate-500">{curr.symbol}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-1 line-clamp-1">{curr.name}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Alert & Notification Preferences */}
          <Card className="border-slate-900 bg-slate-950/40">
            <CardHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <BellRing className="w-4.5 h-4.5 text-amber-400" />
                <CardTitle className="text-sm font-bold text-slate-200">Alert Configuration</CardTitle>
              </div>
              <CardDescription className="text-[11px]">
                Toggle specific in-app notifications and background triggers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  id: 'budget-warnings',
                  title: 'Critical Budget Warnings',
                  desc: 'Notify me instantly when my spending crosses 80% or 100% of my monthly allocations.',
                  checked: notifBudget,
                  onChange: setNotifBudget
                },
                {
                  id: 'recurring-notifs',
                  title: 'Recurring Processed Updates',
                  desc: 'Alert me whenever an automated recurring mobile money subscription executes.',
                  checked: notifRecurring,
                  onChange: setNotifRecurring
                },
                {
                  id: 'sms-parse-notifs',
                  title: 'SMS Automatic Import Alerts',
                  desc: 'Notify me with high-priority banners when financial SMS records are detected.',
                  checked: notifSms,
                  onChange: setNotifSms
                }
              ].map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 p-3.5 bg-slate-900/20 border border-slate-900 rounded-2xl">
                  <div className="space-y-0.5">
                    <label htmlFor={item.id} className="text-xs font-bold text-slate-200 cursor-pointer">
                      {item.title}
                    </label>
                    <p className="text-[10px] text-slate-500 leading-relaxed pr-6">{item.desc}</p>
                  </div>
                  <input
                    id={item.id}
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded-lg bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500 shrink-0"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Performance: Automatic Refresh Interval */}
          <Card className="border-slate-900 bg-slate-950/40">
            <CardHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <Clock className="w-4.5 h-4.5 text-fuchsia-400" />
                <CardTitle className="text-sm font-bold text-slate-200">Auto-Refresh Interval</CardTitle>
              </div>
              <CardDescription className="text-[11px]">
                Configure the frequency at which accounts and ledgers query background services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { value: 'none', label: 'Manual' },
                  { value: '15000', label: '15 Sec' },
                  { value: '30000', label: '30 Sec' },
                  { value: '60000', label: '1 Min' }
                ].map((opt) => {
                  const active = refreshInterval === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setRefreshInterval(opt.value)}
                      className={`py-2 px-3.5 rounded-xl border text-center font-mono font-bold text-xs cursor-pointer transition-all ${
                        active 
                          ? 'border-fuchsia-500/30 bg-fuchsia-500/5 text-white' 
                          : 'border-slate-900 bg-slate-900/10 text-slate-400 hover:border-slate-800 hover:text-slate-200'
                      }`}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed font-mono">
                💡 High frequency polling yields real-time dashboard updates but consumes more mobile data.
              </p>
            </CardContent>
          </Card>

          {/* Security & Session Preferences */}
          <Card className="border-slate-900 bg-slate-950/40">
            <CardHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
                <CardTitle className="text-sm font-bold text-slate-200">Session Security</CardTitle>
              </div>
              <CardDescription className="text-[11px]">
                Secure your local wallets, tokens, and browser cache.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4 p-3.5 bg-slate-900/20 border border-slate-900 rounded-2xl">
                <div className="space-y-0.5">
                  <label htmlFor="persist-session" className="text-xs font-bold text-slate-200 cursor-pointer">
                    Remember Browser Session
                  </label>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Automatically restore authentication state on app launch. Turn off to clear credentials on tab close.
                  </p>
                </div>
                <input
                  id="persist-session"
                  type="checkbox"
                  checked={persistSession}
                  onChange={(e) => setPersistSession(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded-lg bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500 shrink-0"
                />
              </div>

              <div className="p-3.5 bg-emerald-950/10 border border-emerald-900/20 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">Biometric Login</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-500/80 font-bold bg-emerald-950/50 border border-emerald-900/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Supported in F2 Mobile Native
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
