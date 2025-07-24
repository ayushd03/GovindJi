const fs = require('fs').promises;
const path = require('path');
const StorageInterface = require('./StorageInterface');

/**
 * Local File System Storage Implementation
 * For development and fallback scenarios
 */
class LocalStorage extends StorageInterface {
  constructor(config = {}) {
    super();
    
    this.basePath = config.basePath || path.join(__dirname, '../../uploads');
    this.folder = config.folder || 'product-images';
    this.baseUrl = config.baseUrl || process.env.BASE_URL || 'http://localhost:3001';
    
    // Ensure upload directory exists
    this.ensureDirectoryExists();
  }

  /**
   * Ensure the upload directory exists
   */
  async ensureDirectoryExists() {
    try {
      const fullPath = path.join(this.basePath, this.folder);
      await fs.mkdir(fullPath, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
  }

  /**
   * Upload a file to local storage
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} fileName - Desired file name
   * @param {string} mimeType - File MIME type
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Upload result with URL and metadata
   */
  async uploadFile(fileBuffer, fileName, mimeType, options = {}) {
    try {
      // Validate file
      const validation = this.validateFile(fileBuffer, mimeType, options);
      if (!validation.isValid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate unique file name
      const uniqueFileName = this.generateUniqueFileName(fileName, options.prefix);
      const filePath = path.join(this.basePath, this.folder, uniqueFileName);

      // Write file to disk
      await fs.writeFile(filePath, fileBuffer);

      // Create metadata file
      const metadataPath = filePath + '.meta.json';
      const metadata = {
        originalName: fileName,
        mimeType: mimeType,
        size: fileBuffer.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: options.uploadedBy || 'system',
        ...options.metadata
      };
      
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      // Get the public URL
      const publicUrl = this.getPublicUrl(uniqueFileName);

      return {
        success: true,
        url: publicUrl,
        fileName: uniqueFileName,
        filePath: path.join(this.folder, uniqueFileName),
        size: fileBuffer.length,
        mimeType: mimeType,
        metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Local storage upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Delete a file from local storage
   * @param {string} fileUrl - URL or path of the file to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(fileUrl) {
    try {
      const fileName = this.extractFileNameFromUrl(fileUrl);
      const filePath = path.join(this.basePath, this.folder, fileName);
      const metadataPath = filePath + '.meta.json';

      try {
        // Delete main file
        await fs.unlink(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      try {
        // Delete metadata file
        await fs.unlink(metadataPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn('Could not delete metadata file:', error.message);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Local storage delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Get file metadata from local storage
   * @param {string} fileUrl - URL or path of the file
   * @returns {Promise<Object>} - File metadata
   */
  async getFileMetadata(fileUrl) {
    try {
      const fileName = this.extractFileNameFromUrl(fileUrl);
      const filePath = path.join(this.basePath, this.folder, fileName);
      const metadataPath = filePath + '.meta.json';

      // Try to read metadata file first
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        const metadata = JSON.parse(metadataContent);
        
        // Get file stats for additional info
        const stats = await fs.stat(filePath);
        
        return {
          name: fileName,
          size: metadata.size || stats.size,
          contentType: metadata.mimeType,
          created: metadata.uploadedAt || stats.birthtime.toISOString(),
          updated: stats.mtime.toISOString(),
          customMetadata: metadata
        };
      } catch (metaError) {
        // Fallback to file stats only
        const stats = await fs.stat(filePath);
        
        return {
          name: fileName,
          size: stats.size,
          contentType: 'application/octet-stream',
          created: stats.birthtime.toISOString(),
          updated: stats.mtime.toISOString(),
          customMetadata: {}
        };
      }
    } catch (error) {
      console.error('Local storage metadata error:', error);
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for temporary access (not applicable for local storage)
   * @param {string} fileUrl - URL or path of the file
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>} - Public URL (same as regular URL for local storage)
   */
  async generateSignedUrl(fileUrl, expiresIn = 3600) {
    // Local storage doesn't support signed URLs, return the public URL
    const fileName = this.extractFileNameFromUrl(fileUrl);
    return this.getPublicUrl(fileName);
  }

  /**
   * Check if file exists in local storage
   * @param {string} fileUrl - URL or path of the file
   * @returns {Promise<boolean>} - Existence status
   */
  async fileExists(fileUrl) {
    try {
      const fileName = this.extractFileNameFromUrl(fileUrl);
      const filePath = path.join(this.basePath, this.folder, fileName);
      
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the public URL for a file
   * @param {string} fileName - File name
   * @returns {string} - Public URL
   */
  getPublicUrl(fileName) {
    return `${this.baseUrl}/${this.folder}/${fileName}`;
  }

  /**
   * Extract file name from URL
   * @param {string} fileUrl - Full file URL
   * @returns {string} - File name
   */
  extractFileNameFromUrl(fileUrl) {
    if (fileUrl.startsWith('http')) {
      // Extract from HTTP URL
      return path.basename(fileUrl);
    } else if (fileUrl.includes('/')) {
      // Extract from path
      return path.basename(fileUrl);
    } else {
      // Assume it's already a file name
      return fileUrl;
    }
  }

  /**
   * List files in local storage
   * @param {string} folderName - Folder to list (optional)
   * @param {Object} options - List options
   * @returns {Promise<Array>} - List of files
   */
  async listFiles(folderName = this.folder, options = {}) {
    try {
      const fullPath = path.join(this.basePath, folderName);
      const files = await fs.readdir(fullPath);
      
      const fileList = [];
      
      for (const file of files) {
        // Skip metadata files
        if (file.endsWith('.meta.json')) {
          continue;
        }
        
        const filePath = path.join(fullPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          fileList.push({
            name: file,
            url: this.getPublicUrl(file),
            size: stats.size,
            contentType: this.getMimeTypeFromExtension(file),
            created: stats.birthtime.toISOString(),
            updated: stats.mtime.toISOString()
          });
        }
      }
      
      return fileList.slice(0, options.limit || 1000);
    } catch (error) {
      console.error('Local storage list error:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Get MIME type from file extension
   * @param {string} fileName - File name
   * @returns {string} - MIME type
   */
  getMimeTypeFromExtension(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

module.exports = LocalStorage;