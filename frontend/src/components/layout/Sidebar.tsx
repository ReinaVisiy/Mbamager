import * as React from 'react';
import { NavLink } from 'react-router';
import { 
  Coins, 
  LayoutDashboard, 
  CreditCard, 
  ArrowLeftRight, 
  PieChart, 
  TrendingUp,
  Target, 
  Clock, 
  Users,
  MessageSquare, 
  Bell, 
  Sparkles, 
  User, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export function Sidebar() {
  const { settings, updateSettings } = useAppStore();
  const collapsed = settings.sidebarCollapsed;

  const toggleCollapse = () => {
    updateSettings({ sidebarCollapsed: !collapsed });
  };

  const navItems = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Accounts', to: '/accounts', icon: CreditCard },
    { label: 'Transactions', to: '/transactions', icon: ArrowLeftRight },
    { label: 'Budgets', to: '/budgets', icon: PieChart },
    { label: 'Analytics', to: '/analytics', icon: TrendingUp },
    { label: 'Savings Goals', to: '/goals', icon: Target },
    { label: 'Njangi / Tontine', to: '/tontine', icon: Users },
    { label: 'Recurring', to: '/recurring', icon: Clock },
    { label: 'SMS Processing', to: '/sms', icon: MessageSquare },
    { label: 'AI Insights', to: '/ai', icon: Sparkles },
    { label: 'Alerts', to: '/notifications', icon: Bell },
  ];

  const systemItems = [
    { label: 'Profile', to: '/profile', icon: User },
    { label: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={`relative h-screen bg-slate-900 border-r border-slate-800/80 flex flex-col justify-between py-6 transition-all duration-300 z-30 shrink-0 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand logo & title */}
      <div>
        <div className="flex items-center gap-3 px-6 mb-8 overflow-hidden h-9">
          <span className="p-2 bg-gradient-to-tr from-gold-500 to-gold-300 rounded-xl shadow-md shadow-gold-500/10 shrink-0">
            <Coins className="w-4.5 h-4.5 text-white" />
          </span>
          {!collapsed && (
            <span className="text-sm font-extrabold tracking-tight text-slate-100 font-sans">
              Mbamager
            </span>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4.5 py-2.5 rounded-xl text-xs font-semibold transition-all group relative ${
                  isActive
                    ? 'bg-gold-50/80 text-gold-600 font-bold shadow-sm shadow-gold-200/10 dark:bg-gold-500/10 dark:text-gold border-r-3 border-gold'
                    : 'text-slate-500 hover:text-gold-600 dark:hover:text-slate-100 hover:bg-slate-800/40'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110" />
              {!collapsed && <span>{item.label}</span>}
              {collapsed && (
                <div className="absolute left-16 bg-slate-900 border border-slate-800 text-slate-100 text-[10px] py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50 shadow-md">
                  {item.label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* System Pages & Collapse toggle */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 px-3 border-t border-slate-800/80 pt-4">
          {systemItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4.5 py-2.5 rounded-xl text-xs font-semibold transition-all group relative ${
                  isActive
                    ? 'bg-gold-50/80 text-gold-600 font-bold shadow-sm shadow-gold-200/10 dark:bg-gold-500/10 dark:text-gold border-r-3 border-gold'
                    : 'text-slate-500 hover:text-gold-600 dark:hover:text-slate-100 hover:bg-slate-800/40'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110" />
              {!collapsed && <span>{item.label}</span>}
              {collapsed && (
                <div className="absolute left-16 bg-slate-900 border border-slate-800 text-slate-100 text-[10px] py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50 shadow-md">
                  {item.label}
                </div>
              )}
            </NavLink>
          ))}
        </div>

        {/* Toggle Collapse button */}
        <button
          onClick={toggleCollapse}
          className="mx-3 flex items-center justify-center p-2 rounded-xl bg-slate-950 border border-slate-800/80 hover:bg-slate-800 hover:text-gold-600 dark:hover:text-slate-100 cursor-pointer transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
