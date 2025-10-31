import { supabase } from './supabaseClient'
import { logger } from './logger'
import ImageCompressionService, { CompressionPresets, optimizeForMedicalAI } from './image-compression-service'
import { PerfUtils } from './performance-monitor'
import CacheManager, { CacheKeys, CacheTTL } from './cache-service'

export interface FileUploadResult {
  url: string
  path: string
  size: number
  type: string
  name: string
  compressed?: {
    originalSize: number
    compressedSize: number
    compressionRatio: number
  }
}

export interface FileUploadOptions {
  maxSize?: number
  allowedTypes?: string[]
  folder?: string
  generateUniqueName?: boolean
  compress?: boolean
  compressionPreset?: keyof typeof CompressionPresets
}

export class OptimizedFileService {
  private static readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
  private static readonly DEFAULT_ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/pdf'
  ]
  private static readonly STORAGE_BUCKET = 'medical-files'

  // Upload medical file with compression and performance monitoring
  static async uploadMedicalFile(
    file: File,
    userId: string,
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult> {
    return await PerfUtils.monitorFile('upload', async () => {
      const {
        maxSize = this.DEFAULT_MAX_SIZE,
        allowedTypes = this.DEFAULT_ALLOWED_TYPES,
        folder = 'medical-images',
        generateUniqueName = true,
        compress = true,
        compressionPreset = 'STORAGE'
      } = options

      logger.info('Optimized file upload started', {
        userId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        compress
      })

      // Validate file
      const validation = this.validateFile(file, { maxSize, allowedTypes })
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      let fileToUpload = file
      let compressionMetadata: any = null

      // Compress image if requested and file is an image
      if (compress && file.type.startsWith('image/')) {
        try {
          const compressionResult = await PerfUtils.monitorFile('compression', async () => {
            return await ImageCompressionService.compressImage(
              file,
              CompressionPresets[compressionPreset]
            )
          })

          // Create new file from compressed buffer
          fileToUpload = new File([compressionResult.buffer], file.name, {
            type: file.type,
            lastModified: file.lastModified
          })

          compressionMetadata = compressionResult.metadata

          logger.info('Image compressed successfully', {
            userId,
            originalSize: file.size,
            compressedSize: compressionResult.buffer.length,
            compressionRatio: compressionMetadata.compressionRatio
          })
        } catch (compressionError) {
          logger.warn('Image compression failed, uploading original', compressionError as Error)
          // Continue with original file if compression fails
        }
      }

      // Generate file path
      const fileName = generateUniqueName 
        ? this.generateFileName(file.name, userId)
        : file.name
      
      const filePath = `${folder}/${userId}/${fileName}`

      // Upload to Supabase Storage
      const uploadResult = await PerfUtils.monitorFile('storage_upload', async () => {
        const { data, error } = await supabase.storage
          .from(this.STORAGE_BUCKET)
          .upload(filePath, fileToUpload, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) {
          logger.error('File upload failed', error, { userId, fileName: file.name })
          throw error
        }

        return data
      })

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(filePath)

      const result: FileUploadResult = {
        url: urlData.publicUrl,
        path: filePath,
        size: fileToUpload.size,
        type: file.type,
        name: fileName,
        ...(compressionMetadata && { compressed: compressionMetadata })
      }

      // Cache file metadata for quick access
      const cacheKey = CacheKeys.reportDetails(`file:${filePath}`)
      CacheManager['cacheService'].set(cacheKey, result, CacheTTL.LONG)

      logger.info('Optimized file uploaded successfully', {
        userId,
        filePath,
        originalSize: file.size,
        finalSize: fileToUpload.size,
        compressed: !!compressionMetadata
      })

      return result
    })
  }

  // Upload and optimize for AI processing
  static async uploadForAIProcessing(
    file: File,
    userId: string
  ): Promise<{
    original: FileUploadResult
    aiOptimized: Buffer
    thumbnail: Buffer
    metadata: any
  }> {
    return await PerfUtils.monitorFile('ai_optimization', async () => {
      // Upload original file
      const originalUpload = await this.uploadMedicalFile(file, userId, {
        compress: false, // Keep original uncompressed
        folder: 'originals'
      })

      // Optimize for AI processing
      const optimized = await optimizeForMedicalAI(file)

      logger.info('File optimized for AI processing', {
        userId,
        originalSize: file.size,
        aiOptimizedSize: optimized.compressed.length,
        thumbnailSize: optimized.thumbnail.length
      })

      return {
        original: originalUpload,
        aiOptimized: optimized.compressed,
        thumbnail: optimized.thumbnail,
        metadata: optimized.metadata
      }
    })
  }

  // Get file with caching
  static async getFileUrl(filePath: string, userId: string): Promise<string> {
    const cacheKey = CacheKeys.reportDetails(`file_url:${filePath}`)
    
    return await CacheManager.getOrSet(
      cacheKey,
      async () => {
        return await PerfUtils.monitorFile('get_url', async () => {
          // Check if user has access to this file
          const hasAccess = await this.checkFileAccess(filePath, userId)
          if (!hasAccess) {
            throw new Error('Access denied to file')
          }

          const { data } = supabase.storage
            .from(this.STORAGE_BUCKET)
            .getPublicUrl(filePath)

          return data.publicUrl
        })
      },
      CacheTTL.MEDIUM
    )
  }

  // Batch upload with progress tracking
  static async uploadMultipleFiles(
    files: File[],
    userId: string,
    options: FileUploadOptions = {},
    onProgress?: (completed: number, total: number) => void
  ): Promise<FileUploadResult[]> {
    return await PerfUtils.monitorFile('batch_upload', async () => {
      const results: FileUploadResult[] = []
      const errors: Error[] = []

      for (let i = 0; i < files.length; i++) {
        try {
          const result = await this.uploadMedicalFile(files[i], userId, options)
          results.push(result)
          
          if (onProgress) {
            onProgress(i + 1, files.length)
          }
        } catch (error) {
          errors.push(error as Error)
          logger.error('Batch upload file failed', error as Error, {
            fileName: files[i].name,
            userId
          })
        }
      }

      logger.info('Batch upload completed', {
        userId,
        totalFiles: files.length,
        successCount: results.length,
        errorCount: errors.length
      })

      return results
    })
  }

  // Convert file to base64 with caching
  static async fileToBase64(file: File): Promise<string> {
    const fileHash = await this.calculateFileHash(file)
    const cacheKey = CacheKeys.reportDetails(`base64:${fileHash}`)
    
    return await CacheManager.getOrSet(
      cacheKey,
      async () => {
        return await PerfUtils.monitorFile('base64_conversion', async () => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                // Remove data URL prefix (data:image/jpeg;base64,)
                const base64 = reader.result.split(',')[1]
                resolve(base64)
              } else {
                reject(new Error('Failed to convert file to base64'))
              }
            }
            
            reader.onerror = () => {
              reject(new Error('File reading failed'))
            }
            
            reader.readAsDataURL(file)
          })
        })
      },
      CacheTTL.LONG // Base64 conversion is expensive, cache longer
    )
  }

  // Delete file with cache invalidation
  static async deleteFile(filePath: string, userId: string): Promise<void> {
    await PerfUtils.monitorFile('delete', async () => {
      // Check if user has access to delete this file
      const hasAccess = await this.checkFileAccess(filePath, userId)
      if (!hasAccess) {
        throw new Error('Access denied to delete file')
      }

      const { error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .remove([filePath])

      if (error) {
        logger.error('File deletion failed', error, { userId, filePath })
        throw error
      }

      // Invalidate related caches
      CacheManager.invalidatePattern(`file:${filePath}`)
      CacheManager.invalidatePattern(`file_url:${filePath}`)

      logger.info('File deleted successfully', { userId, filePath })
    })
  }

  // List user files with caching and pagination
  static async listUserFiles(
    userId: string, 
    folder: string = 'medical-images',
    page: number = 1,
    limit: number = 50
  ): Promise<{ files: any[]; pagination: any }> {
    const cacheKey = CacheKeys.userReports(userId, page, `files:${folder}`)
    
    return await CacheManager.getOrSet(
      cacheKey,
      async () => {
        return await PerfUtils.monitorFile('list_files', async () => {
          const offset = (page - 1) * limit
          
          const { data, error } = await supabase.storage
            .from(this.STORAGE_BUCKET)
            .list(`${folder}/${userId}`, {
              limit,
              offset,
              sortBy: { column: 'created_at', order: 'desc' }
            })

          if (error) {
            logger.error('List files failed', error, { userId, folder })
            throw error
          }

          const files = data || []
          const totalPages = Math.ceil(files.length / limit)

          return {
            files,
            pagination: {
              page,
              limit,
              total: files.length,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1
            }
          }
        })
      },
      CacheTTL.SHORT
    )
  }

  // Get file metadata with performance monitoring
  static async getFileMetadata(filePath: string): Promise<any> {
    const cacheKey = CacheKeys.reportDetails(`metadata:${filePath}`)
    
    return await CacheManager.getOrSet(
      cacheKey,
      async () => {
        return await PerfUtils.monitorFile('get_metadata', async () => {
          const { data, error } = await supabase.storage
            .from(this.STORAGE_BUCKET)
            .list('', {
              search: filePath
            })

          if (error) {
            throw error
          }

          return data?.[0] || null
        })
      },
      CacheTTL.LONG
    )
  }

  // Create signed URL with caching
  static async createSignedUrl(
    filePath: string, 
    expiresIn: number = 3600
  ): Promise<string> {
    // Don't cache signed URLs as they expire
    return await PerfUtils.monitorFile('create_signed_url', async () => {
      const { data, error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .createSignedUrl(filePath, expiresIn)

      if (error) {
        throw error
      }

      return data.signedUrl
    })
  }

  // Validate file with enhanced checks
  private static validateFile(
    file: File, 
    options: { maxSize: number; allowedTypes: string[] }
  ): { valid: boolean; error?: string } {
    const { maxSize, allowedTypes } = options

    // Check file size
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${Math.round(maxSize / (1024 * 1024))}MB`
      }
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
      }
    }

    // Check for empty files
    if (file.size === 0) {
      return {
        valid: false,
        error: 'File is empty'
      }
    }

    // Additional validation for images
    if (file.type.startsWith('image/')) {
      // Basic image validation
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      if (!validImageTypes.includes(file.type)) {
        return {
          valid: false,
          error: 'Invalid image format'
        }
      }
    }

    return { valid: true }
  }

  // Generate unique filename
  private static generateFileName(originalName: string, userId: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const extension = originalName.split('.').pop()
    const baseName = originalName.split('.').slice(0, -1).join('.')
    
    return `${baseName}_${timestamp}_${random}.${extension}`
  }

  // Check file access permissions
  private static async checkFileAccess(filePath: string, userId: string): Promise<boolean> {
    try {
      // Extract user ID from file path
      const pathParts = filePath.split('/')
      const fileUserId = pathParts[1] // Assuming path format: folder/userId/filename
      
      // User can access their own files
      if (fileUserId === userId) {
        return true
      }

      // Check if user is a doctor or admin (can access patient files)
      const userRole = await this.getUserRole(userId)
      if (userRole === 'doctor' || userRole === 'admin') {
        return true
      }

      return false
    } catch (error) {
      logger.error('File access check failed', error as Error, { filePath, userId })
      return false
    }
  }

  // Get user role with caching
  private static async getUserRole(userId: string): Promise<'patient' | 'doctor' | 'admin'> {
    const cacheKey = CacheKeys.userStats(userId)
    
    return await CacheManager.getOrSet(
      cacheKey,
      async () => {
        const { data: user } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single()

        return user?.role || 'patient'
      },
      CacheTTL.LONG
    )
  }

  // Calculate file hash for caching
  private static async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Clean up old cached files
  static async cleanupCache(): Promise<void> {
    CacheManager.invalidatePattern('file:')
    CacheManager.invalidatePattern('file_url:')
    CacheManager.invalidatePattern('metadata:')
    CacheManager.invalidatePattern('base64:')
    
    logger.info('File service cache cleaned up')
  }

  // Get file service statistics
  static getStats(): any {
    return {
      cacheStats: CacheManager.getStats(),
      supportedFormats: this.DEFAULT_ALLOWED_TYPES,
      maxFileSize: this.DEFAULT_MAX_SIZE,
      compressionPresets: Object.keys(CompressionPresets)
    }
  }
}

// Export individual functions for convenience
export const {
  uploadMedicalFile,
  uploadForAIProcessing,
  getFileUrl,
  deleteFile,
  listUserFiles,
  fileToBase64,
  getFileMetadata,
  createSignedUrl,
  uploadMultipleFiles,
  cleanupCache,
  getStats
} = OptimizedFileService

export default OptimizedFileService