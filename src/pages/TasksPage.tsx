// src/pages/TasksPage.tsx

import { useMemo, useState, type FormEvent } from 'react';
import {
  useAssignableProfiles,
  useCreateTaskMutation,
  useTasks,
  useUpdateTaskStatusMutation,
} from '../features/tasks/api';
import type {
  NewTaskForm,
  TaskPriority,
  TaskRow,
  TaskStatus,
} from '../features/tasks/types';

const EMPTY_FORM: NewTaskForm = {
  title: '',
  description: '',
  assignedTo: '',
  priority: 'normal',
  dueAt: '',
};

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Dusuk' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yuksek' },
  { value: 'urgent', label: 'Acil' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'open', label: 'Acik' },
  { value: 'in_progress', label: 'Devam ediyor' },
  { value: 'done', label: 'Tamamlandi' },
  { value: 'cancelled', label: 'Iptal' },
];

function formatDate(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString('tr-TR');
}

function getTaskClass(task: TaskRow): string {
  if (task.status === 'done') return 'border-emerald-200 bg-emerald-50/50';
  if (task.priority === 'urgent') return 'border-red-200 bg-red-50/50';
  if (task.priority === 'high') return 'border-amber-200 bg-amber-50/50';
  return 'border-slate-200 bg-white';
}

export default function TasksPage() {
  const { data: tasks, isLoading, isError, error } = useTasks();
  const { data: profiles } = useAssignableProfiles();
  const createMutation = useCreateTaskMutation();
  const statusMutation = useUpdateTaskStatusMutation();
  const [form, setForm] = useState<NewTaskForm>(EMPTY_FORM);

  const profileLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    (profiles ?? []).forEach((profile, index) => {
      map.set(profile.id, `${profile.role === 'admin' ? 'Admin' : 'Personel'} ${index + 1}`);
    });
    return map;
  }, [profiles]);

  function patch<K extends keyof NewTaskForm>(key: K, value: NewTaskForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate(form, {
      onSuccess: () => setForm(EMPTY_FORM),
    });
  }

  return (
    <div className="space-y-5 py-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Gorevler</h2>
        <p className="mt-1 text-xs text-slate-500">
          Ayni organizasyondaki kullanicilar birbirlerine takip gorevi acabilir.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Yeni gorev</h3>
        <form className="mt-3 grid gap-3 text-xs md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="space-y-1 md:col-span-2">
            <span className="font-medium text-slate-700">Baslik</span>
            <input
              type="text"
              value={form.title}
              onChange={(event) => patch('title', event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="font-medium text-slate-700">Aciklama</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => patch('description', event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </label>

          <label className="space-y-1">
            <span className="font-medium text-slate-700">Atanan kisi</span>
            <select
              value={form.assignedTo}
              onChange={(event) => patch('assignedTo', event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Atanmadi</option>
              {(profiles ?? []).map((profile, index) => (
                <option key={profile.id} value={profile.id}>
                  {profile.role === 'admin' ? 'Admin' : 'Personel'} {index + 1}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="font-medium text-slate-700">Oncelik</span>
            <select
              value={form.priority}
              onChange={(event) => patch('priority', event.target.value as TaskPriority)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="font-medium text-slate-700">Son tarih</span>
            <input
              type="date"
              value={form.dueAt}
              onChange={(event) => patch('dueAt', event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </label>

          <div className="flex items-end justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60 sm:w-auto"
            >
              {createMutation.isPending ? 'Kaydediliyor...' : 'Gorev ac'}
            </button>
          </div>

          {createMutation.error && (
            <p className="md:col-span-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {(createMutation.error as Error).message}
            </p>
          )}
        </form>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Bekleyen gorevler</h3>
        {isLoading && <p className="text-sm text-slate-500">Gorevler yukleniyor...</p>}
        {isError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {(error as Error)?.message ?? 'Gorevler yuklenemedi.'}
          </p>
        )}
        {!isLoading && !isError && (tasks ?? []).length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Henuz gorev yok.
          </div>
        )}
        <div className="grid gap-3">
          {(tasks ?? []).map((task) => (
            <article
              key={task.id}
              className={`rounded-lg border p-4 shadow-sm ${getTaskClass(task)}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900">{task.title}</h4>
                  {task.description && (
                    <p className="mt-1 text-xs text-slate-600">{task.description}</p>
                  )}
                  <p className="mt-2 text-[11px] text-slate-500">
                    Atanan: {task.assigned_to ? profileLabelMap.get(task.assigned_to) ?? task.assigned_to : '-'} | Son tarih:{' '}
                    {formatDate(task.due_at)}
                  </p>
                </div>
                <select
                  value={task.status}
                  disabled={statusMutation.isPending}
                  onChange={(event) =>
                    statusMutation.mutate({
                      taskId: task.id,
                      status: event.target.value as TaskStatus,
                    })
                  }
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
