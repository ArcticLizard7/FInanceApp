// ============================================================
// Platform Admin Page
// Accessible only to users with role === 'platform_admin'.
// Three tabs: Tenants, Users (cross-tenant), Settings.
// ============================================================

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
  Search, Globe, X, Check,
  BarChart2, LogIn,
} from 'lucide-react';
import { useTenantStore } from '@/stores/tenantStore';
import { useAuthStore } from '@/stores/authStore';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input, Select } from '@/components/common/Input';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/dateUtils';
import type { Tenant, TenantPlan } from '@/types/tenant';
import { PLAN_LABELS, PLAN_COLOUR, STATUS_COLOUR } from '@/types/tenant';
import { ROLE_LABELS } from '@/types/auth';

type Tab = 'tenants' | 'users' | 'overview';

// ── Tenant Form ───────────────────────────────────────────────

interface TenantFormData {
  name: string;
  slug: string;
  colour: string;
  plan: TenantPlan;
  contactName: string;
  contactEmail: string;
  notes: string;
  adminUsername: string;
  adminDisplayName: string;
  adminEmail: string;
  adminPassword: string;
  maxUsers: number;
  maxWorkspaces: number;
}

const DEFAULT_FORM: TenantFormData = {
  name: '', slug: '', colour: '#6366f1', plan: 'standard',
  contactName: '', contactEmail: '', notes: '',
  adminUsername: '', adminDisplayName: '', adminEmail: '', adminPassword: '',
  maxUsers: 0, maxWorkspaces: 0,
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const COLOURS = ['#6366f1', '#0891b2', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0f766e', '#b45309'];

interface TenantFormProps {
  initial?: TenantFormData;
  editing: boolean;
  onSave: (data: TenantFormData) => Promise<void>;
  onClose: () => void;
  isSlugTaken: (slug: string) => boolean;
}

function TenantForm({ initial, editing, onSave, onClose, isSlugTaken }: TenantFormProps) {
  const [form, setForm] = useState<TenantFormData>(initial ?? DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [slugManual, setSlugManual] = useState(editing);
  const [error, setError] = useState('');

  const f = (field: keyof TenantFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm(p => ({ ...p, [field]: val }));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setForm(p => ({ ...p, name, ...(slugManual ? {} : { slug: slugify(name) }) }));
  };

  const handleSave = async () => {
    if (!form.name.trim())              { setError('Organisation name is required.'); return; }
    if (!form.slug.trim())              { setError('URL slug is required.'); return; }
    if (!editing && isSlugTaken(form.slug)) { setError('That slug is already taken.'); return; }
    if (!editing) {
      if (!form.adminUsername.trim())   { setError('Admin username is required.'); return; }
      if (!form.adminEmail.trim())      { setError('Admin email is required.'); return; }
      if (!form.adminPassword.trim() || form.adminPassword.length < 8)
                                        { setError('Admin password must be at least 8 characters.'); return; }
    }
    setSaving(true);
    setError('');
    try { await onSave(form); }
    catch (err) { setError(err instanceof Error ? err.message : 'An error occurred. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {/* Organisation Details */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Organisation Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Organisation Name *" value={form.name} onChange={handleNameChange} placeholder="Acme Property Group" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">URL Slug *</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">financeflow.app/</span>
              <input
                value={form.slug}
                onChange={e => { setSlugManual(true); setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })); }}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="acme-property"
              />
            </div>
          </div>
          <Select
            label="Plan"
            value={form.plan}
            onChange={f('plan')}
            options={(Object.keys(PLAN_LABELS) as TenantPlan[]).map(p => ({ value: p, label: PLAN_LABELS[p] }))}
          />
        </div>

        {/* Colour picker */}
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-600 mb-2">Brand Colour</label>
          <div className="flex gap-2">
            {COLOURS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(p => ({ ...p, colour: c }))}
                className={cn('w-7 h-7 rounded-full border-2 transition-transform', form.colour === c ? 'border-slate-800 scale-110' : 'border-transparent')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Contact */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Primary Contact</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Contact Name" value={form.contactName} onChange={f('contactName')} placeholder="John Smith" />
          <Input label="Contact Email" type="email" value={form.contactEmail} onChange={f('contactEmail')} placeholder="j.smith@company.com" />
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={f('notes')}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            placeholder="Optional notes about this tenant…"
          />
        </div>
      </div>

      {/* Limits */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Usage Limits <span className="font-normal text-slate-400">(0 = unlimited)</span></h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Max Users" type="number" value={String(form.maxUsers)} onChange={f('maxUsers')} min="0" />
          <Input label="Max Workspaces" type="number" value={String(form.maxWorkspaces)} onChange={f('maxWorkspaces')} min="0" />
        </div>
      </div>

      {/* Tenant admin — only on create */}
      {!editing && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Tenant Administrator Account</h3>
          <p className="text-xs text-slate-400 mb-3">This user will be able to manage the tenant, create users, and set up workspaces.</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Username *" value={form.adminUsername} onChange={f('adminUsername')} placeholder="admin" />
            <Input label="Display Name" value={form.adminDisplayName} onChange={f('adminDisplayName')} placeholder="Tenant Admin" />
            <Input label="Email *" type="email" value={form.adminEmail} onChange={f('adminEmail')} placeholder="admin@company.com" />
            <Input label="Password *" type="password" value={form.adminPassword} onChange={f('adminPassword')} placeholder="Min. 8 characters" />
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Tenant'}
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export function PlatformAdminPage() {
  const navigate   = useNavigate();
  const { tenants, createTenant, updateTenant, deleteTenant, isSlugTaken } = useTenantStore();
  const { users, currentUser, enterTenant, createUser, deleteUser } = useAuthStore();

  const [tab, setTab] = useState<Tab>('tenants');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [suspendingTenant, setSuspendingTenant] = useState<Tenant | null>(null);

  const filteredTenants = useMemo(() =>
    tenants.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.includes(search.toLowerCase())),
    [tenants, search]
  );

  const allUsers = useMemo(() => users.filter(u => u.tenantId !== null), [users]);
  const filteredUsers = useMemo(() =>
    allUsers.filter(u =>
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    ),
    [allUsers, search]
  );

  const handleCreateTenant = async (data: TenantFormData) => {
    if (!currentUser) return;
    const tenant = await createTenant({
      name: data.name, slug: data.slug, colour: data.colour, plan: data.plan,
      contactName: data.contactName, contactEmail: data.contactEmail, notes: data.notes,
      settings: { maxUsers: data.maxUsers, maxWorkspaces: data.maxWorkspaces, enableExcelImport: true, enableEmailDelegation: true, enableReports: true },
    }, currentUser.id);

    // Create the tenant admin user
    await createUser({
      username:        data.adminUsername || `${data.slug}_admin`,
      displayName:     data.adminDisplayName || 'Tenant Administrator',
      email:           data.adminEmail,
      role:            'tenant_admin',
      tenantId:        tenant.id,
      workspaceAccess: [],
      isActive:        true,
      mfaEnabled:      true,
      createdBy:       currentUser.id,
      password:        data.adminPassword,
    });

    setShowCreateModal(false);
  };

  const handleEditTenant = async (data: TenantFormData) => {
    if (!editingTenant) return;
    updateTenant(editingTenant.id, {
      name: data.name, slug: data.slug, colour: data.colour, plan: data.plan,
      contactName: data.contactName, contactEmail: data.contactEmail, notes: data.notes,
      settings: {
        ...(editingTenant.settings),
        maxUsers: data.maxUsers,
        maxWorkspaces: data.maxWorkspaces,
      },
    });
    setEditingTenant(null);
  };

  const handleEnterTenant = (tenantId: string) => {
    enterTenant(tenantId);
    navigate('/dashboard');
  };

  const handleToggleSuspend = (t: Tenant) => {
    updateTenant(t.id, { status: t.status === 'active' ? 'suspended' : 'active' });
    setSuspendingTenant(null);
  };

  const handleDeleteTenant = () => {
    if (!deletingTenant) return;
    // Delete all users in this tenant
    allUsers.filter(u => u.tenantId === deletingTenant.id).forEach(u => deleteUser(u.id));
    deleteTenant(deletingTenant.id);
    setDeletingTenant(null);
  };

  // Summary stats
  const stats = useMemo(() => ({
    total:     tenants.length,
    active:    tenants.filter(t => t.status === 'active').length,
    suspended: tenants.filter(t => t.status === 'suspended').length,
    totalUsers: allUsers.length,
  }), [tenants, allUsers]);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview',      icon: BarChart2  },
    { id: 'tenants',  label: 'Tenants',        icon: Building2  },
    { id: 'users',    label: 'All Users',      icon: Users      },
  ];

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="border-b border-slate-100 bg-white px-8 pt-8 pb-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <Globe className="w-4 h-4 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Administration</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6">Manage all tenants, users, and platform settings.</p>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSearch(''); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8">
        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Tenants',    value: stats.total,     colour: 'text-slate-800', icon: Building2 },
                { label: 'Active Tenants',   value: stats.active,    colour: 'text-green-700', icon: Check },
                { label: 'Suspended',        value: stats.suspended, colour: 'text-amber-700', icon: ToggleLeft },
                { label: 'Platform Users',   value: stats.totalUsers, colour: 'text-brand-700', icon: Users },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-5 shadow-card">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</span>
                    <s.icon className={cn('w-4 h-4', s.colour)} />
                  </div>
                  <p className={cn('text-3xl font-bold', s.colour)}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Recent tenants */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
                <h2 className="text-sm font-semibold text-slate-800">Tenants</h2>
                <Button size="sm" onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> New Tenant
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-6 py-3">Organisation</th>
                    <th className="text-left px-6 py-3">Plan</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Users</th>
                    <th className="text-left px-6 py-3">Created</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tenants.map(t => {
                    const tenantUsers = allUsers.filter(u => u.tenantId === t.id);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.colour }} />
                            <div>
                              <p className="font-medium text-slate-800">{t.name}</p>
                              <p className="text-xs text-slate-400">{t.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PLAN_COLOUR[t.plan])}>{PLAN_LABELS[t.plan]}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_COLOUR[t.status])}>{t.status}</span>
                        </td>
                        <td className="px-6 py-3 text-slate-600">{tenantUsers.length}</td>
                        <td className="px-6 py-3 text-slate-400">{formatDate(t.createdAt)}</td>
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => handleEnterTenant(t.id)}
                            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium ml-auto"
                          >
                            <LogIn className="w-3.5 h-3.5" /> Enter
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tenants Tab ── */}
        {tab === 'tenants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search tenants…"
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-3.5 h-3.5" /></button>}
              </div>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> New Tenant
              </Button>
            </div>

            <div className="space-y-3">
              {filteredTenants.map(t => {
                const tenantUsers = allUsers.filter(u => u.tenantId === t.id);
                return (
                  <div key={t.id} className="bg-white rounded-xl border border-slate-100 shadow-card p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${t.colour}20` }}>
                          <Building2 className="w-5 h-5" style={{ color: t.colour }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-semibold text-slate-800">{t.name}</h3>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PLAN_COLOUR[t.plan])}>{PLAN_LABELS[t.plan]}</span>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_COLOUR[t.status])}>{t.status}</span>
                          </div>
                          <p className="text-xs text-slate-400">/{t.slug} · {tenantUsers.length} user{tenantUsers.length !== 1 ? 's' : ''} · Created {formatDate(t.createdAt)}</p>
                          {t.contactEmail && (
                            <p className="text-xs text-slate-500 mt-1">{t.contactName} — {t.contactEmail}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEnterTenant(t.id)}
                          className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          <LogIn className="w-3.5 h-3.5" /> Enter Tenant
                        </button>
                        <button
                          onClick={() => setEditingTenant(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSuspendingTenant(t)}
                          className={cn('p-1.5 rounded-lg transition-colors', t.status === 'active' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-500 hover:text-green-600 hover:bg-green-50')}
                          title={t.status === 'active' ? 'Suspend' : 'Reactivate'}
                        >
                          {t.status === 'active' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setDeletingTenant(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Tenant users preview */}
                    {tenantUsers.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-50">
                        <div className="flex flex-wrap gap-2">
                          {tenantUsers.slice(0, 5).map(u => (
                            <div key={u.id} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2.5 py-1">
                              <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {u.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              <span className="text-xs text-slate-600">{u.displayName}</span>
                              <span className="text-xs text-slate-400">· {ROLE_LABELS[u.role]}</span>
                            </div>
                          ))}
                          {tenantUsers.length > 5 && (
                            <span className="text-xs text-slate-400 self-center">+{tenantUsers.length - 5} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredTenants.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                  <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No tenants found.</p>
                  {!search && <button onClick={() => setShowCreateModal(true)} className="text-sm text-brand-600 hover:underline mt-1">Create the first tenant</button>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── All Users Tab ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search users…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-3.5 h-3.5" /></button>}
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-6 py-3">User</th>
                    <th className="text-left px-6 py-3">Role</th>
                    <th className="text-left px-6 py-3">Tenant</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map(u => {
                    const tenant = tenants.find(t => t.id === u.tenantId);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {u.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{u.displayName}</p>
                              <p className="text-xs text-slate-400">@{u.username} · {u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            {ROLE_LABELS[u.role]}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          {tenant ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tenant.colour }} />
                              <span className="text-xs text-slate-600">{tenant.name}</span>
                            </div>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-6 py-3">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', u.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                            {u.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-xs text-slate-400">
                          {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No users found.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Create Tenant Modal ── */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Tenant"
        size="lg"
      >
        <TenantForm
          editing={false}
          onSave={handleCreateTenant}
          onClose={() => setShowCreateModal(false)}
          isSlugTaken={slug => isSlugTaken(slug)}
        />
      </Modal>

      {/* ── Edit Tenant Modal ── */}
      {editingTenant && (
        <Modal
          isOpen
          onClose={() => setEditingTenant(null)}
          title={`Edit: ${editingTenant.name}`}
          size="lg"
        >
          <TenantForm
            editing
            initial={{
              name: editingTenant.name,
              slug: editingTenant.slug,
              colour: editingTenant.colour,
              plan: editingTenant.plan,
              contactName: editingTenant.contactName,
              contactEmail: editingTenant.contactEmail,
              notes: editingTenant.notes,
              adminUsername: '', adminDisplayName: '', adminEmail: '', adminPassword: '',
              maxUsers: editingTenant.settings.maxUsers,
              maxWorkspaces: editingTenant.settings.maxWorkspaces,
            }}
            onSave={handleEditTenant}
            onClose={() => setEditingTenant(null)}
            isSlugTaken={slug => isSlugTaken(slug, editingTenant.id)}
          />
        </Modal>
      )}

      {/* ── Suspend/Reactivate Confirm ── */}
      {suspendingTenant && (
        <Modal
          isOpen
          onClose={() => setSuspendingTenant(null)}
          title={suspendingTenant.status === 'active' ? 'Suspend Tenant' : 'Reactivate Tenant'}
          size="sm"
        >
          <p className="text-sm text-slate-600 mb-6">
            {suspendingTenant.status === 'active'
              ? `Suspend "${suspendingTenant.name}"? Their users will not be able to log in until reactivated.`
              : `Reactivate "${suspendingTenant.name}"? Their users will regain access immediately.`
            }
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setSuspendingTenant(null)}>Cancel</Button>
            <Button
              variant={suspendingTenant.status === 'active' ? 'danger' : 'primary'}
              onClick={() => handleToggleSuspend(suspendingTenant)}
            >
              {suspendingTenant.status === 'active' ? 'Suspend' : 'Reactivate'}
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {deletingTenant && (
        <Modal
          isOpen
          onClose={() => setDeletingTenant(null)}
          title="Delete Tenant"
          size="sm"
        >
          <div className="p-3 bg-red-50 rounded-lg mb-4">
            <p className="text-sm font-semibold text-red-700">This action is permanent and cannot be undone.</p>
          </div>
          <p className="text-sm text-slate-600 mb-2">
            Deleting <strong>{deletingTenant.name}</strong> will permanently remove:
          </p>
          <ul className="text-sm text-slate-500 list-disc list-inside mb-6 space-y-1">
            <li>All user accounts in this tenant</li>
            <li>All workspace records (tasks, payments, contacts)</li>
            <li>All stored data and files</li>
          </ul>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeletingTenant(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteTenant}>Delete Permanently</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
