import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, Columns, Calendar, CreditCard,
  TrendingUp, FileSpreadsheet, Users, BarChart2, Settings,
  Sun, ChevronLeft, ChevronRight, Building2, ShieldCheck, Globe, ClipboardList,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { isTenantAdmin } from '@/types/auth';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  financeOnly?: boolean;
  adminOnly?: boolean;
  platformAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Today's Focus",    to: '/today',       icon: <Sun className="w-4 h-4" /> },
  { label: 'Dashboard',        to: '/dashboard',   icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Tasks',            to: '/tasks',       icon: <CheckSquare className="w-4 h-4" /> },
  { label: 'Kanban Board',     to: '/kanban',      icon: <Columns className="w-4 h-4" /> },
  { label: 'Timeline',         to: '/timeline',    icon: <Calendar className="w-4 h-4" /> },
  { label: 'Weekly Review',    to: '/review',      icon: <ClipboardList className="w-4 h-4" /> },
  { label: 'Payment Requests', to: '/payments',    icon: <CreditCard className="w-4 h-4" />,     financeOnly: true },
  { label: 'Cashflow',         to: '/cashflow',    icon: <TrendingUp className="w-4 h-4" />,     financeOnly: true },
  { label: 'Excel Import',     to: '/import',      icon: <FileSpreadsheet className="w-4 h-4" />, financeOnly: true },
  { label: 'Contacts',         to: '/contacts',    icon: <Users className="w-4 h-4" /> },
  { label: 'Reports',          to: '/reports',     icon: <BarChart2 className="w-4 h-4" /> },
  { label: 'Settings',         to: '/settings',    icon: <Settings className="w-4 h-4" /> },
  // Tenant admin section
  { label: 'Tenant Admin',     to: '/admin',       icon: <ShieldCheck className="w-4 h-4" />,    adminOnly: true },
];

export function Sidebar() {
  const { activeWorkspace, preferences, updatePreferences } = useWorkspaceStore();
  const { currentUser, activeTenantId } = useAuthStore();
  const navigate = useNavigate();

  const collapsed       = preferences.sidebarCollapsed;
  const workspaceColour = activeWorkspace?.colour ?? '#6366f1';
  const hideFinance     = activeWorkspace?.hideFinanceFeatures ?? false;
  const isAdmin         = currentUser ? isTenantAdmin(currentUser.role) : false;
  const isPlatformAdmin = currentUser?.role === 'platform_admin';

  // Platform admin without a tenant context shows platform nav instead of app nav
  if (isPlatformAdmin && !activeTenantId) {
    return (
      <aside className={cn(
        'h-screen flex flex-col border-r border-slate-100 bg-white transition-all duration-200 flex-shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}>
        <div
          className="flex items-center gap-3 px-4 h-16 border-b border-slate-100 cursor-pointer select-none"
          onClick={() => navigate('/platform')}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm bg-purple-600">
            FF
          </div>
          {!collapsed && <span className="font-semibold text-slate-800 text-sm">FinanceFlow</span>}
        </div>
        <nav className="flex-1 py-2 px-2">
          <NavLink to="/platform" className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors my-0.5',
            isActive ? 'bg-purple-600 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          )}>
            <Globe className="w-4 h-4" />
            {!collapsed && <span>Platform Admin</span>}
          </NavLink>
        </nav>
        <button
          onClick={() => updatePreferences({ sidebarCollapsed: !collapsed })}
          className="flex items-center justify-center h-10 border-t border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    );
  }

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.financeOnly && hideFinance) return false;
    if (item.adminOnly && !isAdmin)      return false;
    return true;
  });

  return (
    <aside className={cn(
      'h-screen flex flex-col border-r border-slate-100 bg-white transition-all duration-200 flex-shrink-0',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 h-16 border-b border-slate-100 cursor-pointer select-none"
        onClick={() => navigate('/dashboard')}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
          style={{ backgroundColor: workspaceColour }}
        >
          FF
        </div>
        {!collapsed && (
          <span className="font-semibold text-slate-800 text-sm leading-tight">FinanceFlow</span>
        )}
      </div>

      {/* Active workspace chip */}
      {!collapsed && activeWorkspace && (
        <div
          className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          style={{ backgroundColor: workspaceColour + '15' }}
          onClick={() => navigate('/settings?tab=workspaces')}
          title="Switch company"
        >
          <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: workspaceColour }} />
          <span className="text-xs font-medium truncate" style={{ color: workspaceColour }}>
            {activeWorkspace.name}
          </span>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {/* Platform admin: link back to platform dashboard */}
        {isPlatformAdmin && (
          <NavLink
            to="/platform"
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors my-0.5 mb-2',
              isActive ? 'bg-purple-600 text-white' : 'text-purple-600 hover:bg-purple-50'
            )}
          >
            <Globe className="w-4 h-4" />
            {!collapsed && <span>Platform Admin</span>}
          </NavLink>
        )}

        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors my-0.5',
              item.adminOnly && 'mt-3 border-t border-slate-100 pt-3',
              isActive
                ? 'text-white'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            )}
            style={({ isActive }) =>
              isActive
                ? { backgroundColor: item.adminOnly ? '#7c3aed' : workspaceColour }
                : {}
            }
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => updatePreferences({ sidebarCollapsed: !collapsed })}
        className="flex items-center justify-center h-10 border-t border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
