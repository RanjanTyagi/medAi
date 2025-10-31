import crypto from 'crypto'
import { logger } from './logger'

export interface EncryptionResult {
  encryptedData: string
  iv: string
  tag: string
}

export interface DecryptionResult {
  decryptedData: Buffer
  success: boolean
  error?: string
}

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32 // 256 bits
  private static readonly IV_LENGTH = 16 // 128 bits
  private static readonly TAG_LENGTH = 16 // 128 bits

  // Get encryption key from environment or generate one
  private static getEncryptionKey(): Buffer {
    const keyString = process.env.ENCRYPTION_KEY
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY environment variable is required')
    }
    
    // Ensure key is exactly 32 bytes
    const key = Buffer.from(keyString, 'base64')
    if (key.length !== this.KEY_LENGTH) {
      throw new Error(`Encryption key must be ${this.KEY_LENGTH} bytes long`)
    }
    
    return key
  }

  // Generate a new encryption key (for setup)
  static generateEncryptionKey(): string {
    const key = crypto.randomBytes(this.KEY_LENGTH)
    return key.toString('base64')
  }

  // Encrypt data (for medical images and sensitive content)
  static encryptData(data: Buffer): EncryptionResult {
    try {
      const key = this.getEncryptionKey()
      const iv = crypto.randomBytes(this.IV_LENGTH)
      
      const cipher = crypto.createCipherGCM(this.ALGORITHM, key, iv)
      
      const encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final()
      ])
      
      const tag = cipher.getAuthTag()
      
      return {
        encryptedData: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64')
      }
    } catch (error) {
      logger.error('Encryption failed', error as Error)
      throw new Error('Failed to encrypt data')
    }
  }

  // Decrypt data
  static decryptData(encryptedData: string, iv: string, tag: string): DecryptionResult {
    try {
      const key = this.getEncryptionKey()
      const ivBuffer = Buffer.from(iv, 'base64')
      const tagBuffer = Buffer.from(tag, 'base64')
      const encryptedBuffer = Buffer.from(encryptedData, 'base64')
      
      const decipher = crypto.createDecipherGCM(this.ALGORITHM, key, ivBuffer)
      decipher.setAuthTag(tagBuffer)
      
      const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
      ])
      
      return {
        decryptedData: decrypted,
        success: true
      }
    } catch (error) {
      logger.error('Decryption failed', error as Error)
      return {
        decryptedData: Buffer.alloc(0),
        success: false,
        error: 'Failed to decrypt data'
      }
    }
  }

  // Encrypt text data (for sensitive strings)
  static encryptText(text: string): EncryptionResult {
    const buffer = Buffer.from(text, 'utf8')
    return this.encryptData(buffer)
  }

  // Decrypt text data
  static decryptText(encryptedData: string, iv: string, tag: string): { text: string; success: boolean; error?: string } {
    const result = this.decryptData(encryptedData, iv, tag)
    
    if (!result.success) {
      return {
        text: '',
        success: false,
        error: result.error
      }
    }
    
    return {
      text: result.decryptedData.toString('utf8'),
      success: true
    }
  }

  // Hash sensitive data (for indexing without exposing content)
  static hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  // Generate secure random tokens
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url')
  }

  // Generate API keys
  static generateApiKey(): string {
    const timestamp = Date.now().toString(36)
    const randomPart = crypto.randomBytes(24).toString('base64url')
    return `med_${timestamp}_${randomPart}`
  }

  // Validate API key format
  static validateApiKeyFormat(apiKey: string): boolean {
    const pattern = /^med_[a-z0-9]+_[A-Za-z0-9_-]+$/
    return pattern.test(apiKey)
  }

  // Create HMAC signature for API requests
  static createHmacSignature(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex')
  }

  // Verify HMAC signature
  static verifyHmacSignature(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.createHmacSignature(data, secret)
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  }

  // Encrypt file for storage
  static async encryptFile(fileBuffer: Buffer, metadata?: any): Promise<{
    encryptedData: string
    iv: string
    tag: string
    metadata?: string
  }> {
    try {
      // Encrypt the file data
      const fileEncryption = this.encryptData(fileBuffer)
      
      // Encrypt metadata if provided
      let encryptedMetadata: string | undefined
      if (metadata) {
        const metadataEncryption = this.encryptText(JSON.stringify(metadata))
        encryptedMetadata = JSON.stringify(metadataEncryption)
      }
      
      return {
        encryptedData: fileEncryption.encryptedData,
        iv: fileEncryption.iv,
        tag: fileEncryption.tag,
        metadata: encryptedMetadata
      }
    } catch (error) {
      logger.error('File encryption failed', error as Error)
      throw new Error('Failed to encrypt file')
    }
  }

  // Decrypt file from storage
  static async decryptFile(
    encryptedData: string, 
    iv: string, 
    tag: string, 
    encryptedMetadata?: string
  ): Promise<{
    fileBuffer: Buffer
    metadata?: any
    success: boolean
    error?: string
  }> {
    try {
      // Decrypt file data
      const fileDecryption = this.decryptData(encryptedData, iv, tag)
      if (!fileDecryption.success) {
        return {
          fileBuffer: Buffer.alloc(0),
          success: false,
          error: fileDecryption.error
        }
      }
      
      // Decrypt metadata if provided
      let metadata: any
      if (encryptedMetadata) {
        try {
          const metadataEncryption = JSON.parse(encryptedMetadata)
          const metadataDecryption = this.decryptText(
            metadataEncryption.encryptedData,
            metadataEncryption.iv,
            metadataEncryption.tag
          )
          
          if (metadataDecryption.success) {
            metadata = JSON.parse(metadataDecryption.text)
          }
        } catch (error) {
          logger.warn('Failed to decrypt file metadata', error as Error)
        }
      }
      
      return {
        fileBuffer: fileDecryption.decryptedData,
        metadata,
        success: true
      }
    } catch (error) {
      logger.error('File decryption failed', error as Error)
      return {
        fileBuffer: Buffer.alloc(0),
        success: false,
        error: 'Failed to decrypt file'
      }
    }
  }

  // Secure data comparison (timing-safe)
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8')
    )
  }

  // Generate password hash with salt
  static hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
    
    return { hash, salt }
  }

  // Verify password against hash
  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const passwordHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
    return this.secureCompare(passwordHash, hash)
  }

  // Generate session token
  static generateSessionToken(): {
    token: string
    hash: string
    expiresAt: Date
  } {
    const token = this.generateSecureToken(48)
    const hash = this.hashData(token)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    
    return { token, hash, expiresAt }
  }

  // Validate session token
  static validateSessionToken(token: string, storedHash: string): boolean {
    const tokenHash = this.hashData(token)
    return this.secureCompare(tokenHash, storedHash)
  }
}