# How to Manage AES-256-GCM Encryption and Security

This guide describes how to configure, audit, and manage client-side cryptography in Wyvern Drive.

---

## 1. How to Configure the Master Encryption Passphrase

Wyvern Drive utilizes **AES-256-GCM** (Galois/Counter Mode) authenticated encryption. Plaintext file bytes are encrypted on your local machine *before* being transmitted to Discord.

1. Open **Settings** (gear icon in bottom sidebar).
2. Scroll to the **AES-256-GCM Security** section.
3. Check the **Enable AES-256 Encryption** checkbox.
4. Set your **Vault Master Passphrase**:
   - Enter your own strong custom password, or
   - Click **Generate New** to create a cryptographically secure 32-character hexadecimal key.
5. Click **Save Settings**.

---

## 2. How Key Derivation Works

When you input a passphrase, Wyvern Drive does not store or use the raw text as the AES key directly. Instead, it processes the passphrase through **Argon2id** (memory-hard password hashing function) with domain separation:

```
Passphrase + Application Salt ("wyvern-drive-v1")
       │
       ▼
   Argon2id (Memory: 64MB, Iterations: 1, Threads: 4)
       │
       ▼
  32-Byte (256-Bit) Symmetric AES Cipher Key
```

Every individual chunk uploaded generates a fresh, cryptographically random **12-byte nonce** (`crypto/rand`). This ensures that even identical files or duplicate chunks produce completely unique, uncorrelated ciphertexts on Discord's servers.

---

## 3. How to Audit Encrypted Chunks

To verify that your files are truly encrypted and unreadable by Discord:

1. In the file explorer, click the **Info (`i`)** icon on any uploaded file card to open the **Chunk Inspector**.
2. Copy any **Attachment URL** (e.g., `https://cdn.discordapp.com/attachments/.../chunk_00000.wyv`).
3. Paste the URL into any web browser or terminal (`curl -O <URL>`).
4. Attempt to open or inspect the downloaded chunk file:
   - The file will contain random binary ciphertext with an authentication tag at the end.
   - Without your local Argon2id derived key and chunk nonce, the file cannot be decrypted or analyzed.

---

## 4. Best Practices for Encryption Passphrases

- **Backup your master passphrase**: If you migrate to a new computer, you must enter the exact same master passphrase to decrypt your downloaded files.
- **Never share your master passphrase**: Discord administrators and server owners cannot read your files unless they possess your master key.
