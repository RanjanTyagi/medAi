'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from './Button'
import { formatFileSize, validateImageFile } from '@/lib/utils'
import { logger } from '@/lib/logger'

export interface FileUploadProps {
  onFileSelect: (files: File[]) => void
  onUpload?: (files: File[]) => Promise<void>
  accept?: string
  maxSize?: number
  maxFiles?: number
  multiple?: boolean
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

export function FileUpload({
  onFileSelect,
  onUpload,
  accept = 'image/*,.pdf',
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 5,
  multiple = true,
  disabled = false,
  className = '',
  children
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFiles = useCallback((files: File[]): { valid: File[]; errors: string[] } => {
    const validFiles: File[] = []
    const validationErrors: string[] = []

    // Check total number of files
    if (files.length > maxFiles) {
      validationErrors.push(`Maximum ${maxFiles} files allowed`)
      files = files.slice(0, maxFiles)
    }

    files.forEach((file, index) => {
      // Check file size
      if (file.size > maxSize) {
        validationErrors.push(`${file.name}: File size exceeds ${formatFileSize(maxSize)}`)
        return
      }

      // Check file type for images
      if (file.type.startsWith('image/')) {
        const validation = validateImageFile(file)
        if (!validation.valid) {
          validationErrors.push(`${file.name}: ${validation.error}`)
          return
        }
      }

      // Check if file type is accepted
      const acceptedTypes = accept.split(',').map(type => type.trim())
      const isAccepted = acceptedTypes.some(acceptedType => {
        if (acceptedType.startsWith('.')) {
          return file.name.toLowerCase().endsWith(acceptedType.toLowerCase())
        }
        if (acceptedType.includes('*')) {
          const baseType = acceptedType.split('/')[0]
          return file.type.startsWith(baseType)
        }
        return file.type === acceptedType
      })

      if (!isAccepted) {
        validationErrors.push(`${file.name}: File type not supported`)
        return
      }

      validFiles.push(file)
    })

    return { valid: validFiles, errors: validationErrors }
  }, [accept, maxSize, maxFiles])

  const handleFileSelect = useCallback((files: File[]) => {
    const { valid, errors } = validateFiles(files)
    
    setErrors(errors)
    setSelectedFiles(valid)
    onFileSelect(valid)

    if (errors.length > 0) {
      logger.warn('File validation errors', { errors })
    }
  }, [validateFiles, onFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    handleFileSelect(files)
  }, [disabled, handleFileSelect])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFileSelect(files)
  }, [handleFileSelect])

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [disabled])

  const handleUpload = useCallback(async () => {
    if (!onUpload || selectedFiles.length === 0) return

    setUploading(true)
    try {
      await onUpload(selectedFiles)
      setSelectedFiles([])
      setErrors([])
    } catch (error) {
      logger.error('File upload failed', error as Error)
      setErrors(['Upload failed. Please try again.'])
    } finally {
      setUploading(false)
    }
  }, [onUpload, selectedFiles])

  const removeFile = useCallback((index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(newFiles)
    onFileSelect(newFiles)
  }, [selectedFiles, onFileSelect])

  return (
    <div className={`w-full ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {children || (
          <div className="space-y-4">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Supports images (JPEG, PNG) and PDF files up to {formatFileSize(maxSize)}
              </p>
              {multiple && (
                <p className="text-xs text-gray-400 mt-1">
                  Maximum {maxFiles} files
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error messages */}
      {errors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <h4 className="text-sm font-medium text-red-800">Upload Errors:</h4>
          <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Selected Files:</h4>
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {file.type.startsWith('image/') ? (
                    <div className="h-8 w-8 bg-blue-100 rounded flex items-center justify-center">
                      <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <div className="h-8 w-8 bg-red-100 rounded flex items-center justify-center">
                      <svg className="h-4 w-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
                className="flex-shrink-0 ml-4 text-red-600 hover:text-red-800"
                disabled={disabled || uploading}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}

          {/* Upload button */}
          {onUpload && selectedFiles.length > 0 && (
            <div className="pt-4">
              <Button
                onClick={handleUpload}
                loading={uploading}
                disabled={disabled || uploading}
                className="w-full"
              >
                {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}