// src/features/tasks/types.ts

import type { UserRole } from '../auth/useCurrentProfile';

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type TaskRow = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  created_by: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type AssignableProfile = {
  id: string;
  role: UserRole;
  display_name: string | null;
};

export type NewTaskForm = {
  title: string;
  description: string;
  assignedTo: string;
  priority: TaskPriority;
  dueAt: string;
};
