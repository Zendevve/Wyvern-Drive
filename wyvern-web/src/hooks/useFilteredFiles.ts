/**
 * useFilteredFiles - Hook for filtered, sorted, and searched files
 *
 * Combines search (Fuse.js), filter (file type), and sort functionality
 * into a single hook that returns the processed file list.
 */

import { useMemo } from 'react'
import Fuse from 'fuse.js'
import { useFileStore, type SortBy, type SortOrder, type FileTypeFilter } from '../stores/fileStore'
import type { WyvernFile, WyvernFolder } from '../lib/types'

type FileItem = WyvernFile | WyvernFolder

// File type detection patterns
const FILE_TYPE_PATTERNS: Record<FileTypeFilter, RegExp | null> = {
  all: null,
  images: /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff?)$/i,
  videos: /\.(mp4|webm|mkv|avi|mov|wmv|flv|m4v)$/i,
  audio: /\.(mp3|wav|flac|aac|ogg|wma|m4a|opus)$/i,
  documents: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|rtf|csv|json|xml|yaml|yml)$/i
}

// Fuse.js options for fuzzy search
const FUSE_OPTIONS = {
  keys: ['name'],
  threshold: 0.3, // 0 = exact, 1 = match anything
  ignoreLocation: true,
  includeScore: true
}

/**
 * Filter files by type
 */
function filterByType(files: FileItem[], filterType: FileTypeFilter): FileItem[] {
  if (filterType === 'all') return files

  const pattern = FILE_TYPE_PATTERNS[filterType]
  if (!pattern) return files

  return files.filter(file => {
    // Always include folders
    if (file.type === 'directory') return true
    // Filter files by extension
    return pattern.test(file.name)
  })
}

/**
 * Sort files by field
 */
function sortFiles(files: FileItem[], sortBy: SortBy, sortOrder: SortOrder): FileItem[] {
  return [...files].sort((a, b) => {
    // Folders always come first
    if (a.type === 'directory' && b.type !== 'directory') return -1
    if (a.type !== 'directory' && b.type === 'directory') return 1

    let comparison = 0

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true })
        break
      case 'size':
        const sizeA = a.type === 'file' ? (a as WyvernFile).size : 0
        const sizeB = b.type === 'file' ? (b as WyvernFile).size : 0
        comparison = sizeA - sizeB
        break
      case 'date':
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime()
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime()
        comparison = dateA - dateB
        break
      case 'type':
        const extA = a.type === 'file' ? a.name.split('.').pop()?.toLowerCase() || '' : ''
        const extB = b.type === 'file' ? b.name.split('.').pop()?.toLowerCase() || '' : ''
        comparison = extA.localeCompare(extB)
        break
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })
}

/**
 * Search files using Fuse.js
 */
function searchFiles(files: FileItem[], query: string): FileItem[] {
  if (!query.trim()) return files

  const fuse = new Fuse(files, FUSE_OPTIONS)
  const results = fuse.search(query)
  return results.map(r => r.item)
}

/**
 * Hook: Get filtered, sorted, and searched files
 */
export function useFilteredFiles() {
  const {
    files,
    searchQuery,
    sortBy,
    sortOrder,
    filterType
  } = useFileStore()

  const filteredFiles = useMemo(() => {
    let result = Object.values(files)

    // 1. Filter by file type
    result = filterByType(result, filterType)

    // 2. Search (if query exists)
    if (searchQuery.trim()) {
      result = searchFiles(result, searchQuery)
    } else {
      // 3. Sort (only if not searching - search returns by relevance)
      result = sortFiles(result, sortBy, sortOrder)
    }

    return result
  }, [files, searchQuery, sortBy, sortOrder, filterType])

  return {
    files: filteredFiles,
    totalCount: Object.values(files).length,
    filteredCount: filteredFiles.length,
    hasFilter: filterType !== 'all' || searchQuery.trim().length > 0
  }
}

/**
 * Hook: Get file type category for a file
 */
export function getFileCategory(fileName: string): FileTypeFilter {
  for (const [category, pattern] of Object.entries(FILE_TYPE_PATTERNS)) {
    if (pattern && pattern.test(fileName)) {
      return category as FileTypeFilter
    }
  }
  return 'all' // Unknown type
}
