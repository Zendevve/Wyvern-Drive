// Compact binary tree codec.
// Children are sorted by name before encoding so the byte output is deterministic
// regardless of insertion order.

import type { TreeNode } from './types.js';

const TYPE_FILE = 0;
const TYPE_DIR = 1;
const HASH_LEN = 32;

export function encodeTree(root: TreeNode): Uint8Array {
  const parts: Uint8Array[] = [];
  encodeNode(root, parts);
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function encodeNode(node: TreeNode, out: Uint8Array[]): void {
  const nameBytes = new TextEncoder().encode(node.name);
  if (nameBytes.length > 0xffffffff) throw new RangeError('node name too long');
  if (node.hash.length !== HASH_LEN * 2) {
    throw new RangeError(`hash must be ${HASH_LEN * 2} hex chars (got ${node.hash.length})`);
  }

  out.push(u8(node.type === 'file' ? TYPE_FILE : TYPE_DIR));
  out.push(u32(nameBytes.length));
  out.push(nameBytes);
  out.push(hexToBytes(node.hash));
  out.push(u64(node.size));

  if (node.type === 'directory') {
    const children = sortChildren(node.children ?? []);
    if (children.length > 0xffffffff) throw new RangeError('too many children');
    out.push(u32(children.length));
    for (const child of children) encodeNode(child, out);
  }
}

export function decodeTree(bytes: Uint8Array): TreeNode {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 0;
  const pos = (): number => off;
  const advance = (n: number): void => {
    off += n;
  };
  return readNode(dv, pos, advance);
}

function readNode(dv: DataView, pos: () => number, advance: (n: number) => void): TreeNode {
  const typeByte = dv.getUint8(pos());
  advance(1);
  if (typeByte !== TYPE_FILE && typeByte !== TYPE_DIR) {
    throw new RangeError(`unknown node type byte: ${typeByte}`);
  }
  const nameLen = dv.getUint32(pos(), false);
  advance(4);
  const nameBytes = new Uint8Array(dv.buffer, dv.byteOffset + pos(), nameLen);
  advance(nameLen);
  const name = new TextDecoder().decode(nameBytes);
  const hash = bytesToHex(new Uint8Array(dv.buffer, dv.byteOffset + pos(), HASH_LEN));
  advance(HASH_LEN);
  const size = Number(dv.getBigUint64(pos(), false));
  advance(8);

  if (typeByte === TYPE_FILE) {
    return { name, type: 'file', hash, size };
  }

  const childCount = dv.getUint32(pos(), false);
  advance(4);
  const children: TreeNode[] = [];
  for (let i = 0; i < childCount; i++) {
    children.push(readNode(dv, pos, advance));
  }
  return { name, type: 'directory', hash, size, children };
}

function sortChildren(children: TreeNode[]): TreeNode[] {
  return [...children].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function u8(n: number): Uint8Array {
  return new Uint8Array([n & 0xff]);
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

function u64(n: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n), false);
  return b;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new RangeError('odd-length hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i]!.toString(16).padStart(2, '0');
  return s;
}
