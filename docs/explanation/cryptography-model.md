# Zero-Knowledge Cryptographic Architecture

This document explains the security and cryptographic design principles implemented in Wyvern Drive.

---

## 1. Zero-Knowledge Threat Model

When utilizing a third-party service like Discord for file storage, the primary security threat is unauthorized access to plaintext data by:
- Discord infrastructure and automated content scanners.
- Other server members (if permissions are misconfigured).
- Intermediate network observers (ISPs, proxies).

Wyvern Drive solves this by enforcing a **Zero-Knowledge Architecture**:
- **Zero Plaintext Transmission**: No unencrypted file bytes ever leave the local machine.
- **Obfuscated File Names & Metadata**: Chunks uploaded to Discord are named opaquely (e.g. `chunk_00000.wyv`) without revealing the original filename, extension, or MIME type.
- **Local Key Storage**: The encryption key is held only in local application memory and encrypted SQLite settings. Discord never receives the encryption key or passphrase.

---

## 2. Key Derivation: Argon2id

Passwords provided by users can vary in entropy. To convert arbitrary user passphrases into a cryptographically robust 256-bit symmetric cipher key, Wyvern Drive uses **Argon2id** (the winner of the Password Hashing Competition):

```
User Master Passphrase
          │
          ▼
SHA-256 Domain Prefix ("wyvern-drive-v1:" + Passphrase)
          │
          ▼
   Argon2id Parameters:
   - Memory: 64 MB (65,536 KiB)
   - Iterations: 1 Time
   - Parallelism: 4 Threads
   - Key Length: 32 Bytes (256 Bits)
          │
          ▼
 256-Bit Master AES Key
```

Argon2id is memory-hard, rendering brute-force attacks using GPUs and ASICs computationally infeasible.

---

## 3. Authenticated Encryption: AES-256-GCM

Wyvern Drive utilizes **AES-256 in Galois/Counter Mode (GCM)** for chunk encryption:

### Why AES-GCM?
1. **Confidentiality**: High-security symmetric encryption with 256-bit key length.
2. **Integrity & Authenticity**: GCM generates a 16-byte authentication tag for each chunk. If even a single bit of a chunk is modified, corrupted, or tampered with on Discord's CDN, decryption fails instantly during `cipher.Open`.
3. **Hardware Acceleration**: AES-NI CPU instructions provide throughput exceeding 2 GB/s on modern processors.

### Nonce Generation & Uniqueness
GCM requires that a key-nonce pair is **never reused**. Reusing a nonce with the same key destroys GCM's security guarantees.

Wyvern Drive guarantees nonce uniqueness by generating a fresh, cryptographically random **12-byte nonce** (`crypto/rand`) for **every individual chunk upload**:

```
Plaintext Chunk (18MB) + Master Key (32B) + Unique Nonce (12B)
                           │
                           ▼
                    AES-256-GCM Seal
                           │
                           ▼
          Ciphertext (18MB) + Auth Tag (16B)
```

The 12-byte nonce is stored in the local SQLite `chunks` table alongside the chunk index, allowing seamless decryption upon download.
