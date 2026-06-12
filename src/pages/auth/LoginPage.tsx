import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Shield, AlertCircle } from 'lucide-react';
import { useAuthStore, type AuthError } from '@/stores/authStore';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { cn } from '@/utils/cn';
import { isProductionAuthBlocked, isSupabaseConfigured, runtimeConfig } from '@/config/runtime';

const ERROR_MESSAGES: Record<AuthError, string> = {
  invalid_credentials: 'Incorrect username or password.',
  account_disabled:    'This account has been disabled. Contact your administrator.',
  profile_unavailable: 'Your sign-in worked, but your profile could not be loaded. Contact your administrator.',
  mfa_required:        'Multi-factor authentication is required.',
  mfa_invalid:         'Incorrect verification code. Please try again.',
  mfa_expired:         'The verification code has expired. Please log in again.',
  session_expired:     'Your session has expired. Please log in again.',
};

export function LoginPage() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const { login, verifyMFA, pendingMFA, currentUser } = useAuthStore();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/today';

  const [step, setStep]               = useState<'credentials' | 'mfa'>('credentials');
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode]         = useState('');
  const [rememberDevice, setRemember] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [mfaDisplayCode, setMfaDisplayCode] = useState<string | null>(null);
  const showDemoHints = runtimeConfig.enableDemoAuth;
  const loginLabel = showDemoHints ? 'Username' : 'Email';

  // Already logged in
  useEffect(() => {
    if (currentUser) {
      const dest = currentUser.role === 'platform_admin' ? '/platform' : from;
      navigate(dest, { replace: true });
    }
  }, [currentUser]);

  // Restore MFA step if the user refreshes mid-flow
  useEffect(() => {
    if (pendingMFA) setStep('mfa');
  }, [pendingMFA]);

  // ── Step 1: credentials ───────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError(null);

    const result = await login(username.trim(), password, rememberDevice);

    if (result.ok && result.mfaRequired) {
      // Grab the OTP from the store's pendingMFA (set synchronously in login())
      // In production this would NOT be shown — it would be emailed
      const pending = useAuthStore.getState().pendingMFA;
      setMfaDisplayCode(pending?.code ?? null);
      setStep('mfa');
    } else if (result.ok) {
      const user = useAuthStore.getState().currentUser;
      const dest = user?.role === 'platform_admin' ? '/platform' : from;
      navigate(dest, { replace: true });
    } else {
      setError(ERROR_MESSAGES[result.error ?? 'invalid_credentials']);
    }

    setLoading(false);
  };

  // ── Step 2: MFA ──────────────────────────────────────────

  const handleMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length !== 6) return;

    setLoading(true);
    setError(null);

    const result = await verifyMFA(mfaCode);

    if (result.ok) {
      const user = useAuthStore.getState().currentUser;
      const dest = user?.role === 'platform_admin' ? '/platform' : from;
      navigate(dest, { replace: true });
    } else {
      setError(ERROR_MESSAGES[result.error ?? 'mfa_invalid']);
      if (result.error === 'mfa_expired') {
        setStep('credentials');
        setMfaCode('');
        setMfaDisplayCode(null);
      }
    }

    setLoading(false);
  };

  const handleMFAInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setMfaCode(digits);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-brand-600 items-center justify-center mb-4 shadow-lg">
            <span className="text-white font-bold text-xl">FF</span>
          </div>
          <h1 className="text-2xl font-bold text-white">FinanceFlow</h1>
          <p className="text-slate-400 text-sm mt-1">Property Finance Management</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Step indicator */}
          <div className="flex">
            {(['credentials','mfa'] as const).map((s, i) => (
              <div
                key={s}
                className={cn(
                  'flex-1 h-1 transition-colors',
                  step === 'mfa' ? 'bg-brand-600' : i === 0 ? 'bg-brand-600' : 'bg-slate-100'
                )}
              />
            ))}
          </div>

          <div className="p-8">
            {isProductionAuthBlocked ? (
              <ProductionAuthBlocked />
            ) : step === 'credentials' ? (
              <>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">Sign in</h2>
                <p className="text-sm text-slate-500 mb-6">Enter your credentials to continue</p>

                {error && <ErrorBanner message={error} />}

                <form onSubmit={handleLogin} className="space-y-4">
                  <Input
                    label={loginLabel}
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    placeholder={showDemoHints ? 'e.g. admin' : 'you@example.com'}
                  />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={e => setRemember(e.target.checked)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-slate-600">Remember this device for 30 days</span>
                  </label>

                  <Button
                    type="submit"
                    className="w-full justify-center"
                    icon={<LogIn className="w-4 h-4" />}
                    loading={loading}
                    disabled={!username.trim() || !password}
                  >
                    Continue
                  </Button>
                </form>

                {showDemoHints && (
                  <div className="mt-6 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Default Credentials</p>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Tenant Admin</p>
                      <p className="text-xs text-slate-600 font-mono">admin / <strong>Admin123!</strong></p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Platform Admin (owner)</p>
                      <p className="text-xs text-slate-600 font-mono">superadmin / <strong>SuperAdmin123!</strong></p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-brand-50 rounded-xl">
                    <Shield className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Two-factor verification</h2>
                    <p className="text-xs text-slate-500">Enter the 6-digit code to proceed</p>
                  </div>
                </div>

                {mfaDisplayCode && showDemoHints && (
                  <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                      Demo mode — verification code
                    </p>
                    <p className="text-2xl font-mono font-bold text-amber-800 tracking-[0.25em]">
                      {mfaDisplayCode}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      In production this would be sent to your email/authenticator. Valid for 5 minutes.
                    </p>
                  </div>
                )}

                {error && <ErrorBanner message={error} />}

                <form onSubmit={handleMFA} className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Verification Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={mfaCode}
                      onChange={e => handleMFAInput(e.target.value)}
                      autoFocus
                      placeholder="000000"
                      className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.3em] border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    <p className="text-xs text-slate-400 text-center">Enter the 6-digit code</p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full justify-center"
                    icon={<Shield className="w-4 h-4" />}
                    loading={loading}
                    disabled={mfaCode.length !== 6}
                  >
                    Verify
                  </Button>
                </form>

                <button
                  onClick={() => { setStep('credentials'); setError(null); setMfaCode(''); }}
                  className="mt-4 text-sm text-slate-500 hover:text-slate-700 w-full text-center"
                >
                  ← Back to login
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          FinanceFlow · Property Finance Management
        </p>
      </div>
    </div>
  );
}

function ProductionAuthBlocked() {
  return (
    <div>
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <Shield className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-amber-900">Production login is locked</h2>
          <p className="text-sm text-amber-800 mt-1">
            Demo auth is disabled for production. Configure Supabase auth and deploy with real environment variables before using this app online.
          </p>
        </div>
      </div>
      <div className="mt-4 text-xs text-slate-500 space-y-1">
        <p>Supabase configured: {isSupabaseConfigured ? 'yes' : 'no'}</p>
        <p>Demo auth: disabled</p>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}
