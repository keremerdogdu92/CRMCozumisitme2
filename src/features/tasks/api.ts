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
    .select('id, role, display_name')
    .order('role', { ascending: true });

  if (error) throw new Error('TASK_PROFILE_FETCH: ' + error.message);

  return ((data ?? []) as Array<{
    id: string;
    role: string | null;
    display_name: string | null;
  }>).map((row) => ({
    id: row.id,
    role: row.role === 'admin' || row.role === 'staff' ? row.role : 'unknown',
    display_name: row.display_name ?? null,
  }));
}

export async function createTask(input: NewTaskForm): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Gorev basligi zorunludur.');

  const dueAt = input.dueAt
    ? new Date(`${input.dueAt}T12:00:00+03:00`).toISOString()
    : null;

  const { error } = await supabaseClient.rpc('create_task', {
    p_title: title,
    p_description: input.description.trim() || null,
    p_assigned_to: input.assignedTo || null,
    p_priority: input.priority,
    p_due_at: dueAt,
  });

  if (error) throw new Error('TASK_CREATE: ' + error.message);
}

export async function updateTaskStatus(input: {
  taskId: string;
  status: TaskStatus;
}): Promise<void> {
  const { error } = await supabaseClient
    .rpc('update_task_status', {
      p_task_id: input.taskId,
      p_status: input.status,
    });

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

  const { error } = await supabaseClient.rpc('update_task', {
    p_task_id: input.taskId,
    p_title: title,
    p_description: input.description?.trim() || null,
    p_assigned_to: input.assignedTo || null,
    p_priority: input.priority,
    p_due_at: dueAt,
  });

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

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTaskBasics,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}
