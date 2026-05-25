// src/features/tasks/api.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type {
  AssignableProfile,
  NewTaskForm,
  TaskPriority,
  TaskRow,
  TaskStatus,
} from './types';

export const TASKS_QUERY_KEY = ['tasks'] as const;
export const ASSIGNABLE_PROFILES_QUERY_KEY = ['assignable-profiles'] as const;

async function getCurrentProfileContext(): Promise<{
  userId: string;
  orgId: string;
}> {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw new Error('TASK_USER: ' + userError.message);
  const user = userData.user;
  if (!user) throw new Error('TASK_USER: Kullanici oturumu bulunamadi.');

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, org_id')
    .eq('id', user.id)
    .single();

  if (error) throw new Error('TASK_PROFILE: ' + error.message);
  if (!data?.org_id) throw new Error('TASK_NO_ORG: Profilde org_id bulunamadi.');

  return { userId: data.id as string, orgId: data.org_id as string };
}

export async function fetchTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabaseClient
    .from('tasks')
    .select(
      `
      id,
      org_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_at,
      completed_at,
      created_at,
      deleted_at
    `,
    )
    .is('deleted_at', null)
    .order('status', { ascending: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error('TASK_FETCH: ' + error.message);
  return (data ?? []) as TaskRow[];
}

export async function fetchAssignableProfiles(): Promise<AssignableProfile[]> {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, role')
    .order('role', { ascending: true });

  if (error) throw new Error('TASK_PROFILE_FETCH: ' + error.message);

  return ((data ?? []) as Array<{ id: string; role: string | null }>).map((row) => ({
    id: row.id,
    role: row.role === 'admin' || row.role === 'staff' ? row.role : 'unknown',
    full_name: null,
  }));
}

export async function createTask(input: NewTaskForm): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Gorev basligi zorunludur.');

  const { userId, orgId } = await getCurrentProfileContext();
  const dueAt = input.dueAt
    ? new Date(`${input.dueAt}T12:00:00+03:00`).toISOString()
    : null;

  const { error } = await supabaseClient.from('tasks').insert({
    org_id: orgId,
    title,
    description: input.description.trim() || null,
    priority: input.priority,
    assigned_to: input.assignedTo || null,
    created_by: userId,
    due_at: dueAt,
  });

  if (error) throw new Error('TASK_CREATE: ' + error.message);
}

export async function updateTaskStatus(input: {
  taskId: string;
  status: TaskStatus;
}): Promise<void> {
  const { error } = await supabaseClient
    .from('tasks')
    .update({
      status: input.status,
      completed_at: input.status === 'done' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.taskId);

  if (error) throw new Error('TASK_UPDATE_STATUS: ' + error.message);
}

export async function updateTaskBasics(input: {
  taskId: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  priority: TaskPriority;
  dueAt: string | null;
}): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Gorev basligi zorunludur.');

  const dueAt = input.dueAt
    ? new Date(`${input.dueAt}T12:00:00+03:00`).toISOString()
    : null;

  const { error } = await supabaseClient
    .from('tasks')
    .update({
      title,
      description: input.description?.trim() || null,
      assigned_to: input.assignedTo || null,
      priority: input.priority,
      due_at: dueAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.taskId);

  if (error) throw new Error('TASK_UPDATE: ' + error.message);
}

export function useTasks() {
  return useQuery({
    queryKey: TASKS_QUERY_KEY,
    queryFn: fetchTasks,
  });
}

export function useAssignableProfiles() {
  return useQuery({
    queryKey: ASSIGNABLE_PROFILES_QUERY_KEY,
    queryFn: fetchAssignableProfiles,
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}

export function useUpdateTaskStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTaskStatus,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}
