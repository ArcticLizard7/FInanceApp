import { create } from 'zustand';
import { uuidv4 } from '@/utils/id';
import type { Task, TaskStatus } from '@/types';
import { storage } from '@/services/storageService';
import { defaultTasks, DEMO_TENANT_ID } from '@/data/mockData';
import { recurringService } from '@/services/recurringService';
import { useAuthStore } from '@/stores/authStore';
import { useSupabaseBackend } from '@/config/runtime';
import { requireSupabase } from '@/services/supabaseClient';
import { taskFromRow, taskToInsert, taskUpdatesToRow } from '@/services/supabaseMappers';

interface TaskStore {
  tasks: Task[];
  init: () => Promise<void> | void;
  getWorkspaceTasks: (workspaceId: string) => Task[];
  getTenantTasks: () => Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'attachments' | 'tags' | 'checklist'> & {
    tenantId?: string;
    attachments?: Task['attachments'];
    tags?: string[];
    checklist?: Task['checklist'];
  }) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  duplicateTask: (id: string) => Task;
  moveTask: (id: string, newStatus: TaskStatus) => void;
  importTasks: (tasks: Task[]) => void;
}

const KEY = 'tasks';

const normaliseTask = (task: Task): Task => ({
  ...task,
  attachments: task.attachments ?? [],
  tags: task.tags ?? [],
  checklist: task.checklist ?? [],
});

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],

  async init() {
    if (useSupabaseBackend) {
      const { activeTenantId } = useAuthStore.getState();
      if (!activeTenantId) {
        set({ tasks: [] });
        return;
      }

      const { data, error } = await requireSupabase()
        .from('tasks')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('due_date', { nullsFirst: false });

      if (error) {
        console.error('Failed to load tasks', error);
        set({ tasks: [] });
        return;
      }

      set({ tasks: (data ?? []).map(taskFromRow).map(normaliseTask) });
      return;
    }

    const raw = storage.get<Task[] | null>(KEY, null);
    let tasks = (raw ?? defaultTasks).map(normaliseTask);
    if (!raw) {
      storage.set(KEY, tasks);
    } else {
      const needsMigration = tasks.some(t => !t.tenantId || !t.attachments || !t.tags || !t.checklist);
      if (needsMigration) {
        tasks = tasks.map(t => normaliseTask(t.tenantId ? t : { ...t, tenantId: DEMO_TENANT_ID }));
        storage.set(KEY, tasks);
      }
    }
    set({ tasks });
  },

  getTenantTasks() {
    const { activeTenantId } = useAuthStore.getState();
    if (!activeTenantId) return [];
    return get().tasks.filter(t => t.tenantId === activeTenantId);
  },

  getWorkspaceTasks(workspaceId) {
    const { activeTenantId } = useAuthStore.getState();
    return get().tasks.filter(t =>
      t.workspaceId === workspaceId &&
      (!activeTenantId || t.tenantId === activeTenantId)
    );
  },

  addTask(data) {
    const { activeTenantId } = useAuthStore.getState();
    const task: Task = {
      ...data,
      tenantId: data.tenantId || activeTenantId || '',
      attachments: data.attachments ?? [],
      tags: data.tags ?? [],
      checklist: data.checklist ?? [],
      id: useSupabaseBackend ? crypto.randomUUID() : `task_${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const tasks = [...get().tasks, task];
    if (useSupabaseBackend) {
      requireSupabase().from('tasks').insert(taskToInsert(task)).then(({ error }) => {
        if (error) console.error('Failed to create task', error);
      });
    } else {
      storage.set(KEY, tasks);
    }
    set({ tasks });
    return task;
  },

  updateTask(id, updates) {
    const tasks = get().tasks.map(t =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    if (useSupabaseBackend) {
      requireSupabase().from('tasks').update(taskUpdatesToRow(updates)).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to update task', error);
      });
    } else {
      storage.set(KEY, tasks);
    }
    set({ tasks });
  },

  deleteTask(id) {
    const tasks = get().tasks.filter(t => t.id !== id);
    if (useSupabaseBackend) {
      requireSupabase().from('tasks').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to delete task', error);
      });
    } else {
      storage.set(KEY, tasks);
    }
    set({ tasks });
  },

  completeTask(id) {
    const task = get().tasks.find(t => t.id === id);
    if (!task) return;

    const completed: Task = {
      ...task,
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let tasks = get().tasks.map(t => t.id === id ? completed : t);

    const next = recurringService.generateNextTask(completed);
    if (next) tasks = [...tasks, next];

    if (useSupabaseBackend) {
      const supabase = requireSupabase();
      supabase.from('tasks').update(taskUpdatesToRow(completed)).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to complete task', error);
      });
      if (next) {
        const nextTask = { ...next, id: crypto.randomUUID() };
        tasks = tasks.map(t => t.id === next.id ? nextTask : t);
        supabase.from('tasks').insert(taskToInsert(nextTask)).then(({ error }) => {
          if (error) console.error('Failed to create recurring task', error);
        });
      }
    } else {
      storage.set(KEY, tasks);
    }
    set({ tasks });
  },

  duplicateTask(id) {
    const task = get().tasks.find(t => t.id === id);
    if (!task) throw new Error('Task not found');

    const copy: Task = {
      ...task,
      id: useSupabaseBackend ? crypto.randomUUID() : `task_${uuidv4().slice(0, 8)}`,
      title: `${task.title} (Copy)`,
      status: 'todo',
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tasks = [...get().tasks, copy];
    if (useSupabaseBackend) {
      requireSupabase().from('tasks').insert(taskToInsert(copy)).then(({ error }) => {
        if (error) console.error('Failed to duplicate task', error);
      });
    } else {
      storage.set(KEY, tasks);
    }
    set({ tasks });
    return copy;
  },

  moveTask(id, newStatus) {
    get().updateTask(id, { status: newStatus });
  },

  importTasks(newTasks) {
    if (useSupabaseBackend) {
      const supabaseTasks = newTasks.map(t => ({ ...t, id: crypto.randomUUID() }));
      const tasks = [...get().tasks, ...supabaseTasks];
      requireSupabase()
        .from('tasks')
        .insert(supabaseTasks.map(t => taskToInsert(t)))
        .then(({ error }) => {
          if (error) console.error('Failed to import tasks', error);
        });
      set({ tasks });
    } else {
      const tasks = [...get().tasks, ...newTasks];
      storage.set(KEY, tasks);
      set({ tasks });
    }
  },
}));
