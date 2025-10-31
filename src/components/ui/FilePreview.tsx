'use client'

import { useState } from 'react'
import { formatFileSize, formatDate } from '@/lib/utils'
import { Button } from './Button'

export interface FileInfo {
  name: string
  url: string
  size?: number
  type?: string
  uploadedAt?: string
  path?: string
}

export interface FilePreviewProps {
  files: FileInfo[]
  onDelete?: (file: FileInfo) => void
  onDownload?: (file: FileInfo) => void
  showActions?: boolean
  className?: string
}

export function FilePreview({
  files,
  onDelete,
  onDownload,
  showActions = true,
  className = ''
}: FilePreviewProps) {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [showModal, setShowModal] = useState(false)

  const getFileIcon = (file: FileInfo) => {
    const type = file.type || ''
    
    if (type.startsWith('image/')) {
      return (
        <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg className="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </div>
      )
    }
    
    if (type === 'application/pdf') {
      return (
        <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
          <svg className="h-6 w-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        </div>
      )
    }
    
    return (
      <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
        <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      </div>
    )
  }

  const handlePreview = (file: FileInfo) => {
    if (file.type?.startsWith('image/')) {
      setSelectedFile(file)
      setShowModal(true)
    } else {
      // For non-images, trigger download
      if (onDownload) {
        onDownload(file)
      } else {
        window.open(file.url, '_blank')
      }
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedFile(null)
  }

  if (files.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="mt-2">No files uploaded</p>
      </div>
    )
  }

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center space-x-4 min-w-0 flex-1">
              {getFileIcon(file)}
              
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </p>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  {file.size && (
                    <span>{formatFileSize(file.size)}</span>
                  )}
                  {file.uploadedAt && (
                    <span>{formatDate(file.uploadedAt)}</span>
                  )}
                  {file.type && (
                    <span className="uppercase">{file.type.split('/')[1]}</span>
                  )}
                </div>
              </div>
            </div>

            {showActions && (
              <div className="flex items-center space-x-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(file)}
                >
                  {file.type?.startsWith('image/') ? 'Preview' : 'View'}
                </Button>
                
                {onDownload && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownload(file)}
                  >
                    Download
                  </Button>
                )}
                
                {onDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(file)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image Preview Modal */}
      {showModal && selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75">
          <div className="relative max-w-4xl max-h-full bg-white rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedFile.name}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4">
              <img
                src={selectedFile.url}
                alt={selectedFile.name}
                className="max-w-full max-h-96 mx-auto object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = '/placeholder-image.png' // You might want to add a placeholder
                }}
              />
            </div>
            
            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <div className="text-sm text-gray-600">
                {selectedFile.size && (
                  <span>Size: {formatFileSize(selectedFile.size)}</span>
                )}
                {selectedFile.uploadedAt && (
                  <span className="ml-4">
                    Uploaded: {formatDate(selectedFile.uploadedAt)}
                  </span>
                )}
              </div>
              
              <div className="flex space-x-2">
                {onDownload && (
                  <Button
                    variant="outline"
                    onClick={() => onDownload(selectedFile)}
                  >
                    Download
                  </Button>
                )}
                <Button onClick={closeModal}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}