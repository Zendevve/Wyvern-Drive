export const AUDIT_ACTIONS = [
  'login',
  'logout',
  'upload',
  'download',
  'delete',
  'rename',
  'move',
  'share',
  'settings_change',
  'session_restore'
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_OUTCOMES = ['success', 'error', 'cancelled'] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  login: 'Sign in',
  logout: 'Sign out',
  upload: 'Upload',
  download: 'Download',
  delete: 'Delete',
  rename: 'Rename',
  move: 'Move',
  share: 'Share',
  settings_change: 'Settings change',
  session_restore: 'Session restore'
};
