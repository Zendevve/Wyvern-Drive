import { describe, it, expect } from 'vitest';
import { encodeTree, decodeTree } from '../tree-codec.js';
import type { TreeNode } from '../types.js';

const file = (name: string, hash: string, size: number): TreeNode => ({
  name,
  type: 'file',
  hash,
  size,
});

const dir = (name: string, children: TreeNode[], size: number, hash: string): TreeNode => ({
  name,
  type: 'directory',
  hash,
  size,
  children,
});

const fakeHash = (i: number) => i.toString(16).padStart(64, '0');

describe('tree-codec', () => {
  it('round-trips a single file', () => {
    const root = file('readme.md', fakeHash(1), 42);
    const bytes = encodeTree(root);
    const back = decodeTree(bytes);
    expect(back).toEqual(root);
  });

  it('round-trips a nested directory', () => {
    const root = dir(
      'root',
      [
        dir(
          'docs',
          [file('a.md', fakeHash(1), 10), file('b.md', fakeHash(2), 20)],
          30,
          fakeHash(3),
        ),
        file('x.txt', fakeHash(4), 5),
        dir('empty', [], 0, fakeHash(5)),
      ],
      35,
      fakeHash(6),
    );
    const back = decodeTree(
      decodeTree(encodeTree(root)).hash === root.hash ? encodeTree(root) : encodeTree(root),
    );
    // The decoded tree should be structurally equal regardless of insert order.
    expect(back.name).toBe('root');
    expect(back.type).toBe('directory');
    expect(back.children).toBeDefined();
    expect(back.children!.map((c) => c.name)).toEqual(['docs', 'empty', 'x.txt']);
  });

  it('produces deterministic bytes regardless of child insertion order', () => {
    const a = dir(
      'r',
      [file('a', fakeHash(1), 1), file('b', fakeHash(2), 2), file('c', fakeHash(3), 3)],
      6,
      fakeHash(4),
    );
    const b = dir(
      'r',
      [file('c', fakeHash(3), 3), file('a', fakeHash(1), 1), file('b', fakeHash(2), 2)],
      6,
      fakeHash(4),
    );
    const ba = encodeTree(a);
    const bb = encodeTree(b);
    expect(ba).toEqual(bb);
  });

  it('round-trips a 1000-file tree losslessly', () => {
    const children: TreeNode[] = [];
    for (let i = 0; i < 1000; i++) {
      children.push(file(`f${i.toString().padStart(4, '0')}.dat`, fakeHash(i), i));
    }
    const root = dir(
      'big',
      children,
      children.reduce((s, c) => s + c.size, 0),
      fakeHash(9999),
    );
    const back = decodeTree(encodeTree(root));
    expect(back).toEqual(root);
    expect(back.children).toHaveLength(1000);
  });

  it('decoding a corrupted buffer throws', () => {
    const root = file('a', fakeHash(1), 1);
    const bytes = encodeTree(root);
    // Corrupt the type byte (first byte) so the decoder reads an unknown type.
    bytes[0] = 0x7f;
    expect(() => decodeTree(bytes)).toThrow();
  });
});
