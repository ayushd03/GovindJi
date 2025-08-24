/**
 * Abstract Storage Interface
 * Defines the contract that all storage providers must implement
 */
class StorageInterface {
  /**
   * Upload a file to storage
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} fileName - Desired file name
   * @param {string} mimeType - File MIME type
   * @param {Object} options - Additional options (folder, metadata, etc.)
   * @returns {Promise<Object>} - Upload result with URL and metadata
   */
  async uploadFile(fileBuffer, fileName, mimeType, options = {}) {
    throw new Error('uploadFile method must be implemented');
  }

  /**
   * Delete a file from storage
   * @param {string} fileUrl - URL or key of the file to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(fileUrl) {
    throw new Error('deleteFile method must be implemented');
  }

  /**
   * Get file metadata
   * @param {string} fileUrl - URL or key of the file
   * @returns {Promise<Object>} - File metadata
   */
  async getFileMetadata(fileUrl) {
    throw new Error('getFileMetadata method must be implemented');
  }

  /**
   * Generate signed URL for temporary access
   * @param {string} fileUrl - URL or key of the file
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>} - Signed URL
   */
  async generateSignedUrl(fileUrl, expiresIn = 3600) {
    throw new Error('generateSignedUrl method must be implemented');
  }

  /**
   * Check if file exists
   * @param {string} fileUrl - URL or key of the file
   * @returns {Promise<boolean>} - Existence status
   */
  async fileExists(fileUrl) {
    throw new Error('fileExists method must be implemented');
  }

  /**
   * Get the public URL for a file
   * @param {string} fileName - File name or key
   * @returns {string} - Public URL
   */
  getPublicUrl(fileName) {
    throw new Error('getPublicUrl method must be implemented');
  }

  /**
   * Extract file name/key from URL
   * @param {string} fileUrl - Full file URL
   * @returns {string} - File name or key
   */
  extractFileNameFromUrl(fileUrl) {
    throw new Error('extractFileNameFromUrl method must be implemented');
  }

  /**
   * Validate file before upload
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} mimeType - File MIME type
   * @param {Object} options - Validation options
   * @returns {Object} - Validation result
   */
  validateFile(fileBuffer, mimeType, options = {}) {
    const errors = [];
    
    // No file size limit

    // Check MIME type
    const allowedTypes = options.allowedMimeTypes || [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp'
    ];
    
    if (!allowedTypes.includes(mimeType)) {
      errors.push(`File type ${mimeType} not allowed`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate unique file name
   * @param {string} originalName - Original file name
   * @param {string} prefix - Optional prefix
   * @returns {string} - Unique file name
   */
  generateUniqueFileName(originalName, prefix = '') {
    const { v4: uuidv4 } = require('uuid');
    const path = require('path');
    
    const ext = path.extname(originalName);
    const uuid = uuidv4();
    const timestamp = Date.now();
    
    return `${prefix}${prefix ? '_' : ''}${timestamp}_${uuid}${ext}`;
  }

  /**
   * List files in storage (optional implementation)
   * @param {string} prefix - Optional prefix to filter files
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Array of file objects
   */
  async listFiles(prefix = '', options = {}) {
    // Default implementation returns empty array
    // Providers can override this method
    return [];
  }

  /**
   * Create bucket if it doesn't exist (cloud storage specific)
   * @returns {Promise<boolean>} - Success status
   */
  async createBucketIfNotExists() {
    // Default implementation does nothing
    // Cloud providers can override this method
    return true;
  }

  /**
   * Get storage statistics (optional implementation)
   * @returns {Promise<Object>} - Storage statistics
   */
  async getStorageStats() {
    // Default implementation returns basic stats
    return {
      provider: 'unknown',
      totalFiles: 0,
      totalSize: 0
    };
  }

  /**
   * Get MIME type from file extension (utility method)
   * @param {string} fileName - File name with extension
   * @returns {string} - MIME type
   */
  getMimeTypeFromExtension(fileName) {
    const path = require('path');
    const ext = path.extname(fileName).toLowerCase();
    
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

module.exports = StorageInterface;