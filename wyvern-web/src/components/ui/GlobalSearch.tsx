/**
 * GlobalSearch - Command palette style global file search
 * Searches all files across all folders with results dropdown
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Fuse from 'fuse.js'
import { Search, X, File, Folder, Image, Video, Music, FileText, Archive } from 'lucide-react'
import { useFileStore } from '../../stores/fileStore'
import type { WyvernFile, WyvernFolder } from '../../lib/types'
import './GlobalSearch.css'

// Icon mapping for file types
const getFileIcon = (name: string, isFolder: boolean) => {
  if (isFolder) return Folder
  const ext = name.split('.').pop()?.toLowerCase() || ''

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return Image
  if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) return Video
  if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(ext)) return Music
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'].includes(ext)) return FileText
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return Archive

  return File
}

// Build path from parent chain
const buildPath = (file: WyvernFile | WyvernFolder, files: Record<string, WyvernFile | WyvernFolder>): string => {
  const parts: string[] = []
  let current: WyvernFile | WyvernFolder | undefined = file

  while (current) {
    parts.unshift(current.name)
    if (current.parent_id) {
      current = Object.values(files).find(f => f.id === current!.parent_id)
    } else {
      break
    }
  }

  return parts.join(' / ')
}

// Fuse.js options
const FUSE_OPTIONS = {
  keys: ['name'],
  threshold: 0.3,
  ignoreLocation: true,
  includeScore: true
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const { files, setCurrentPath, loadFiles } = useFileStore()

  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Convert files to array for search
  const fileList = useMemo(() => Object.values(files || {}), [files])

  // Create Fuse index
  const fuseIndex = useMemo(() => new Fuse(fileList, FUSE_OPTIONS), [fileList])

  // Search results
  const results = useMemo(() => {
    if (!query.trim()) return []
    const searchResults = fuseIndex.search(query)
    return searchResults.slice(0, 10).map(r => ({
      ...r.item,
      score: r.score,
      path: buildPath(r.item, files)
    }))
  }, [query, fuseIndex, files])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Navigate to file
  const navigateToFile = useCallback((file: WyvernFile | WyvernFolder) => {
    // Navigate to file's parent folder and potentially select/preview it
    if (file.parent_id) {
      setCurrentPath(String(file.parent_id))
    } else {
      setCurrentPath('')
    }

    // Navigate to home if on photos page
    navigate('/')

    // Close search and clear
    setIsOpen(false)
    setQuery('')

    // Reload files to show the folder
    loadFiles()
  }, [setCurrentPath, navigate, loadFiles])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          navigateToFile(results[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setIsOpen(true)
  }

  // Clear search
  const handleClear = () => {
    setQuery('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="global-search" ref={containerRef}>
      <div className="search-input-wrapper">
        <Search size={16} className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search your files..."
          className="global-search-input"
          value={query}
          onChange={handleChange}
          onFocus={() => query && setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button className="search-clear" onClick={handleClear}>
            <X size={12} />
          </button>
        )}
      </div>

      {isOpen && query && (
        <div className="search-results">
          {results.length > 0 ? (
            <>
              <div className="search-results-header">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </div>
              {results.map((result, index) => {
                const IconComponent = getFileIcon(result.name, result.type === 'directory')
                return (
                  <div
                    key={result.id}
                    className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => navigateToFile(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="result-icon">
                      <IconComponent size={16} />
                    </div>
                    <div className="result-info">
                      <div className="result-name">{result.name}</div>
                      <div className="result-path">{result.path}</div>
                    </div>
                  </div>
                )
              })}
              <div className="keyboard-hint">
                <kbd>↑</kbd><kbd>↓</kbd> to navigate
                <kbd>Enter</kbd> to open
                <kbd>Esc</kbd> to close
              </div>
            </>
          ) : (
            <div className="search-empty">
              <Search size={24} />
              <p>No files found for "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
