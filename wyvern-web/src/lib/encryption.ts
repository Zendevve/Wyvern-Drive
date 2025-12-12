/**
 * Client-side AES-256-GCM encryption for Wyvern Drive
 * Uses Web Crypto API - no external dependencies
 */

import type { EncryptedChunk } from './types'

const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH = 16
const IV_LENGTH = 12

/**
 * Derive an AES-256 key from a password using PBKDF2
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)

  // Import password as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  )

  // Derive AES-256-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

/**
 * Generate a random IV for encryption
 */
export function generateIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

/**
 * Encrypt a chunk of data using AES-256-GCM
 */
export async function encryptChunk(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<EncryptedChunk> {
  const iv = generateIv()

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

  return { data: encryptedData, iv }
}

/**
 * Decrypt a chunk of data using AES-256-GCM
 */
export async function decryptChunk(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  )
}

/**
 * Convert Uint8Array to base64 string for storage
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array))
}

/**
 * Convert base64 string back to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Create encryption context (salt + key) from password
 * Returns salt as base64 for storage
 */
export async function createEncryptionContext(password: string): Promise<{
  key: CryptoKey
  salt: string
}> {
  const salt = generateSalt()
  const key = await deriveKey(password, salt)
  return {
    key,
    salt: uint8ArrayToBase64(salt),
  }
}

/**
 * Restore encryption context from password and stored salt
 */
export async function restoreEncryptionContext(
  password: string,
  saltBase64: string
): Promise<CryptoKey> {
  const salt = base64ToUint8Array(saltBase64)
  return deriveKey(password, salt)
}
