'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileUpload } from './FileUpload'
import { FilePreview, FileInfo } from './FilePreview'
import { Button } from './Button'
import { useAuth } from '@/lib/auth-context'
import { logger } from '@/lib/logger'

export interface FileManagerProps {
  folder?: string
  maxFiles?: number
  maxSize?: number
  accept?: string
  onFilesChange?: (files: FileInfo[]) => void
  showUpload?: boolean
  showPreview?: boolean
  className?: string
}

export function FileManager({
  folder = 'medical-images',
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024,
  accept = 'image/*,.pdf',
  onFilesChange,
  showUpload = true,
  showPreview = true,
  className = ''
}: FileManagerProps) {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  // Load existing files
  const loadFiles = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/upload?folder=${folder}`, {
        headers: {
          'Authorization': `Bearer ${user.id}` // This would need proper token handling
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load files')
      }

      const data = await response.json()
      if (data.success) {
        const fileInfos: FileInfo[] = data.data.map((file: any) => ({
          name: file.name,
          url: file.url || `/api/files/${file.name}`,
          size: file.metadata?.size,
          type: file.metadata?.mimetype,
          uploadedAt: file.created_at,
          path: file.name
        }))
        
        setFiles(fileInfos)
        onFilesChange?.(fileInfos)
      }
    } catch (err) {
      logger.error('Failed to load files', err as Error)
      setError('Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [user, folder, onFilesChange])

  // Upload files
  const handleUpload = useCallback(async (filesToUpload: File[]) => {
    if (!user) return

    setUploading(true)
    setError(null)

    try {
      const uploadPromises = filesToUpload.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', folder)

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.id}` // This would need proper token handling
          },
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        const data = await response.json()
        if (!data.success) {
          throw new Error(data.error?.message || `Failed to upload ${file.name}`)
        }

        return {
          name: data.data.name,
          url: data.data.url,
          size: data.data.size,
          type: data.data.type,
          uploadedAt: new Date().toISOString(),
          path: data.data.path
        } as FileInfo
      })

      const uploadedFiles = await Promise.all(uploadPromises)
      const newFiles = [...files, ...uploadedFiles]
      
      setFiles(newFiles)
      onFilesChange?.(newFiles)
      
      logger.info('Files uploaded successfully', { 
        count: uploadedFiles.length,
        folder 
      })
    } catch (err) {
      logger.error('File upload failed', err as Error)
      setError((err as Error).message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [user, folder, files, onFilesChange])

  // Delete file
  const handleDelete = useCallback(async (file: FileInfo) => {
    if (!user || !file.path) return

    try {
      const response = await fetch(`/api/upload?path=${encodeURIComponent(file.path)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.id}` // This would need proper token handling
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to delete file')
      }

      const newFiles = files.filter(f => f.path !== file.path)
      setFiles(newFiles)
      onFilesChange?.(newFiles)
      
      logger.info('File deleted successfully', { fileName: file.name })
    } catch (err) {
      logger.error('File deletion failed', err as Error)
      setError((err as Error).message || 'Delete failed')
    }
  }, [user, files, onFilesChange])

  // Download file
  const handleDownload = useCallback((file: FileInfo) => {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.name
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  // Load files on mount
  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Section */}
      {showUpload && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Upload Medical Files
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={loadFiles}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
          
          <FileUpload
            onFileSelect={() => {}} // Files are handled in onUpload
            onUpload={handleUpload}
            accept={accept}
            maxSize={maxSize}
            maxFiles={maxFiles}
            disabled={uploading}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Files Preview Section */}
      {showPreview && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Uploaded Files ({files.length})
          </h3>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading files...</span>
            </div>
          ) : (
            <FilePreview
              files={files}
              onDelete={handleDelete}
              onDownload={handleDownload}
              showActions={true}
            />
          )}
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-64">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-700">Uploading files...</span>
          </div>
        </div>
      )}
    </div>
  )
}