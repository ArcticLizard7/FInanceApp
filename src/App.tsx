import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar }                from '@/components/layout/Sidebar';
import { Header }                 from '@/components/layout/Header';
import { ProtectedRoute }         from '@/components/auth/ProtectedRoute';
import { LoginPage }              from '@/pages/auth/LoginPage';
import { AdminPage }              from '@/pages/admin/AdminPage';
import { PlatformAdminPage }      from '@/pages/platform/PlatformAdminPage';
import { DashboardPage }          from '@/pages/DashboardPage';
import { TodayPage }              from '@/pages/TodayPage';
import { TasksPage }              from '@/pages/TasksPage';
import { KanbanPage }             from '@/pages/KanbanPage';
import { TimelinePage }           from '@/pages/TimelinePage';
import { ReviewPage }             from '@/pages/ReviewPage';
import { PaymentsPage }           from '@/pages/PaymentsPage';
import { CashflowPage }           from '@/pages/CashflowPage';
import { ExcelImportPage }        from '@/pages/ExcelImportPage';
import { ContactsPage }           from '@/pages/ContactsPage';
import { ReportsPage }            from '@/pages/ReportsPage';
import { NotificationsPage }      from '@/pages/NotificationsPage';
import { SettingsPage }           from '@/pages/SettingsPage';
import { useWorkspaceStore }      from '@/stores/workspaceStore';
import { useTaskStore }           from '@/stores/taskStore';
import { usePaymentStore }        from '@/stores/paymentStore';
import { useNotificationStore }   from '@/stores/notificationStore';
import { useContactStore }        from '@/stores/contactStore';
import { useAuthStore }           from '@/stores/authStore';
import { useTenantStore }         from '@/stores/tenantStore';

// ── Authenticated shell ───────────────────────────────────────

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const initAuth          = useAuthStore(s => s.init);
  const initTenants       = useTenantStore(s => s.init);
  const initWorkspace     = useWorkspaceStore(s => s.init);
  const initTasks         = useTaskStore(s => s.init);
  const initPayments      = usePaymentStore(s => s.init);
  const initNotifications = useNotificationStore(s => s.init);
  const initContacts      = useContactStore(s => s.init);
  const isInitialised     = useAuthStore(s => s.isInitialised);

  useEffect(() => {
    // Auth + tenants must complete before other stores (they depend on tenantId context)
    initAuth().then(async () => {
      await initTenants();
      await initWorkspace();
      await Promise.all([
        initTasks(),
        initPayments(),
        initNotifications(),
        initContacts(),
      ]);
    });
  }, []);

  if (!isInitialised) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">FF</span>
          </div>
          <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Root redirect */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppShell><Navigate to="/today" replace /></AppShell>
          </ProtectedRoute>
        } />

        {/* Platform admin — only for platform_admin role */}
        <Route path="/platform" element={
          <ProtectedRoute requirePlatformAdmin>
            <AppShell><PlatformAdminPage /></AppShell>
          </ProtectedRoute>
        } />

        {/* All standard app pages */}
        {[
          { path: '/today',         element: <TodayPage /> },
          { path: '/dashboard',     element: <DashboardPage /> },
          { path: '/tasks',         element: <TasksPage /> },
          { path: '/kanban',        element: <KanbanPage /> },
          { path: '/timeline',      element: <TimelinePage /> },
          { path: '/review',        element: <ReviewPage /> },
          { path: '/payments',      element: <PaymentsPage /> },
          { path: '/cashflow',      element: <CashflowPage /> },
          { path: '/import',        element: <ExcelImportPage /> },
          { path: '/contacts',      element: <ContactsPage /> },
          { path: '/reports',       element: <ReportsPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/settings',      element: <SettingsPage /> },
        ].map(({ path, element }) => (
          <Route key={path} path={path} element={
            <ProtectedRoute>
              <AppShell>{element}</AppShell>
            </ProtectedRoute>
          } />
        ))}

        {/* Tenant admin — requires tenant_admin or platform_admin */}
        <Route path="/admin" element={
          <ProtectedRoute requireTenantAdmin>
            <AppShell><AdminPage /></AppShell>
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
