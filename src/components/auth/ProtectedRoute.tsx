import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { isTenantAdmin } from '@/types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  // If true: requires tenant_admin or platform_admin
  requireTenantAdmin?: boolean;
  // If true: requires platform_admin only
  requirePlatformAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requireTenantAdmin = false,
  requirePlatformAdmin = false,
}: ProtectedRouteProps) {
  const { currentUser, isInitialised, activeTenantId } = useAuthStore();
  const location = useLocation();

  if (!isInitialised) return null;

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Platform-admin-only routes
  if (requirePlatformAdmin && currentUser.role !== 'platform_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Tenant-admin routes (platform_admin also qualifies when inside a tenant)
  if (requireTenantAdmin && !isTenantAdmin(currentUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Platform admin trying to access app routes without being in a tenant context
  // → redirect to platform admin page
  if (
    currentUser.role === 'platform_admin' &&
    !activeTenantId &&
    !requirePlatformAdmin &&
    location.pathname !== '/platform'
  ) {
    return <Navigate to="/platform" replace />;
  }

  return <>{children}</>;
}
