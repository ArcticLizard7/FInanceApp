import { useState } from 'react';
import { Bell, Search, X, ChevronDown, LogOut, User, Shield, Globe, ArrowLeft, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useTaskStore } from '@/stores/taskStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { useAuthStore } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';
import { formatRelative } from '@/utils/dateUtils';
import { ROLE_LABELS } from '@/types/auth';
import { cn } from '@/utils/cn';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate  = useNavigate();
  const { activeWorkspace, setActiveWorkspace, getVisibleWorkspaces } = useWorkspaceStore();
  const { getUnreadCount, getWorkspaceNotifications, markRead, dismiss } = useNotificationStore();
  const { tasks }    = useTaskStore();
  const { payments } = usePaymentStore();
  const { currentUser, logout, viewingTenantId, exitTenant, activeTenantId } = useAuthStore();
  const { getTenant } = useTenantStore();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showWsSwitcher,    setShowWsSwitcher]    = useState(false);
  const [showUserMenu,      setShowUserMenu]      = useState(false);
  const [query,             setQuery]             = useState('');
  const [showSearch,        setShowSearch]        = useState(false);

  const wsId             = activeWorkspace?.id ?? '';
  const unreadCount      = getUnreadCount(wsId);
  const notifications    = getWorkspaceNotifications(wsId).slice(0, 10);
  const visibleWorkspaces = getVisibleWorkspaces();

  // Platform admin viewing a tenant
  const isPlatformAdminViewing = currentUser?.role === 'platform_admin' && !!viewingTenantId;
  const viewingTenant = viewingTenantId ? getTenant(viewingTenantId) : null;

  // Global search
  const searchResults = query.trim().length > 1
    ? [
        ...tasks.filter(t =>
          t.workspaceId === wsId &&
          (t.title.toLowerCase().includes(query.toLowerCase()) ||
           t.description.toLowerCase().includes(query.toLowerCase()))
        ).slice(0, 5).map(t => ({ type: 'task' as const, id: t.id, title: t.title, sub: t.category })),
        ...payments.filter(p =>
          p.workspaceId === wsId &&
          (p.supplier.toLowerCase().includes(query.toLowerCase()) ||
           p.description.toLowerCase().includes(query.toLowerCase()))
        ).slice(0, 5).map(p => ({ type: 'payment' as const, id: p.id, title: p.supplier, sub: p.project })),
      ]
    : [];

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
    navigate('/login');
  };

  const handleExitTenant = () => {
    exitTenant();
    navigate('/platform');
  };

  return (
    <div className="flex flex-col flex-shrink-0">
      {/* Platform admin "viewing tenant" banner */}
      {isPlatformAdminViewing && viewingTenant && (
        <div className="bg-purple-600 text-white px-6 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 opacity-80" />
            <span className="opacity-80">Viewing tenant:</span>
            <span className="font-semibold">{viewingTenant.name}</span>
          </div>
          <button
            onClick={handleExitTenant}
            className="flex items-center gap-1.5 text-purple-200 hover:text-white transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exit to Platform Admin
          </button>
        </div>
      )}

      <header className="h-16 border-b border-slate-100 bg-white flex items-center px-3 sm:px-6 gap-2 sm:gap-4">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        {/* Search */}
        <div className="flex-1 relative min-w-0">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 150)}
              placeholder="Search tasks, payments…"
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white transition-colors"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {showSearch && searchResults.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
              {searchResults.map(r => (
                <button
                  key={r.id}
                  onClick={() => { setQuery(''); navigate(r.type === 'task' ? '/tasks' : '/payments'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left"
                >
                  <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase font-medium">{r.type}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                    <p className="text-xs text-slate-400 capitalize">{r.sub?.replace(/_/g, ' ')}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Workspace switcher (only when in a tenant context) */}
        {activeTenantId && (
          <div className="relative">
            <button
              onClick={() => setShowWsSwitcher(!showWsSwitcher)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: activeWorkspace?.colour ?? '#6366f1' }}
              />
              <span className="max-w-[120px] truncate hidden sm:block">{activeWorkspace?.name ?? 'Select company'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showWsSwitcher && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1 overflow-hidden">
                {visibleWorkspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => { setActiveWorkspace(ws.id); setShowWsSwitcher(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left',
                      ws.id === activeWorkspace?.id && 'bg-brand-50'
                    )}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ws.colour }} />
                    <span className="text-sm font-medium text-slate-700 truncate">{ws.name}</span>
                  </button>
                ))}
                {/* Tenant admin link to manage companies */}
                {currentUser && (currentUser.role === 'tenant_admin' || currentUser.role === 'platform_admin') && (
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={() => { navigate('/admin?tab=workspaces'); setShowWsSwitcher(false); }}
                      className="w-full px-4 py-2 text-sm text-brand-600 hover:bg-brand-50 text-left font-medium"
                    >
                      Manage companies…
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notifications */}
        {activeTenantId && (
          <div className="relative">
            <button
              type="button"
              aria-label="Open notifications"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-1 w-[calc(100vw-1.5rem)] sm:w-96 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
                  <button onClick={() => navigate('/notifications')} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                    View all
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">All caught up!</p>
                  ) : notifications.map(n => (
                    <div
                      key={n.id}
                      className={cn('px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer', !n.isRead && 'bg-brand-50/40')}
                      onClick={() => { markRead(n.id); setShowNotifications(false); }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 float-left mt-1.5 mr-2" />}
                          <p className="text-xs font-semibold text-slate-800">{n.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Dismiss ${n.title}`}
                          onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                          className="text-slate-300 hover:text-slate-500 mt-0.5 flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{formatRelative(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* User menu */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                currentUser.role === 'platform_admin' ? 'bg-purple-600' : 'bg-brand-600'
              )}>
                {currentUser.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-semibold text-slate-800 leading-none">{currentUser.displayName}</p>
                <p className="text-xs text-slate-400 leading-none mt-0.5">{ROLE_LABELS[currentUser.role]}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">{currentUser.displayName}</p>
                  <p className="text-xs text-slate-400">{currentUser.email}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Shield className="w-3 h-3 text-purple-500" />
                    <span className="text-xs text-slate-500">{ROLE_LABELS[currentUser.role]}</span>
                  </div>
                </div>

                {/* Platform admin → link to platform dashboard */}
                {currentUser.role === 'platform_admin' && (
                  <button
                    onClick={() => { navigate('/platform'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-purple-700 hover:bg-purple-50 font-medium"
                  >
                    <Globe className="w-4 h-4" /> Platform Admin
                  </button>
                )}

                {/* Tenant admin → link to admin page */}
                {(currentUser.role === 'tenant_admin' || (currentUser.role === 'platform_admin' && activeTenantId)) && (
                  <button
                    onClick={() => { navigate('/admin'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-purple-700 hover:bg-purple-50 font-medium"
                  >
                    <Shield className="w-4 h-4" /> Tenant Admin
                  </button>
                )}

                {activeTenantId && (
                  <button
                    onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <User className="w-4 h-4" /> My Settings
                  </button>
                )}

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </header>
    </div>
  );
}
