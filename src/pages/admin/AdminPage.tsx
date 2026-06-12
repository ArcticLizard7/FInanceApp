// ============================================================
// Tenant Admin Page
// Accessible to tenant_admin and platform_admin (when inside a tenant).
// Manages users and workspaces within the current tenant only.
// ============================================================

import { useState, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, Shield, ShieldOff, Key, Monitor,
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Building2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTenantStore } from '@/stores/tenantStore';
import { Modal } from '@/components/common/Modal';
import { Input, Select } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import {
  ROLE_LABELS,
  type UserRole, type User as AuthUser,
} from '@/types/auth';
import { formatDate, formatRelative } from '@/utils/dateUtils';
import { cn } from '@/utils/cn';
import { POPULAR_CURRENCIES, currencyLabel } from '@/constants/currencies';

type AdminTab = 'users' | 'workspaces' | 'devices';

// Roles a tenant admin can assign (they cannot create platform_admin users)
const TENANT_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'tenant_admin',       label: ROLE_LABELS.tenant_admin       },
  { value: 'finance_director',   label: ROLE_LABELS.finance_director   },
  { value: 'finance_manager',    label: ROLE_LABELS.finance_manager    },
  { value: 'accounts_assistant', label: ROLE_LABELS.accounts_assistant },
];

