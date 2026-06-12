import { useState } from 'react';
import { Plus, Mail, Phone, Briefcase, Trash2, Edit2, Users } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useContactStore } from '@/stores/contactStore';
import { Modal } from '@/components/common/Modal';
import { Input, Textarea } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import type { Contact } from '@/types';

export function ContactsPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { getWorkspaceContacts, addContact, updateContact, deleteContact } = useContactStore();

  const [showAdd, setShowAdd] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const wsId = activeWorkspace?.id ?? '';
  const contacts = getWorkspaceContacts(wsId);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Contacts</h1>
            <p className="text-sm text-slate-500 mt-1">{contacts.length} contacts · used for task delegation</p>
          </div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAdd(true)}>Add Contact</Button>
        </div>

        {contacts.length === 0 ? (
          <EmptyState
            icon={<Users className="w-10 h-10" />}
            title="No contacts yet"
            description="Add contacts to delegate tasks by email."
            action={<Button onClick={() => setShowAdd(true)} icon={<Plus className="w-4 h-4" />}>Add Contact</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-slate-100 shadow-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
                    {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                    {c.role && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3 h-3" />{c.role}
                      </p>
                    )}
                    {c.company && c.company !== activeWorkspace?.name && (
                      <p className="text-xs text-slate-400">{c.company}</p>
                    )}
                    <div className="flex flex-col gap-0.5 mt-2">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                          <Mail className="w-3 h-3" />{c.email}
                        </a>
                      )}
                      {c.phone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />{c.phone}
                        </p>
                      )}
                    </div>
                    {c.notes && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{c.notes}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setEditingContact(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteContact(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Contact">
        <ContactForm
          workspaceId={wsId}
          onSave={data => { addContact(data); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>
      <Modal open={!!editingContact} onClose={() => setEditingContact(null)} title="Edit Contact">
        {editingContact && (
          <ContactForm
            initial={editingContact}
            workspaceId={wsId}
            onSave={data => { updateContact(editingContact.id, data); setEditingContact(null); }}
            onCancel={() => setEditingContact(null)}
          />
        )}
      </Modal>
    </div>
  );
}

interface ContactFormProps {
  initial?: Partial<Contact>;
  workspaceId: string;
  onSave: (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>) => void;
  onCancel: () => void;
}

function ContactForm({ initial, workspaceId, onSave, onCancel }: ContactFormProps) {
  const [form, setForm] = useState({
    workspaceId,
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    role: initial?.role ?? '',
    company: initial?.company ?? '',
    phone: initial?.phone ?? '',
    notes: initial?.notes ?? '',
  });

  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <Input label="Name *" value={form.name} onChange={e => set('name', e.target.value)} />
      <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Role / Job Title" value={form.role} onChange={e => set('role', e.target.value)} />
        <Input label="Company" value={form.company} onChange={e => set('company', e.target.value)} />
      </div>
      <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
      <Textarea label="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => form.name && onSave(form)} disabled={!form.name}>
          {initial?.name ? 'Save Changes' : 'Add Contact'}
        </Button>
      </div>
    </div>
  );
}
