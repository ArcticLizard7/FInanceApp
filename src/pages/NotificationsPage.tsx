import { Bell, Check, X, Clock, AlertTriangle, CreditCard, Info } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { formatRelative } from '@/utils/dateUtils';
import { cn } from '@/utils/cn';
import type { NotificationType } from '@/types';

const typeIcon: Record<NotificationType, React.ReactNode> = {
  deadline_approaching: <Clock className="w-4 h-4 text-amber-500" />,
  overdue:              <AlertTriangle className="w-4 h-4 text-red-500" />,
  reminder:             <Bell className="w-4 h-4 text-brand-500" />,
  approval_required:    <CreditCard className="w-4 h-4 text-blue-500" />,
  delegation_received:  <Info className="w-4 h-4 text-purple-500" />,
  payment_due:          <CreditCard className="w-4 h-4 text-orange-500" />,
  system:               <Info className="w-4 h-4 text-slate-400" />,
};

export function NotificationsPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { getWorkspaceNotifications, markRead, markAllRead, dismiss, snooze } = useNotificationStore();

  const wsId = activeWorkspace?.id ?? '';
  const notifications = getWorkspaceNotifications(wsId);
  const unread = notifications.filter(n => !n.isRead);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
            <p className="text-sm text-slate-500 mt-1">{unread.length} unread</p>
          </div>
          {unread.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead(wsId)}>
              Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-10 h-10" />}
            title="You're all caught up!"
            description="No notifications at the moment."
          />
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div
                key={n.id}
                className={cn(
                  'bg-white rounded-xl border border-slate-100 shadow-card p-4 flex items-start gap-3',
                  !n.isRead && 'border-brand-100 bg-brand-50/30'
                )}
              >
                <div className="mt-0.5 flex-shrink-0">{typeIcon[n.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                    {!n.isRead && (
                      <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatRelative(n.createdAt)}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!n.isRead && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                      title="Mark read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => snooze(n.id, 1)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    title="Snooze 1 day"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => dismiss(n.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
