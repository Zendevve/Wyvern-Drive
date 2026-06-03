/// <reference lib="webworker" />

interface DeriveKeyMessage {
  type: 'deriveKey';
  password: string;
  salt: Uint8Array;
  id: string;
}

interface EncryptMessage {
  type: 'encrypt';
  data: ArrayBuffer;
  key: CryptoKey;
  nonce: Uint8Array;
  id: string;
}

interface DecryptMessage {
  type: 'decrypt';
  data: ArrayBuffer;
  key: CryptoKey;
  nonce: Uint8Array;
  id: string;
}

type WorkerMessage = DeriveKeyMessage | EncryptMessage | DecryptMessage;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'deriveKey': {
        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
          'raw',
          encoder.encode(msg.password),
          'PBKDF2',
          false,
          ['deriveKey']
        );
        const derivedKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: msg.salt as unknown as BufferSource,
            iterations: 600_000,
            hash: 'SHA-256',
          },
          passwordKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
        self.postMessage({ type: 'deriveKey', key: derivedKey, id: msg.id });
        break;
      }
      case 'encrypt': {
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: msg.nonce as unknown as BufferSource, tagLength: 128 },
          msg.key,
          msg.data
        );
        self.postMessage({ type: 'encrypt', data: encrypted, id: msg.id }, [encrypted]);
        break;
      }
      case 'decrypt': {
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: msg.nonce as unknown as BufferSource, tagLength: 128 },
          msg.key,
          msg.data
        );
        self.postMessage({ type: 'decrypt', data: decrypted, id: msg.id }, [decrypted]);
        break;
      }
    }
  } catch (err) {
    self.postMessage({ type: 'error', error: (err as Error).message, id: msg.id });
  }
};
