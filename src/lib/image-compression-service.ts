import { logger } from './logger'

// Image compression configuration
interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'webp' | 'png'
  maxSizeKB?: number
}

// Default compression settings for different use cases
export const CompressionPresets = {
  // For AI analysis - balance between quality and processing speed
  AI_ANALYSIS: {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.85,
    format: 'jpeg' as const,
    maxSizeKB: 500
  },
  
  // For thumbnails - small size for quick loading
  THUMBNAIL: {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.7,
    format: 'webp' as const,
    maxSizeKB: 50
  },
  
  // For display - good quality for viewing
  DISPLAY: {
    maxWidth: 800,
    maxHeight: 600,
    quality: 0.8,
    format: 'webp' as const,
    maxSizeKB: 200
  },
  
  // For storage - compressed but retains medical image quality
  STORAGE: {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 0.9,
    format: 'jpeg' as const,
    maxSizeKB: 1000
  }
}

export class ImageCompressionService {
  // Compress image using Canvas API (browser) or sharp (server)
  static async compressImage(
    file: File | Buffer,
    options: CompressionOptions = CompressionPresets.STORAGE
  ): Promise<{ buffer: Buffer; metadata: any }> {
    try {
      const startTime = Date.now()
      
      // Check if we're in browser or server environment
      if (typeof window !== 'undefined') {
        return await this.compressBrowser(file as File, options)
      } else {
        return await this.compressServer(file as Buffer, options)
      }
    } catch (error) {
      logger.error('Image compression failed', error as Error, { options })
      throw new Error('Failed to compress image')
    }
  }

  // Browser-based compression using Canvas API
  private static async compressBrowser(
    file: File,
    options: CompressionOptions
  ): Promise<{ buffer: Buffer; metadata: any }> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        try {
          // Calculate new dimensions
          const { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            options.maxWidth || 1024,
            options.maxHeight || 1024
          )

          // Set canvas size
          canvas.width = width
          canvas.height = height

          // Draw and compress
          ctx?.drawImage(img, 0, 0, width, height)
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'))
                return
              }

