import { describe, it, expect, beforeEach } from 'vitest'
import { useFileStore } from './fileStore'
import type { WyvernFile, WyvernFolder } from '../lib/types'

// Mock files for testing
const mockFiles: Record<string, WyvernFile | WyvernFolder> = {
  '1': { id: 1, name: 'Folder A', type: 'directory', parent_id: null, created_at: '', updated_at: '', path: '/Folder A', children: {} },
  '2': { id: 2, name: 'File B', type: 'file', parent_id: null, created_at: '', updated_at: '', size: 100, path: '/File B', content: '[]', encrypted: false },
  '3': { id: 3, name: 'File C', type: 'file', parent_id: null, created_at: '', updated_at: '', size: 200, path: '/File C', content: '[]', encrypted: false },
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
    useFileStore.getState().selectFile('1')
    const state = useFileStore.getState()
    expect(state.selectedIds.has('1')).toBe(true)
    expect(state.selectedIds.size).toBe(1)
  })

  it('clears previous selection when selecting single file', () => {
    useFileStore.setState({ selectedIds: new Set(['2', '3']) })
    useFileStore.getState().selectFile('1')
    const state = useFileStore.getState()
    expect(state.selectedIds.has('1')).toBe(true)
    expect(state.selectedIds.has('2')).toBe(false)
    expect(state.selectedIds.size).toBe(1)
  })

  it('toggles selection', () => {
    useFileStore.getState().toggleSelection('1')
    expect(useFileStore.getState().selectedIds.has('1')).toBe(true)

    useFileStore.getState().toggleSelection('1')
    expect(useFileStore.getState().selectedIds.has('1')).toBe(false)
  })

  it('toggles selection additively', () => {
    useFileStore.getState().toggleSelection('1')
    useFileStore.getState().toggleSelection('2')
    const state = useFileStore.getState()
    expect(state.selectedIds.size).toBe(2)
    expect(state.selectedIds.has('1')).toBe(true)
    expect(state.selectedIds.has('2')).toBe(true)
  })

  it('clears selection', () => {
    useFileStore.setState({ selectedIds: new Set(['1', '2']) })
    useFileStore.getState().clearSelection()
    expect(useFileStore.getState().selectedIds.size).toBe(0)
  })

  it('selects all', () => {
    useFileStore.getState().selectAll()
    const state = useFileStore.getState()
    expect(state.selectedIds.size).toBe(3)
    expect(state.selectedIds.has('1')).toBe(true)
    expect(state.selectedIds.has('2')).toBe(true)
    expect(state.selectedIds.has('3')).toBe(true)
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
    useFileStore.getState().selectFile('1')
    useFileStore.getState().setRangeSelection('1', '3')

    const state = useFileStore.getState()
    expect(state.selectedIds.size).toBe(3)
    expect(state.selectedIds.has('1')).toBe(true)
    expect(state.selectedIds.has('2')).toBe(true)
    expect(state.selectedIds.has('3')).toBe(true)
  })

  it('selects range correctly reverse', () => {
    // Select 3 then range to 1 should select 3, 2, 1
    useFileStore.getState().selectFile('3')
    useFileStore.getState().setRangeSelection('3', '1')

    const state = useFileStore.getState()
    expect(state.selectedIds.size).toBe(3)
    expect(state.selectedIds.has('1')).toBe(true)
    expect(state.selectedIds.has('2')).toBe(true)
    expect(state.selectedIds.has('3')).toBe(true)
  })
})
