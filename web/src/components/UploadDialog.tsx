import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export type DekWrapMode = 'master' | 'passphrase';

export interface UploadDialogEncryption {
  enabled: boolean;
  wrapMode: DekWrapMode;
  passphrase?: string;
}

export interface UploadDialogProps {
  open: boolean;
  files: File[];
  hasMasterKey: boolean;
  onClose: () => void;
  onConfirm: (encryption: UploadDialogEncryption) => void;
}

export function UploadDialog({ open, files, hasMasterKey, onClose, onConfirm }: UploadDialogProps) {
  const [encrypt, setEncrypt] = useState(false);
  const [wrapMode, setWrapMode] = useState<DekWrapMode>('master');
  const [passphrase, setPassphrase] = useState('');

  useEffect(() => {
    if (open) {
      setEncrypt(false);
      setWrapMode(hasMasterKey ? 'master' : 'passphrase');
      setPassphrase('');
    }
  }, [open, hasMasterKey]);

  function handleSubmit() {
    onConfirm({
      enabled: encrypt,
      wrapMode: encrypt ? wrapMode : 'master',
      passphrase: encrypt && wrapMode === 'passphrase' ? passphrase : undefined
    });
  }

  return (
    <Modal
      open={open}
      title={`Upload ${files.length} file${files.length === 1 ? '' : 's'}`}
      onClose={onClose}
      width={520}
      footer={
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Upload</Button>
        </div>
      }
    >
      <div className="upload-dialog-list">
        <p className="modal-prose">{files.map((f) => f.name).join(', ')}</p>
        <label className="upload-dialog-checkbox">
          <input
            type="checkbox"
            checked={encrypt}
            onChange={(e) => setEncrypt(e.target.checked)}
            data-testid="upload-encrypt-checkbox"
          />
          Encrypt this file
        </label>
        {encrypt ? (
          <div className="upload-dialog-encryption-options">
            <fieldset className="upload-dialog-radio-group">
              <legend className="sr-only">Encryption key source</legend>
              <label className="upload-dialog-radio">
                <input
                  type="radio"
                  name="dek-wrap-mode"
                  value="master"
                  checked={wrapMode === 'master'}
                  onChange={() => setWrapMode('master')}
                  disabled={!hasMasterKey}
                />
                Use master key
                {!hasMasterKey ? <span className="upload-dialog-hint"> (set a master passphrase first)</span> : null}
              </label>
              <label className="upload-dialog-radio">
                <input
                  type="radio"
                  name="dek-wrap-mode"
                  value="passphrase"
                  checked={wrapMode === 'passphrase'}
                  onChange={() => setWrapMode('passphrase')}
                />
                Use a passphrase
              </label>
            </fieldset>
            {wrapMode === 'passphrase' ? (
              <label className="auth-label" htmlFor="upload-passphrase">Passphrase</label>
            ) : null}
            {wrapMode === 'passphrase' ? (
              <input
                id="upload-passphrase"
                className="auth-input"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
