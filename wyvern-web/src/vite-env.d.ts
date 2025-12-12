/// <reference types="vite/client" />

interface FileSystemEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath: string
  filesystem: FileSystem
  getParent(successCallback: (entry: FileSystemEntry) => void, errorCallback?: (error: DOMException) => void): void
}

interface FileSystemFileEntry extends FileSystemEntry {
  file(successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void): void
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader(): FileSystemDirectoryReader
}

interface FileSystemDirectoryReader {
  readEntries(successCallback: (entries: FileSystemEntry[]) => void, errorCallback?: (error: DOMException) => void): void
}

interface FileSystem {
  name: string
  root: FileSystemDirectoryEntry
}

interface DataTransferItem {
  webkitGetAsEntry(): FileSystemEntry | null
}
