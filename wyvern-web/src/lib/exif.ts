/**
 * EXIF Utility - Extract metadata from images
 * Uses exifr for fast, tree-shakable EXIF parsing
 */

import exifr from 'exifr'

export interface ImageExifData {
  dateTaken: Date | null
  camera: string | null
  location: { lat: number; lng: number } | null
}

/**
 * Extract the date an image was taken from EXIF data
 * Falls back through multiple date fields
 */
export async function extractImageDate(blob: Blob): Promise<Date | null> {
  try {
    const exif = await exifr.parse(blob, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateCreated']
    })

    if (!exif) return null

    // Priority order for date fields
    const date = exif.DateTimeOriginal || exif.CreateDate || exif.DateCreated || exif.ModifyDate

    if (date instanceof Date) {
      return date
    }

    // Handle string dates
    if (typeof date === 'string') {
      const parsed = new Date(date)
      return isNaN(parsed.getTime()) ? null : parsed
    }

    return null
  } catch (err) {
    console.warn('EXIF parse failed:', err)
    return null
  }
}

/**
 * Extract full EXIF metadata from an image
 */
export async function extractImageExif(blob: Blob): Promise<ImageExifData> {
  try {
    const exif = await exifr.parse(blob, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'Make', 'Model', 'GPSLatitude', 'GPSLongitude']
    })

    if (!exif) {
      return { dateTaken: null, camera: null, location: null }
    }

    // Date
    const dateTaken = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate || null

    // Camera
    const camera = exif.Make && exif.Model
      ? `${exif.Make} ${exif.Model}`.trim()
      : exif.Make || exif.Model || null

    // Location
    const location = exif.GPSLatitude != null && exif.GPSLongitude != null
      ? { lat: exif.GPSLatitude, lng: exif.GPSLongitude }
      : null

    return { dateTaken, camera, location }
  } catch (err) {
    console.warn('EXIF extraction failed:', err)
    return { dateTaken: null, camera: null, location: null }
  }
}

/**
 * Check if a file is an image that may contain EXIF data
 */
export function isExifCompatible(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop()
  return ['jpg', 'jpeg', 'tiff', 'tif', 'heic', 'heif'].includes(ext || '')
}
