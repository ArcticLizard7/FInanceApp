import { useState } from 'react';
import { Plus, Edit2, Trash2, Archive, Star, Building2, User } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Modal } from '@/components/common/Modal';
import { Input, Select } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import type { Workspace, WorkspaceType } from '@/types';
import { POPULAR_CURRENCIES, currencyLabel } from '@/constants/currencies';

const PRESET_COLOURS = ['#6366f1','#0891b2','#db2777','#16a34a','#d97706','#7c3aed','#dc2626','#0284c7'];

type Tab = 'workspaces' | 'preferences' | 'integrations';

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('workspaces');
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 w-fit">
          {([
            { id: 'workspaces',   label: 'Workspaces' },
            { id: 'preferences',  label: 'Preferences' },
            { id: 'integrations', label: 'Integrations' },
          ] as { id: Tab; label: string }[]).map(t => (
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

        {tab === 'workspaces'   && <WorkspacesTab />}
        {tab === 'preferences'  && <PreferencesTab />}
        {tab === 'integrations' && <IntegrationsTab />}
      </div>
    </div>
  );
}

function WorkspacesTab() {
  const { workspaces, addWorkspace, updateWorkspace, deleteWorkspace, archiveWorkspace, setActiveWorkspace, activeWorkspace } = useWorkspaceStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage companies and personal workspace</p>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAdd(true)}>New Workspace</Button>
      </div>

      <div className="space-y-3">
        {workspaces.map(ws => (
          <div key={ws.id} className={cn(
            'bg-white rounded-xl border shadow-card p-4 flex items-center gap-4',
            ws.isArchived ? 'opacity-50 border-slate-100' : 'border-slate-100',
            ws.id === activeWorkspace?.id && 'border-brand-200 bg-brand-50/20'
          )}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: ws.colour }}>
              {ws.type === 'personal' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">{ws.name}</p>
                {ws.isDefault && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                {ws.id === activeWorkspace?.id && (
                  <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                )}
              </div>
              <p className="text-xs text-slate-400 capitalize">{ws.type} · {currencyLabel(ws.currency)}{ws.isArchived ? ' · Archived' : ''}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setActiveWorkspace(ws.id)} className="text-xs text-brand-600 hover:underline px-2">Switch</button>
              <button onClick={() => setEditing(ws)} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50"><Edit2 className="w-3.5 h-3.5" /></button>
              {!ws.isArchived && (
                <button onClick={() => archiveWorkspace(ws.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Archive"><Archive className="w-3.5 h-3.5" /></button>
              )}
              {workspaces.length > 1 && (
                <button onClick={() => deleteWorkspace(ws.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Workspace">
        <WorkspaceForm
          onSave={data => { addWorkspace(data); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Workspace">
        {editing && (
          <WorkspaceForm
            initial={editing}
            onSave={data => { updateWorkspace(editing.id, data); setEditing(null); }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

interface WorkspaceFormProps {
  initial?: Partial<Workspace>;
  onSave: (data: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>) => void;
  onCancel: () => void;
}

function WorkspaceForm({ initial, onSave, onCancel }: WorkspaceFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? 'company' as WorkspaceType,
    colour: initial?.colour ?? '#6366f1',
    currency: initial?.currency ?? 'GBP',
    isDefault: initial?.isDefault ?? false,
    isArchived: initial?.isArchived ?? false,
    hideFinanceFeatures: initial?.hideFinanceFeatures ?? false,
  });

  return (
    <div className="space-y-4">
      <Input
        label="Workspace Name"
        value={form.name}
        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        placeholder="e.g. Acme Developments Ltd"
      />
      <Select
        label="Type"
        value={form.type}
        onChange={e => setForm(p => ({ ...p, type: e.target.value as WorkspaceType }))}
        options={[{ value: 'company', label: 'Company' }, { value: 'personal', label: 'Personal' }]}
      />
      <Select
        label="Currency"
        value={form.currency}
        onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
        options={POPULAR_CURRENCIES}
      />

      <div>
        <label className="text-sm font-medium text-slate-700 block mb-1.5">Colour</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLOURS.map(c => (
            <button
              key={c}
              onClick={() => setForm(p => ({ ...p, colour: c }))}
              className={cn('w-8 h-8 rounded-lg transition-transform hover:scale-110', form.colour === c && 'ring-2 ring-offset-2 ring-slate-400')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.isDefault} onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))} className="rounded border-slate-300 text-brand-600" />
        <span className="text-sm text-slate-700">Set as default workspace</span>
      </label>

      {form.type === 'personal' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.hideFinanceFeatures} onChange={e => setForm(p => ({ ...p, hideFinanceFeatures: e.target.checked }))} className="rounded border-slate-300 text-brand-600" />
          <span className="text-sm text-slate-700">Hide finance features (personal use only)</span>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => form.name && onSave(form)} disabled={!form.name}>
          {initial?.name ? 'Save Changes' : 'Create Workspace'}
        </Button>
      </div>
    </div>
  );
}

function PreferencesTab() {
  const { preferences, updatePreferences } = useWorkspaceStore();
  return (
    <div className="space-y-6 max-w-md">
      <Select
        label="Default Priority"
        value={preferences.defaultPriority}
        onChange={e => updatePreferences({ defaultPriority: e.target.value as 'medium' })}
        options={[
          { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' },
        ]}
      />
      <Select
        label="Week Starts On"
        value={String(preferences.weekStartsOn)}
        onChange={e => updatePreferences({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
        options={[{ value: '0', label: 'Sunday' }, { value: '1', label: 'Monday' }]}
      />
      <p className="text-xs text-slate-400">More preferences will be available in future updates.</p>
    </div>
  );
}

function IntegrationsTab() {
  const integrations = [
    { name: 'Microsoft 365',  desc: 'Outlook calendar, Teams, Planner, OneDrive',         status: 'Coming soon', icon: '🪟' },
    { name: 'Xero',           desc: 'Accounting, invoices, bank feeds',                    status: 'Coming soon', icon: '🔷' },
    { name: 'Access COINS',   desc: 'Project finance, subcontract orders',                 status: 'Coming soon', icon: '🏗️' },
    { name: 'Power BI',       desc: 'Advanced reporting and dashboards',                   status: 'Coming soon', icon: '📊' },
    { name: 'Google Calendar',desc: 'Calendar sync for deadlines and reminders',           status: 'Coming soon', icon: '📅' },
    { name: 'SharePoint',     desc: 'Document storage and collaboration',                  status: 'Coming soon', icon: '📂' },
    { name: 'SendGrid',       desc: 'Email delegation and notifications',                  status: 'Coming soon', icon: '📧' },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 mb-4">
        These integrations will be available in a future release. The codebase is structured to support them via placeholder services.
      </p>
      {integrations.map(i => (
        <div key={i.name} className="bg-white rounded-xl border border-slate-100 shadow-card p-4 flex items-center gap-4">
          <span className="text-2xl">{i.icon}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">{i.name}</p>
            <p className="text-xs text-slate-400">{i.desc}</p>
          </div>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{i.status}</span>
        </div>
      ))}
    </div>
  );
}
