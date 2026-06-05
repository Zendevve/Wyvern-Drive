import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { decryptShareArchive, parseShareArchive, SHARE_ARCHIVE_MIME } from '../lib/shareArchive';
import { useToastsStore } from '../store/toasts';
import { newCorrelationId, recordAuditEvent } from '../lib/auditMiddleware';

interface ImportShareDropzoneProps {
  open: boolean;
  onClose: () => void;
  onImported?: (file: { name: string; size: number; mime: string; bytes: ArrayBuffer }) => void;
}

export function ImportShareDropzone({ open, onClose, onImported }: ImportShareDropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pushToast = useToastsStore((s) => s.push);

  function reset(): void {
    setFile(null);
    setPassphrase('');
    setError(null);
    setIsOver(false);
  }

  function close(): void {
    reset();
    onClose();
  }

  function pickFile(): void {
    inputRef.current?.click();
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const f = event.target.files?.[0] ?? null;
    if (f) {
      setFile(f);
      setError(null);
    }
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsOver(false);
    const f = event.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
    }
  }

  async function onImport(): Promise<void> {
    if (!file) {
      setError('Select a .wyvern-share.zip file');
      return;
    }
    if (!passphrase) {
      setError('Passphrase is required');
      return;
    }
    setBusy(true);
    setError(null);
    const correlationId = newCorrelationId();
    try {
      await parseShareArchive(file);
      const result = await decryptShareArchive({ blob: file, passphrase });
      onImported?.(result);
      pushToast({ kind: 'success', message: `Decrypted ${result.name}` });
      await recordAuditEvent({
        action: 'share_archive_imported',
        target_id: result.name,
        target_type: 'file',
        outcome: 'success',
        correlation_id: correlationId,
        metadata: { formatVersion: 1, chunkCount: 0, name: result.name, size: result.size }
      });
      reset();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
      pushToast({ kind: 'error', message });
      await recordAuditEvent({
        action: 'share_archive_imported',
        target_id: file?.name ?? null,
        target_type: 'file',
        outcome: 'error',
        correlation_id: correlationId,
        metadata: { reason: message }
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Import encrypted share"
      onClose={close}
      width={520}
      footer={
        <div className="modal-actions">
          <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
          <Button onClick={() => void onImport()} loading={busy}>Decrypt & import</Button>
        </div>
      }
    >
      <div
        className={`dropzone${isOver ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
      >
        <p className="modal-prose">
          Drop a <code>.wyvern-share.zip</code> file or pick one from disk.
        </p>
        <Button variant="secondary" onClick={pickFile} disabled={busy}>Choose file</Button>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={SHARE_ARCHIVE_MIME}
          onChange={onFileChange}
        />
        {file ? <p className="modal-prose">Selected: <code>{file.name}</code></p> : null}
      </div>
      <label className="auth-label" htmlFor="import-pass">Passphrase</label>
      <input
        id="import-pass"
        className="auth-input"
        type="password"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        autoComplete="current-password"
        disabled={busy}
      />
      {error ? <div className="auth-error" role="alert">{error}</div> : null}
    </Modal>
  );
}
