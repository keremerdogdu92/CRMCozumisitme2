export type Role = 'admin' | 'staff';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}
