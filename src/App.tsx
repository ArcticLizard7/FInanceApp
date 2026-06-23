import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar }                from '@/components/layout/Sidebar';
import { Header }                 from '@/components/layout/Header';
import { ProtectedRoute }         from '@/components/auth/ProtectedRoute';
import { LoginPage }              from '@/pages/auth/LoginPage';
import { useWorkspaceStore }      from '@/stores/workspaceStore';
import { useTaskStore }           from '@/stores/taskStore';
import { usePaymentStore }        from '@/stores/paymentStore';
import { useNotificationStore }   from '@/stores/notificationStore';
import { useContactStore }        from '@/stores/contactStore';
import { useBudgetStore }         from '@/stores/budgetStore';
import { useDebtStore }           from '@/stores/debtStore';
import { useAuthStore }           from '@/stores/authStore';
import { useTenantStore }         from '@/stores/tenantStore';

const lazyPage = <T extends Record<string, ComponentType>>(
  loader: () => Promise<T>,
  exportName: keyof T,
) => lazy(() => loader().then(module => ({ default: module[exportName] })));

const AdminPage = lazyPage(() => import('@/pages/admin/AdminPage'), 'AdminPage');
const PlatformAdminPage = lazyPage(() => import('@/pages/platform/PlatformAdminPage'), 'PlatformAdminPage');
const DashboardPage = lazyPage(() => import('@/pages/DashboardPage'), 'DashboardPage');
const TodayPage = lazyPage(() => import('@/pages/TodayPage'), 'TodayPage');
const TasksPage = lazyPage(() => import('@/pages/TasksPage'), 'TasksPage');
const KanbanPage = lazyPage(() => import('@/pages/KanbanPage'), 'KanbanPage');
const TimelinePage = lazyPage(() => import('@/pages/TimelinePage'), 'TimelinePage');
const ReviewPage = lazyPage(() => import('@/pages/ReviewPage'), 'ReviewPage');
const PaymentsPage = lazyPage(() => import('@/pages/PaymentsPage'), 'PaymentsPage');
const CashflowPage = lazyPage(() => import('@/pages/CashflowPage'), 'CashflowPage');
const ExcelImportPage = lazyPage(() => import('@/pages/ExcelImportPage'), 'ExcelImportPage');
const ContactsPage = lazyPage(() => import('@/pages/ContactsPage'), 'ContactsPage');
const ReportsPage = lazyPage(() => import('@/pages/ReportsPage'), 'ReportsPage');
const NotificationsPage = lazyPage(() => import('@/pages/NotificationsPage'), 'NotificationsPage');
const SettingsPage = lazyPage(() => import('@/pages/SettingsPage'), 'SettingsPage');
const BudgetPage = lazyPage(() => import('@/pages/BudgetPage'), 'BudgetPage');
const DebtPage = lazyPage(() => import('@/pages/DebtPage'), 'DebtPage');

// ── Authenticated shell ───────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 h-full w-64 max-w-[85vw] bg-white shadow-2xl">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-hidden flex flex-col">
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function FinanceRoute({ children }: { children: React.ReactNode }) {
  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace);

  if (activeWorkspace?.hideFinanceFeatures) {
    return <Navigate to="/today" replace />;
  }

  return <>{children}</>;
}

function PersonalRoute({ children }: { children: React.ReactNode }) {
  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace);

  if (activeWorkspace && activeWorkspace.type !== 'personal') {
    return <Navigate to="/today" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const initAuth          = useAuthStore(s => s.init);
  const initTenants       = useTenantStore(s => s.init);
  const initWorkspace     = useWorkspaceStore(s => s.init);
  const initTasks         = useTaskStore(s => s.init);
  const initPayments      = usePaymentStore(s => s.init);
  const initNotifications = useNotificationStore(s => s.init);
  const initContacts      = useContactStore(s => s.init);
  const initBudgets       = useBudgetStore(s => s.init);
  const initDebts         = useDebtStore(s => s.init);
  const isInitialised     = useAuthStore(s => s.isInitialised);
  const currentUser       = useAuthStore(s => s.currentUser);
  const activeTenantId    = useAuthStore(s => s.activeTenantId);

  useEffect(() => {
    const stopNumberInputWheel = () => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.type === 'number') {
        active.blur();
      }
    };

    document.addEventListener('wheel', stopNumberInputWheel, { capture: true });
    return () => document.removeEventListener('wheel', stopNumberInputWheel, { capture: true });
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (!isInitialised || !currentUser) {
      return;
    }

    if (currentUser.role === 'platform_admin' && !activeTenantId) {
      initTenants();
      return;
    }

    if (activeTenantId) {
      // Tenants and workspaces must complete before other stores; they depend on tenant context.
      (async () => {
        await initTenants();
        await initWorkspace();
        await Promise.all([
          initTasks(),
          initPayments(),
          initNotifications(),
          initContacts(),
          initBudgets(),
          initDebts(),
        ]);
      })();
    }
  }, [
    activeTenantId,
    currentUser,
    initBudgets,
    initContacts,
    initDebts,
    initNotifications,
    initPayments,
    initTasks,
    initTenants,
    initWorkspace,
    isInitialised,
  ]);

  useEffect(() => {
    if (!isInitialised || currentUser) return;

    useTenantStore.setState({ tenants: [], isInitialised: true });
    useWorkspaceStore.setState({ workspaces: [], activeWorkspace: null });
    useTaskStore.setState({ tasks: [] });
    usePaymentStore.setState({ payments: [] });
    useNotificationStore.setState({ notifications: [] });
    useContactStore.setState({ contacts: [] });
    useBudgetStore.setState({ profiles: [], categories: [], budgets: [], incomes: [], transactions: [] });
    useDebtStore.setState({ groups: [], accounts: [], repayments: [], balances: [] });
  }, [currentUser, isInitialised]);

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
          { path: '/payments',      element: <FinanceRoute><PaymentsPage /></FinanceRoute> },
          { path: '/cashflow',      element: <FinanceRoute><CashflowPage /></FinanceRoute> },
          { path: '/import',        element: <FinanceRoute><ExcelImportPage /></FinanceRoute> },
          { path: '/contacts',      element: <ContactsPage /> },
          { path: '/budget',        element: <PersonalRoute><BudgetPage /></PersonalRoute> },
          { path: '/debts',         element: <PersonalRoute><DebtPage /></PersonalRoute> },
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
