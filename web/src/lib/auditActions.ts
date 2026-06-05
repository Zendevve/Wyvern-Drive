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
  'session_restore',
  'master_password_set',
  'master_password_unlock',
  'master_password_unlock_failed',
  'file_encrypted',
  'file_decrypted',
  'share_archive_created',
  'share_archive_imported',
  'create_folder'
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
  session_restore: 'Session restore',
  master_password_set: 'Set master passphrase',
  master_password_unlock: 'Unlock vault',
  master_password_unlock_failed: 'Unlock attempt failed',
  file_encrypted: 'Encrypt file',
  file_decrypted: 'Decrypt file',
  share_archive_created: 'Create share archive',
  share_archive_imported: 'Import share archive',
  create_folder: 'Create folder'
};

export interface MasterPasswordSetMeta {
  kdf: 'argon2id' | 'pbkdf2';
  used_fallback_kdf?: boolean;
}

export interface MasterPasswordUnlockFailedMeta {
  attempt: number;
  kdf?: 'argon2id' | 'pbkdf2';
  wiped?: boolean;
}

export interface FileEncryptedMeta {
  fileId: string;
  dekWrapMode: 'master' | 'passphrase';
  chunkCount: number;
}

export interface ShareArchiveMeta {
  fileId?: string;
  formatVersion: number;
  chunkCount: number;
}
