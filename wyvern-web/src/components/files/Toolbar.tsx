import { useRef, useState } from 'react'
import {
  Search, Upload, FolderUp, FolderPlus, Grid, List,
  ArrowUpDown, ArrowUp, ArrowDown, Image, Video, Music, FileText, Files,
  ShieldCheck, Loader
} from 'lucide-react'
import { useFileStore, type SortBy, type FileTypeFilter } from '../../stores/fileStore'
import './Toolbar.css'

interface ToolbarProps {
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'date', label: 'Date' },
  { value: 'type', label: 'Type' }
]

const FILTER_OPTIONS: { value: FileTypeFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <Files size={14} /> },
  { value: 'images', label: 'Images', icon: <Image size={14} /> },
  { value: 'videos', label: 'Videos', icon: <Video size={14} /> },
  { value: 'audio', label: 'Audio', icon: <Music size={14} /> },
  { value: 'documents', label: 'Docs', icon: <FileText size={14} /> }
]

export function Toolbar({ viewMode, setViewMode }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)

  const {
    uploadFiles, uploadFolder,
    searchQuery, setSearchQuery,
    sortBy, setSortBy, sortOrder, toggleSortOrder,
    filterType, setFilterType,
    verifyAllFiles, isVerifying, verifyProgress
  } = useFileStore()

  const handleUploadFile = () => fileInputRef.current?.click()
  const handleUploadFolder = () => folderInputRef.current?.click()
  const handleNewFolder = () => console.log('Create new folder')

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSortChange = (newSort: SortBy) => {
    if (sortBy === newSort) {
      toggleSortOrder()
    } else {
      setSortBy(newSort)
    }
    setShowSortMenu(false)
  }

  return (
    <div className="toolbar">
      {/* Left side: Upload buttons */}
      <div className="toolbar-left">
        <button className="toolbar-btn primary" onClick={handleUploadFile}>
          <Upload size={16} /> Upload
        </button>
        <button className="toolbar-btn" onClick={handleUploadFolder}>
          <FolderUp size={16} /> Folder
        </button>
        <button className="toolbar-btn" onClick={handleNewFolder}>
          <FolderPlus size={16} /> New
        </button>
        <button
          className="toolbar-btn"
          onClick={() => verifyAllFiles()}
          disabled={isVerifying}
          title="Check file health status"
        >
          {isVerifying ? (
            <><Loader size={16} className="spinner" /> Verifying {verifyProgress.checked}/{verifyProgress.total}</>
          ) : (
            <><ShieldCheck size={16} /> Verify Files</>
          )}
        </button>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={onFileChange} />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is non-standard
          webkitdirectory=""
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) uploadFolder(e.target.files)
            if (folderInputRef.current) folderInputRef.current.value = ''
          }}
        />
      </div>

      {/* Center: Search + Filters */}
      <div className="toolbar-center">
        {/* Search Input */}
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="filter-chips">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`filter-chip ${filterType === opt.value ? 'active' : ''}`}
              onClick={() => setFilterType(opt.value)}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right side: Sort + View toggle */}
      <div className="toolbar-right">
        {/* Sort Dropdown */}
        <div className="sort-dropdown">
          <button
            className="sort-btn"
            onClick={() => setShowSortMenu(!showSortMenu)}
          >
            <ArrowUpDown size={14} />
            <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
            {sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          </button>
          {showSortMenu && (
            <div className="sort-menu" onMouseLeave={() => setShowSortMenu(false)}>
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`sort-option ${sortBy === opt.value ? 'active' : ''}`}
                  onClick={() => handleSortChange(opt.value)}
                >
                  {opt.label}
                  {sortBy === opt.value && (
                    sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View Toggle */}
        <div className="view-toggle">
          <button
            className={viewMode === 'grid' ? 'active' : ''}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            <Grid size={16} />
          </button>
          <button
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