              // Convert blob to buffer
              blob.arrayBuffer().then(arrayBuffer => {
                const buffer = Buffer.from(arrayBuffer)
                
                resolve({
                  buffer,
                  metadata: {
                    originalSize: file.size,
                    compressedSize: buffer.length,
                    compressionRatio: (1 - buffer.length / file.size) * 100,
                    dimensions: { width, height },
                    format: options.format || 'jpeg'
                  }
                })
              })
            },
            `image/${options.format || 'jpeg'}`,
            options.quality || 0.8
          )
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  // Server-based compression using sharp (requires installation)
  private static async compressServer(
    buffer: Buffer,
    options: CompressionOptions
  ): Promise<{ buffer: Buffer; metadata: any }> {
    try {
      // Dynamic import of sharp (only available on server)
      const sharp = await import('sharp').catch(() => null)
      
      if (!sharp) {
        throw new Error('Sharp not available for server-side image processing')
      }

      const image = sharp.default(buffer)
      const metadata = await image.metadata()
      
      // Calculate new dimensions
      const { width, height } = this.calculateDimensions(
        metadata.width || 1024,
        metadata.height || 1024,
        options.maxWidth || 1024,
        options.maxHeight || 1024
      )

      // Apply compression based on format
      let processedImage = image.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })

      switch (options.format) {
        case 'jpeg':
          processedImage = processedImage.jpeg({
            quality: Math.round((options.quality || 0.8) * 100),
            progressive: true,
            mozjpeg: true
          })
          break
        case 'webp':
          processedImage = processedImage.webp({
            quality: Math.round((options.quality || 0.8) * 100),
            effort: 4
          })
          break
        case 'png':
          processedImage = processedImage.png({
            compressionLevel: 6,
            progressive: true
          })
          break
        default:
          processedImage = processedImage.jpeg({
            quality: Math.round((options.quality || 0.8) * 100)
          })
      }

      const compressedBuffer = await processedImage.toBuffer()
      
      // Check if we need to compress further to meet size requirements
      if (options.maxSizeKB && compressedBuffer.length > options.maxSizeKB * 1024) {
        return await this.compressToSize(buffer, options)
      }

      return {
        buffer: compressedBuffer,
        metadata: {
          originalSize: buffer.length,
          compressedSize: compressedBuffer.length,
          compressionRatio: (1 - compressedBuffer.length / buffer.length) * 100,
          dimensions: { width, height },
          format: options.format || 'jpeg',
          originalDimensions: {
            width: metadata.width,
            height: metadata.height
          }
        }
      }
    } catch (error) {
      logger.error('Server image compression failed', error as Error)
      throw error
    }
  }

  // Compress image to specific file size
  private static async compressToSize(
    buffer: Buffer,
    options: CompressionOptions
  ): Promise<{ buffer: Buffer; metadata: any }> {
    const sharp = await import('sharp').catch(() => null)
    if (!sharp) throw new Error('Sharp not available')

    const targetSizeKB = options.maxSizeKB || 500
    let quality = options.quality || 0.8
    let attempts = 0
    const maxAttempts = 5

    while (attempts < maxAttempts) {
      const result = await this.compressServer(buffer, {
        ...options,
        quality
      })

      if (result.buffer.length <= targetSizeKB * 1024) {
        return result
      }

      // Reduce quality for next attempt
      quality *= 0.8
      attempts++
    }

    // If we can't reach target size, return the last attempt
    return await this.compressServer(buffer, { ...options, quality })
  }

  // Calculate optimal dimensions while maintaining aspect ratio
  private static calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight

    let width = originalWidth
    let height = originalHeight

    // Scale down if larger than max dimensions
    if (width > maxWidth) {
      width = maxWidth
      height = width / aspectRatio
    }

    if (height > maxHeight) {
      height = maxHeight
      width = height * aspectRatio
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
    }
  }

  // Generate multiple sizes for responsive images
  static async generateResponsiveSizes(
    file: File | Buffer,
    sizes: CompressionOptions[] = [
      CompressionPresets.THUMBNAIL,
      CompressionPresets.DISPLAY,
      CompressionPresets.STORAGE
    ]
  ): Promise<Array<{ size: string; buffer: Buffer; metadata: any }>> {
    const results = []

    for (const [index, options] of sizes.entries()) {
      try {
        const result = await this.compressImage(file, options)
        results.push({
          size: ['thumbnail', 'display', 'storage'][index] || `size_${index}`,
          ...result
        })
      } catch (error) {
        logger.error(`Failed to generate size ${index}`, error as Error)
      }
    }

    return results
  }

  // Validate image format and size before processing
  static validateImage(file: File): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const maxSizeMB = 10 // 10MB limit
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      errors.push(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`)
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      errors.push(`File too large. Maximum size: ${maxSizeMB}MB`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // Convert image to base64 for AI processing
  static async toBase64(buffer: Buffer, format: string = 'jpeg'): Promise<string> {
    try {
      const mimeType = `image/${format}`
      const base64 = buffer.toString('base64')
      return `data:${mimeType};base64,${base64}`
    } catch (error) {
      logger.error('Failed to convert image to base64', error as Error)
      throw new Error('Failed to convert image to base64')
    }
  }

  // Get image metadata without processing
  static async getMetadata(buffer: Buffer): Promise<any> {
    try {
      const sharp = await import('sharp').catch(() => null)
      if (!sharp) {
        return { error: 'Sharp not available for metadata extraction' }
      }

      const image = sharp.default(buffer)
      const metadata = await image.metadata()
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        channels: metadata.channels
      }
    } catch (error) {
      logger.error('Failed to extract image metadata', error as Error)
      throw error
    }
  }
}

// Utility function for medical image optimization
export async function optimizeForMedicalAI(file: File | Buffer): Promise<{
  compressed: Buffer
  thumbnail: Buffer
  metadata: any
}> {
  try {
    const [compressed, thumbnail] = await Promise.all([
      ImageCompressionService.compressImage(file, CompressionPresets.AI_ANALYSIS),
      ImageCompressionService.compressImage(file, CompressionPresets.THUMBNAIL)
    ])

    return {
      compressed: compressed.buffer,
      thumbnail: thumbnail.buffer,
      metadata: {
        compressed: compressed.metadata,
        thumbnail: thumbnail.metadata
      }
    }
  } catch (error) {
    logger.error('Medical image optimization failed', error as Error)
    throw error
  }
}

export default ImageCompressionService