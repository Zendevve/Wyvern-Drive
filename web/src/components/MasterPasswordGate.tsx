import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useCryptoStore } from '../store/crypto';
import {
  hasMasterPassword,
  setMasterPassword,
  unlock,
  wipe as wipeSecretStore
} from '../lib/secretStore';
import { recordAuditEvent, newCorrelationId } from '../lib/auditMiddleware';

export type MasterPasswordStatus = 'loading' | 'unset' | 'set-locked' | 'set-unlocked' | 'skipped';

export interface MasterPasswordGateProps {
  children: React.ReactNode;
  onUnlocked?: () => void;
}

export function MasterPasswordGate({ children, onUnlocked }: MasterPasswordGateProps) {
  const [status, setStatus] = useState<MasterPasswordStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const has = await hasMasterPassword();
        if (cancelled) return;
        setStatus(has ? 'set-locked' : 'unset');
      } catch {
        if (cancelled) return;
        setStatus('unset');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onSetDone(): void {
    setStatus('set-unlocked');
    onUnlocked?.();
  }

  function onUnlockDone(): void {
    setStatus('set-unlocked');
    onUnlocked?.();
  }

  function onSkip(): void {
    setStatus('skipped');
    onUnlocked?.();
  }

  return (
    <>
      {children}
      {status === 'unset' ? (
        <SetMasterPasswordModal open onClose={onSkip} onDone={onSetDone} />
      ) : null}
      {status === 'set-locked' ? (
        <UnlockModal open onClose={() => undefined} onDone={onUnlockDone} />
      ) : null}
    </>
  );
}

interface SetModalProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export function SetMasterPasswordModal({ open, onClose, onDone }: SetModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setHandle = useCryptoStore((s) => s.setHandle);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }
    if (passphrase !== confirm) {
      setError('Passphrases do not match');
      return;
    }
    if (!webhookUrl.trim()) {
      setError('Webhook URL is required');
      return;
    }
    setBusy(true);
    try {
      const { handle } = await setMasterPassword({
        passphrase,
        webhookUrl: webhookUrl.trim()
      });
      setHandle(handle);
      setPassphrase('');
      setConfirm('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set master password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Set master passphrase"
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Skip — use session-only auth
          </Button>
          <Button type="submit" form="set-mp-form" loading={busy}>
            Set passphrase
          </Button>
        </div>
      }
    >
      <p className="modal-prose">
        This passphrase protects your webhook URL and any encrypted files. If you lose it, files stored
        encrypted in Discord become inaccessible.
      </p>
      <form id="set-mp-form" onSubmit={onSubmit} className="modal-form">
        <label className="auth-label" htmlFor="mp-pass">Passphrase</label>
        <input
          id="mp-pass"
          className="auth-input"
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <label className="auth-label" htmlFor="mp-confirm">Confirm passphrase</label>
        <input
          id="mp-confirm"
          className="auth-input"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <label className="auth-label" htmlFor="mp-webhook">Discord webhook URL</label>
        <input
          id="mp-webhook"
          className="auth-input mono"
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
      </form>
    </Modal>
  );
}

interface UnlockProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export function UnlockModal({ open, onClose, onDone }: UnlockProps) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const setHandle = useCryptoStore((s) => s.setHandle);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { handle } = await unlock(passphrase);
      setHandle(handle);
      setPassphrase('');
      onDone();
    } catch (err) {
      const next = attempts + 1;
      setAttempts(next);
      setError(err instanceof Error ? err.message : 'Unlock failed');
      if (next >= 5) {
        await wipeSecretStore();
        await recordAuditEvent({
          action: 'master_password_unlock_failed',
          target_id: null,
          target_type: 'secret_store',
          outcome: 'error',
          correlation_id: newCorrelationId(),
          metadata: { attempt: next, wiped: true }
        });
        setError('Too many failed attempts. Store wiped — please set a new passphrase.');
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Unlock vault"
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <Button type="submit" form="unlock-mp-form" loading={busy}>
            Unlock
          </Button>
        </div>
      }
    >
      <p className="modal-prose">
        Enter your master passphrase to decrypt the vault.
      </p>
      <form id="unlock-mp-form" onSubmit={onSubmit} className="modal-form">
        <label className="auth-label" htmlFor="unlock-pass">Passphrase</label>
        <input
          id="unlock-pass"
          className="auth-input"
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoComplete="current-password"
          required
          autoFocus
        />
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
        {attempts > 0 ? (
          <div className="auth-helper">{5 - attempts} attempts remaining</div>
        ) : null}
      </form>
    </Modal>
  );
}

interface ChangeProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export function ChangeMasterPasswordModal({ open, onClose, onDone }: ChangeProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError('New passphrase must be at least 8 characters');
      return;
    }
    if (next !== confirm) {
      setError('New passphrases do not match');
      return;
    }
    setBusy(true);
    try {
      const currentUnlock = await unlock(current);
      await setMasterPassword({
        passphrase: next,
        webhookUrl: currentUnlock.webhookUrl
      });
      setCurrent('');
      setNext('');
      setConfirm('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change master password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Change master passphrase"
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="change-mp-form" loading={busy}>
            Change passphrase
          </Button>
        </div>
      }
    >
      <form id="change-mp-form" onSubmit={onSubmit} className="modal-form">
        <label className="auth-label" htmlFor="chg-current">Current passphrase</label>
        <input
          id="chg-current"
          className="auth-input"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
        <label className="auth-label" htmlFor="chg-next">New passphrase</label>
        <input
          id="chg-next"
          className="auth-input"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <label className="auth-label" htmlFor="chg-confirm">Confirm new passphrase</label>
        <input
          id="chg-confirm"
          className="auth-input"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
      </form>
    </Modal>
  );
}