const ROLE_COLOUR: Record<UserRole, string> = {
  platform_admin:     'bg-purple-100 text-purple-800',
  tenant_admin:       'bg-purple-50 text-purple-700',
  finance_director:   'bg-blue-50 text-blue-700',
  finance_manager:    'bg-brand-50 text-brand-700',
  accounts_assistant: 'bg-slate-100 text-slate-600',
};

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('users');
  const { activeTenantId } = useAuthStore();
  const { getTenant } = useTenantStore();

  const tenant = activeTenantId ? getTenant(activeTenantId) : null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-purple-50 rounded-xl">
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Tenant Administration</h1>
            <p className="text-sm text-slate-500">
              {tenant ? tenant.name : 'Manage users, workspaces, and security for this tenant.'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 w-fit">
          {([
            { id: 'users',      label: 'Users'            },
            { id: 'workspaces', label: 'Companies'        },
            { id: 'devices',    label: 'Trusted Devices'  },
          ] as { id: AdminTab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'users'      && <UsersTab      tenantId={activeTenantId} />}
        {tab === 'workspaces' && <WorkspacesTab tenantId={activeTenantId} />}
        {tab === 'devices'    && <DevicesTab    tenantId={activeTenantId} />}
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────

function UsersTab({ tenantId }: { tenantId: string | null }) {
  const {
    users, currentUser, createUser, updateUser, resetPassword, deleteUser,
    revokeAllDevicesForUser,
  } = useAuthStore();
  const { workspaces } = useWorkspaceStore();

  // Only show users in this tenant
  const tenantUsers = useMemo(() =>
    users.filter(u => u.tenantId === tenantId),
    [users, tenantId]
  );

  const tenantWorkspaces = useMemo(() =>
    workspaces.filter(w => w.tenantId === tenantId),
    [workspaces, tenantId]
  );

  const [showCreate,   setShowCreate]   = useState(false);
  const [editingUser,  setEditingUser]  = useState<AuthUser | null>(null);
  const [resetTarget,  setResetTarget]  = useState<AuthUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null);
  const [newPassword,  setNewPassword]  = useState('');
  const [resetDone,    setResetDone]    = useState(false);

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword.trim()) return;
    await resetPassword(resetTarget.id, newPassword.trim());
    setResetDone(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{tenantUsers.length} user{tenantUsers.length !== 1 ? 's' : ''} in this tenant</p>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Create User
        </Button>
      </div>

      {/* User table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['User', 'Role', 'Workspace Access', 'MFA', 'Last Login', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tenantUsers.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                {/* User */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0',
                      u.isActive ? 'bg-brand-500' : 'bg-slate-300'
                    )}>
                      {u.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 flex items-center gap-1">
                        {u.displayName}
                        {u.id === currentUser?.id && (
                          <span className="text-xs text-brand-600 font-normal">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">@{u.username} · {u.email}</p>
                    </div>
                  </div>
                </td>

                {/* Role */}
                <td className="px-4 py-3">
                  <Badge className={ROLE_COLOUR[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                </td>

                {/* Workspace access */}
                <td className="px-4 py-3 text-xs text-slate-500">
                  {u.workspaceAccess.length === 0
                    ? <span className="text-green-600 font-medium">All</span>
                    : tenantWorkspaces
                        .filter(w => u.workspaceAccess.includes(w.id))
                        .map(w => w.name)
                        .join(', ') || '—'
                  }
                </td>

                {/* MFA */}
                <td className="px-4 py-3">
                  {u.mfaEnabled
                    ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> On</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-slate-400"><XCircle className="w-3.5 h-3.5" /> Off</span>
                  }
                </td>

                {/* Last login */}
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Never'}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <Badge className={u.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                    {u.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingUser(u)}
                      title="Edit user"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateUser(u.id, { mfaEnabled: !u.mfaEnabled })}
                      title={u.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        u.mfaEnabled
                          ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                          : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                      )}
                    >
                      {u.mfaEnabled ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => { setResetTarget(u); setNewPassword(''); setResetDone(false); }}
                      title="Reset password"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => revokeAllDevicesForUser(u.id)}
                      title="Revoke all trusted devices"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => setDeleteTarget(u)}
                        title="Delete user"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {tenantUsers.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">No users in this tenant yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create User modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create User" size="lg">
        <UserForm
          workspaces={tenantWorkspaces}
          tenantId={tenantId}
          onSave={async data => { await createUser(data); setShowCreate(false); }}
          onCancel={() => setShowCreate(false)}
          createdBy={currentUser?.id ?? null}
        />
      </Modal>

      {/* Edit User modal */}
      <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Edit User" size="lg">
        {editingUser && (
          <UserForm
            initial={editingUser}
            workspaces={tenantWorkspaces}
            tenantId={tenantId}
            onSave={async data => {
              const { password, ...rest } = data;
              updateUser(editingUser.id, rest);
              if (password) await resetPassword(editingUser.id, password);
              setEditingUser(null);
            }}
            onCancel={() => setEditingUser(null)}
            createdBy={currentUser?.id ?? null}
            editMode
          />
        )}
      </Modal>

      {/* Reset Password modal */}
      <Modal
        isOpen={!!resetTarget}
        onClose={() => { setResetTarget(null); setResetDone(false); }}
        title="Reset Password"
        size="sm"
      >
        {resetTarget && (
          <div className="space-y-4">
            {resetDone ? (
              <div className="flex items-center gap-3 py-4">
                <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-slate-800">Password reset successfully.</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {resetTarget.displayName} will need to use the new password on next login.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Set a new password for <strong>{resetTarget.displayName}</strong>.
                </p>
                <Input
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  hint="Minimum 8 characters."
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" onClick={() => setResetTarget(null)}>Cancel</Button>
                  <Button onClick={handleResetPassword} disabled={!newPassword.trim()}>
                    Reset Password
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete User"
        size="sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 rounded-xl flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Delete <strong>{deleteTarget.displayName}</strong>?
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  All trusted devices will be revoked. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteUser(deleteTarget.id); setDeleteTarget(null); }}>
                Delete User
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Workspaces Tab ────────────────────────────────────────────

const WS_COLOURS = ['#6366f1', '#0891b2', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0f766e'];

function WorkspacesTab({ tenantId }: { tenantId: string | null }) {
  const { workspaces, addWorkspace, updateWorkspace, archiveWorkspace, deleteWorkspace } = useWorkspaceStore();

  const tenantWorkspaces = useMemo(() =>
    workspaces.filter(w => w.tenantId === tenantId),
    [workspaces, tenantId]
  );

  const [showCreate, setShowCreate] = useState(false);
  const [editingWs, setEditingWs]   = useState<(typeof workspaces)[0] | null>(null);
  const [wsForm, setWsForm]         = useState({ name: '', colour: '#6366f1', currency: 'GBP', type: 'company' as 'company' | 'personal' });
  const [wsError, setWsError]       = useState('');

  const resetWsForm = () => { setWsForm({ name: '', colour: '#6366f1', currency: 'GBP', type: 'company' }); setWsError(''); };

  const handleSave = () => {
    if (!wsForm.name.trim()) { setWsError('Name is required.'); return; }
    if (editingWs) {
      updateWorkspace(editingWs.id, { name: wsForm.name, colour: wsForm.colour, currency: wsForm.currency, type: wsForm.type });
      setEditingWs(null);
    } else {
      if (!tenantId) return;
      addWorkspace({
        name: wsForm.name.trim(),
        tenantId,
        colour: wsForm.colour,
        currency: wsForm.currency,
        type: wsForm.type,
        isDefault: tenantWorkspaces.length === 0,
        isArchived: false,
        hideFinanceFeatures: wsForm.type === 'personal',
      });
      setShowCreate(false);
      resetWsForm();
    }
  };

  const WsFormContent = (
    <div className="space-y-4">
      <Input label="Company Name *" value={wsForm.name} onChange={e => setWsForm(p => ({ ...p, name: e.target.value }))} placeholder="Acme Developments Ltd" error={wsError} />
      <Select
        label="Type"
        value={wsForm.type}
        onChange={e => setWsForm(p => ({ ...p, type: e.target.value as 'company' | 'personal' }))}
        options={[{ value: 'company', label: 'Company' }, { value: 'personal', label: 'Personal' }]}
      />
      <Select
        label="Currency"
        value={wsForm.currency}
        onChange={e => setWsForm(p => ({ ...p, currency: e.target.value }))}
        options={POPULAR_CURRENCIES}
      />
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Colour</label>
        <div className="flex gap-2">
          {WS_COLOURS.map(c => (
            <button key={c} type="button" onClick={() => setWsForm(p => ({ ...p, colour: c }))}
              className={cn('w-7 h-7 rounded-full border-2 transition-transform', wsForm.colour === c ? 'border-slate-800 scale-110' : 'border-transparent')}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={() => { setShowCreate(false); setEditingWs(null); resetWsForm(); }}>Cancel</Button>
        <Button onClick={handleSave}>{editingWs ? 'Save Changes' : 'Create Company'}</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{tenantWorkspaces.length} compan{tenantWorkspaces.length !== 1 ? 'ies' : 'y'}</p>
        <Button onClick={() => { resetWsForm(); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Company
        </Button>
      </div>

      <div className="space-y-3">
        {tenantWorkspaces.map(ws => (
          <div key={ws.id} className={cn('bg-white rounded-xl border border-slate-100 shadow-card p-4 flex items-center justify-between', ws.isArchived && 'opacity-60')}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ws.colour}20` }}>
                <Building2 className="w-4.5 h-4.5" style={{ color: ws.colour }} />
              </div>
              <div>
                <p className="font-medium text-slate-800">{ws.name}</p>
                <p className="text-xs text-slate-400 capitalize">{ws.type} · {currencyLabel(ws.currency)} {ws.isDefault && '· Default'} {ws.isArchived && '· Archived'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setEditingWs(ws); setWsForm({ name: ws.name, colour: ws.colour, currency: ws.currency, type: ws.type }); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50"><Edit2 className="w-3.5 h-3.5" /></button>
              {!ws.isArchived && (
                <button onClick={() => archiveWorkspace(ws.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Archive">
                  <ShieldOff className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => deleteWorkspace(ws.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        {tenantWorkspaces.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No companies yet. Create one to get started.</p>
          </div>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetWsForm(); }} title="Add Company" size="sm">
        {WsFormContent}
      </Modal>
      <Modal isOpen={!!editingWs} onClose={() => { setEditingWs(null); resetWsForm(); }} title="Edit Company" size="sm">
        {WsFormContent}
      </Modal>
    </div>
  );
}

// ── User Form ─────────────────────────────────────────────────

interface WsEntry { id: string; name: string; colour: string; currency: string; isArchived: boolean; }

interface UserFormProps {
  initial?: AuthUser;
  workspaces: WsEntry[];
  tenantId: string | null;
  createdBy: string | null;
  editMode?: boolean;
  onSave: (data: Omit<AuthUser, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'passwordHash' | 'salt'> & { password: string }) => Promise<void>;
  onCancel: () => void;
}

function UserForm({ initial, workspaces, tenantId, createdBy, editMode = false, onSave, onCancel }: UserFormProps) {
  const [form, setForm] = useState({
    username:        initial?.username      ?? '',
    displayName:     initial?.displayName   ?? '',
    email:           initial?.email         ?? '',
    role:            (initial?.role ?? 'accounts_assistant') as UserRole,
    workspaceAccess: initial?.workspaceAccess ?? [] as string[],
    isActive:        initial?.isActive       ?? true,
    mfaEnabled:      initial?.mfaEnabled     ?? true,
    createdBy,
    tenantId,
    password:        '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const toggleWorkspace = (id: string) => {
    setForm(p => ({
      ...p,
      workspaceAccess: p.workspaceAccess.includes(id)
        ? p.workspaceAccess.filter(w => w !== id)
        : [...p.workspaceAccess, id],
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim())    e.username = 'Username is required.';
    if (!form.displayName.trim()) e.displayName = 'Display name is required.';
    if (!form.email.trim())       e.email = 'Email is required.';
    if (!editMode && !form.password) e.password = 'Password is required for new users.';
    if (form.password && form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSubmitError('');
    try {
      await onSave(form);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Display Name *"
          value={form.displayName}
          onChange={e => set('displayName', e.target.value)}
          error={errors.displayName}
          placeholder="e.g. Jane Smith"
        />
        <Input
          label="Username *"
          value={form.username}
          onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
          error={errors.username}
          placeholder="e.g. jsmith"
          hint="Used to log in"
        />
      </div>

      <Input
        label="Email *"
        type="email"
        value={form.email}
        onChange={e => set('email', e.target.value)}
        error={errors.email}
      />

      <Select
        label="Role"
        value={form.role}
        onChange={e => set('role', e.target.value as UserRole)}
        options={TENANT_ROLE_OPTIONS}
      />

      <Input
        label={editMode ? 'New Password (leave blank to keep current)' : 'Password *'}
        type="password"
        value={form.password}
        onChange={e => set('password', e.target.value)}
        error={errors.password}
        hint="Minimum 8 characters"
        placeholder="••••••••"
      />

      {/* Workspace access */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Company Access</p>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
            <input
              type="radio"
              checked={form.workspaceAccess.length === 0}
              onChange={() => set('workspaceAccess', [])}
              className="text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-green-700">All companies</span>
          </label>
          {workspaces.filter(w => !w.isArchived).map(w => (
            <label key={w.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
              <input
                type="checkbox"
                checked={form.workspaceAccess.includes(w.id)}
                onChange={() => {
                  if (form.workspaceAccess.length === 0) {
                    set('workspaceAccess', [w.id]);
                  } else {
                    toggleWorkspace(w.id);
                  }
                }}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: w.colour }} />
              <span className="text-sm text-slate-700">{w.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.mfaEnabled}
            onChange={e => set('mfaEnabled', e.target.checked)}
            className="rounded border-slate-300 text-brand-600"
          />
          <span className="text-sm text-slate-700">Require MFA</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => set('isActive', e.target.checked)}
            className="rounded border-slate-300 text-brand-600"
          />
          <span className="text-sm text-slate-700">Account active</span>
        </label>
      </div>

      {submitError && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{submitError}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {editMode ? 'Save Changes' : 'Create User'}
        </Button>
      </div>
    </div>
  );
}

// ── Devices Tab ───────────────────────────────────────────────

function DevicesTab({ tenantId }: { tenantId: string | null }) {
  const { deviceTokens, users, revokeDevice, revokeAllDevicesForUser } = useAuthStore();

  // Only show devices for users in this tenant
  const tenantUserIds = useMemo(() =>
    new Set(users.filter(u => u.tenantId === tenantId).map(u => u.id)),
    [users, tenantId]
  );

  const activeTokens = deviceTokens
    .filter(d => tenantUserIds.has(d.userId) && new Date(d.expiresAt) > new Date())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const expiredCount = deviceTokens.filter(d => tenantUserIds.has(d.userId) && new Date(d.expiresAt) <= new Date()).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {activeTokens.length} trusted device{activeTokens.length !== 1 ? 's' : ''}
          {expiredCount > 0 && ` · ${expiredCount} expired`}
        </p>
        {activeTokens.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => {
            const ids = [...new Set(activeTokens.map(d => d.userId))];
            ids.forEach(id => revokeAllDevicesForUser(id));
          }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Revoke All
          </Button>
        )}
      </div>

      {activeTokens.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Monitor className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No trusted devices registered.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Device', 'User', 'Registered', 'Expires', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeTokens.map(d => {
                const owner = users.find(u => u.id === d.userId);
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-800">{d.deviceName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {owner ? `${owner.displayName} (@${owner.username})` : 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{formatDate(d.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{formatDate(d.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => revokeDevice(d.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Revoke"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
