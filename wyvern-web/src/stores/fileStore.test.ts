import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFileStore } from './fileStore'
import type { WyvernFile, WyvernFolder } from '../lib/types'

// Mock files for testing
const mockFiles: Record<string, WyvernFile | WyvernFolder> = {
  '1': { id: 1, name: 'Folder A', type: 'directory', parent_id: null, created_at: '', updated_at: '', user_id: 1, path: '/Folder A' },
  '2': { id: 2, name: 'File B', type: 'file', parent_id: null, created_at: '', updated_at: '', user_id: 1, size: 100, mime_type: 'text/plain', path: '/File B' },
  '3': { id: 3, name: 'File C', type: 'file', parent_id: null, created_at: '', updated_at: '', user_id: 1, size: 200, mime_type: 'image/png', path: '/File C' },
}

// Mock localStorage if in Node environment
if (typeof window === 'undefined') {
  global.window = {} as any
}
if (!global.window.localStorage) {
  const store: Record<string, string> = {}
  global.window.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      for (const key in store) delete store[key]
    },
    key: () => null,
    length: 0,
  }
}

describe('FileStore Selection', () => {
  beforeEach(() => {
    useFileStore.setState({
      files: mockFiles,
      selectedIds: new Set(),
      breadcrumbs: [],
      currentPath: '',
    })
  })

  it('selects a single file', () => {
    const store = useFileStore.getState()
    store.selectFile('1')
    expect(store.selectedIds.has('1')).toBe(true)
    expect(store.selectedIds.size).toBe(1)
  })

  it('clears previous selection when selecting single file', () => {
    useFileStore.setState({ selectedIds: new Set(['2', '3']) })
    const store = useFileStore.getState()
    store.selectFile('1')
    expect(store.selectedIds.has('1')).toBe(true)
    expect(store.selectedIds.has('2')).toBe(false)
    expect(store.selectedIds.size).toBe(1)
  })

  it('toggles selection', () => {
    const store = useFileStore.getState()

    // Select
    store.toggleSelection('1')
    expect(store.selectedIds.has('1')).toBe(true)

    // Deselect
    store.toggleSelection('1')
    expect(store.selectedIds.has('1')).toBe(false)
  })

  it('toggles selection additively', () => {
    const store = useFileStore.getState()
    store.toggleSelection('1')
    store.toggleSelection('2')
    expect(store.selectedIds.size).toBe(2)
    expect(store.selectedIds.has('1')).toBe(true)
    expect(store.selectedIds.has('2')).toBe(true)
  })

  it('clears selection', () => {
    useFileStore.setState({ selectedIds: new Set(['1', '2']) })
    const store = useFileStore.getState()
    store.clearSelection()
    expect(store.selectedIds.size).toBe(0)
  })

  it('selects all', () => {
    const store = useFileStore.getState()
    store.selectAll()
    expect(store.selectedIds.size).toBe(3)
    expect(store.selectedIds.has('1')).toBe(true)
    expect(store.selectedIds.has('2')).toBe(true)
    expect(store.selectedIds.has('3')).toBe(true)
  })

  it('navigating clears selection', () => {
    useFileStore.setState({ selectedIds: new Set(['1']) })
    const store = useFileStore.getState()
    store.setCurrentPath('new-path')
    expect(useFileStore.getState().selectedIds.size).toBe(0)
  })
})

describe('FileStore Range Selection', () => {
  beforeEach(() => {
    useFileStore.setState({
      files: mockFiles,
      selectedIds: new Set(),
    })
  })

  it('selects range correctly', () => {
    // Mock order is: Folder A (1), File B (2), File C (3) due to sort logic (folders first)
    const store = useFileStore.getState()

    // Select 1 then range to 3 should select 1, 2, 3
    store.selectFile('1')
    store.setRangeSelection('1', '3')

    expect(store.selectedIds.size).toBe(3)
    expect(store.selectedIds.has('1')).toBe(true)
    expect(store.selectedIds.has('2')).toBe(true)
    expect(store.selectedIds.has('3')).toBe(true)
  })

  it('selects range correctly reverse', () => {
    // Select 3 then range to 1 should select 3, 2, 1
    const store = useFileStore.getState()
    store.selectFile('3')
    store.setRangeSelection('3', '1')

    expect(store.selectedIds.size).toBe(3)
    expect(store.selectedIds.has('1')).toBe(true)
    expect(store.selectedIds.has('2')).toBe(true)
    expect(store.selectedIds.has('3')).toBe(true)
  })
})
