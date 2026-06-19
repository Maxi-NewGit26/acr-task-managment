// ============================================================================
// RBAC: Role-Based Access Control — Centralized Permission Engine
// ============================================================================

import type { UserRole } from './context/AppContext';

// ---------------------------------------------------------------------------
// Permission identifiers
// ---------------------------------------------------------------------------

export type Permission =
  // Task permissions
  | 'task:view_all'          // View all tasks (regardless of confidentiality)
  | 'task:view_public'       // View Public/Internal tasks only
  | 'task:view_assigned'     // View tasks where user has subtask assignment
  | 'task:create'            // Create new tasks / bookings
  | 'task:edit_own'          // Edit tasks you created
  | 'task:edit_all'          // Edit any task
  | 'task:cancel_own'        // Cancel tasks you created
  | 'task:cancel_all'        // Cancel any task
  // Booking / Approval permissions
  | 'booking:approve_vip'    // Approve / Reject VIP room bookings
  | 'booking:view_all'       // View all booking requests
  // Assignment permissions
  | 'assignment:view_own'    // View only your role's assignments
  | 'assignment:view_all'    // View all assignments across roles
  | 'assignment:update_own'  // Update status of your assigned subtasks
  // Admin permissions
  | 'admin:manage_rooms'     // CRUD rooms
  | 'admin:manage_execs'     // CRUD executives
  | 'admin:manage_users'     // CRUD users
  | 'admin:view_logs'        // View activity logs
  // Menu visibility
  | 'menu:dashboard'
  | 'menu:calendar'
  | 'menu:book_room'
  | 'menu:approval_center'
  | 'menu:reports'
  | 'menu:digital_signage'
  | 'menu:admin_settings'
  | 'menu:exec_status'
  | 'exec_status:write';

// ---------------------------------------------------------------------------
// Permission Matrix — single source of truth
// ---------------------------------------------------------------------------

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  'Super Admin': new Set<Permission>([
    'task:view_all', 'task:view_public', 'task:view_assigned',
    'task:create', 'task:edit_own', 'task:edit_all', 'task:cancel_own', 'task:cancel_all',
    'booking:approve_vip', 'booking:view_all',
    'assignment:view_own', 'assignment:view_all', 'assignment:update_own',
    'admin:manage_rooms', 'admin:manage_execs', 'admin:manage_users', 'admin:view_logs',
    'menu:dashboard', 'menu:calendar', 'menu:book_room', 'menu:approval_center',
    'menu:reports', 'menu:digital_signage', 'menu:admin_settings', 'menu:exec_status', 'exec_status:write',
  ]),

  'Admin': new Set<Permission>([
    'task:view_all', 'task:view_public', 'task:view_assigned',
    'task:create', 'task:edit_own', 'task:edit_all', 'task:cancel_own', 'task:cancel_all',
    'booking:approve_vip', 'booking:view_all',
    'assignment:view_own', 'assignment:view_all', 'assignment:update_own',
    'admin:manage_rooms', 'admin:view_logs',
    'menu:dashboard', 'menu:calendar', 'menu:book_room', 'menu:approval_center',
    'menu:reports', 'menu:digital_signage', 'menu:admin_settings', 'menu:exec_status', 'exec_status:write',
  ]),

  'Secretary': new Set<Permission>([
    'task:view_all', 'task:view_public', 'task:view_assigned',
    'task:create', 'task:edit_own', 'task:cancel_own',
    'booking:view_all',
    'assignment:view_own', 'assignment:view_all',
    'admin:view_logs',
    'menu:dashboard', 'menu:calendar', 'menu:book_room', 'menu:approval_center',
    'menu:reports', 'menu:digital_signage', 'menu:exec_status', 'exec_status:write',
  ]),

  'Executive': new Set<Permission>([
    'task:view_public', 'task:view_assigned',
    'task:create', 'task:edit_own', 'task:cancel_own',
    'booking:approve_vip', 'booking:view_all',
    'assignment:view_own',
    'menu:dashboard', 'menu:calendar', 'menu:book_room', 'menu:approval_center',
    'menu:reports', 'menu:digital_signage', 'menu:exec_status',
  ]),

  'Facility Officer': new Set<Permission>([
    'task:view_public', 'task:view_assigned',
    'assignment:view_own', 'assignment:update_own',
    'menu:dashboard', 'menu:calendar', 'menu:digital_signage', 'menu:exec_status',
  ]),

  'IT Support': new Set<Permission>([
    'task:view_public', 'task:view_assigned',
    'assignment:view_own', 'assignment:update_own',
    'menu:dashboard', 'menu:calendar', 'menu:approval_center', 'menu:digital_signage', 'menu:exec_status',
  ]),

  'Housekeeping': new Set<Permission>([
    'task:view_public', 'task:view_assigned',
    'assignment:view_own', 'assignment:update_own',
    'menu:dashboard', 'menu:calendar', 'menu:digital_signage', 'menu:exec_status',
  ]),

  'General User': new Set<Permission>([
    'task:view_public',
    'task:create', 'task:edit_own', 'task:cancel_own',
    'menu:dashboard', 'menu:calendar', 'menu:book_room', 'menu:digital_signage', 'menu:exec_status',
  ]),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Check whether a role has a specific permission. */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** Return the full set of permissions for a role. */
export function getPermissions(role: UserRole): Set<Permission> {
  return ROLE_PERMISSIONS[role] ?? new Set();
}

// ---------------------------------------------------------------------------
// Menu helpers
// ---------------------------------------------------------------------------

export interface MenuDef {
  name: string;
  permission: Permission;
}

/** All application menu items and their required permission. */
export const ALL_MENU_ITEMS: MenuDef[] = [
  { name: 'Dashboard',        permission: 'menu:dashboard' },
  { name: 'Calendar',         permission: 'menu:calendar' },
  { name: 'Book a Room',      permission: 'menu:book_room' },
  { name: 'Approval Center',  permission: 'menu:approval_center' },
  { name: 'Reports',          permission: 'menu:reports' },
  { name: 'Digital Signage',  permission: 'menu:digital_signage' },
  { name: 'Executive Status',  permission: 'menu:exec_status' },
  { name: 'Admin Settings',   permission: 'menu:admin_settings' },
];

/** Return only the menu names that a role is allowed to see. */
export function getVisibleMenuNames(role: UserRole): string[] {
  return ALL_MENU_ITEMS
    .filter(m => hasPermission(role, m.permission))
    .map(m => m.name);
}

// ---------------------------------------------------------------------------
// Dynamic (context-aware) authorization helpers
// ---------------------------------------------------------------------------

/** Can the current user edit this task? */
export function canEditTask(
  role: UserRole,
  taskCreatedBy: string,
  currentUserId: string,
): boolean {
  if (hasPermission(role, 'task:edit_all')) return true;
  if (hasPermission(role, 'task:edit_own') && taskCreatedBy === currentUserId) return true;
  return false;
}

/** Can the current user cancel this task? */
export function canCancelTask(
  role: UserRole,
  taskCreatedBy: string,
  currentUserId: string,
): boolean {
  if (hasPermission(role, 'task:cancel_all')) return true;
  if (hasPermission(role, 'task:cancel_own') && taskCreatedBy === currentUserId) return true;
  return false;
}
