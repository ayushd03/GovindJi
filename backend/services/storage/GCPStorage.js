const { Storage } = require('@google-cloud/storage');
const StorageInterface = require('./StorageInterface');

/**
 * Google Cloud Platform Storage Implementation
 */
class GCPStorage extends StorageInterface {
  constructor(config = {}) {
    super();
    
    this.bucketName = config.bucketName || process.env.GCP_STORAGE_BUCKET;
    this.projectId = config.projectId || process.env.GCP_PROJECT_ID;
    this.keyFilename = config.keyFilename || process.env.GCP_KEY_FILENAME;
    this.folder = config.folder || 'product-images';
    
    if (!this.bucketName) {
      throw new Error('GCP_STORAGE_BUCKET environment variable is required');
    }

    // Initialize GCP Storage client
    const storageOptions = {
      projectId: this.projectId
    };

    // Use key file if provided, otherwise use default credentials
    if (this.keyFilename) {
      storageOptions.keyFilename = this.keyFilename;
    }

    this.storage = new Storage(storageOptions);
    this.bucket = this.storage.bucket(this.bucketName);
  }

  /**
   * Upload a file to GCP Cloud Storage
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
      const filePath = `${this.folder}/${uniqueFileName}`;

      // Create file reference
      const file = this.bucket.file(filePath);

      // Set up upload options
      const uploadOptions = {
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000', // 1 year cache
          metadata: {
            originalName: fileName,
            uploadedAt: new Date().toISOString(),
            uploadedBy: options.uploadedBy || 'system',
            ...options.metadata
          }
        },
        public: options.makePublic !== false, // Default to public
        resumable: false, // Use simple upload for small files
        validation: 'crc32c'
      };

      // Upload file
      await file.save(fileBuffer, uploadOptions);

      // Make file public if requested (default)
      if (options.makePublic !== false) {
        await file.makePublic();
      }

      // Get the public URL
      const publicUrl = this.getPublicUrl(filePath);

      return {
        success: true,
        url: publicUrl,
        fileName: uniqueFileName,
        filePath: filePath,
        size: fileBuffer.length,
        mimeType: mimeType,
        metadata: {
          bucket: this.bucketName,
          originalName: fileName,
          uploadedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('GCP Storage upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Delete a file from GCP Cloud Storage
   * @param {string} fileUrl - URL or path of the file to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(fileUrl) {
    try {
      const filePath = this.extractFileNameFromUrl(fileUrl);
      const file = this.bucket.file(filePath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        console.warn(`File not found: ${filePath}`);
        return true; // Consider non-existent file as successfully deleted
      }

      // Delete the file
      await file.delete();
      
      return true;
    } catch (error) {
      console.error('GCP Storage delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Get file metadata from GCP Cloud Storage
   * @param {string} fileUrl - URL or path of the file
   * @returns {Promise<Object>} - File metadata
   */
  async getFileMetadata(fileUrl) {
    try {
      const filePath = this.extractFileNameFromUrl(fileUrl);
      const file = this.bucket.file(filePath);

      const [metadata] = await file.getMetadata();
      
      return {
        name: metadata.name,
        size: parseInt(metadata.size),
        contentType: metadata.contentType,
        created: metadata.timeCreated,
        updated: metadata.updated,
        etag: metadata.etag,
        crc32c: metadata.crc32c,
        customMetadata: metadata.metadata || {}
      };
    } catch (error) {
      console.error('GCP Storage metadata error:', error);
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for temporary access
   * @param {string} fileUrl - URL or path of the file
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>} - Signed URL
   */
  async generateSignedUrl(fileUrl, expiresIn = 3600) {
    try {
      const filePath = this.extractFileNameFromUrl(fileUrl);
      const file = this.bucket.file(filePath);

      const options = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
      };

      const [signedUrl] = await file.getSignedUrl(options);
      return signedUrl;
    } catch (error) {
      console.error('GCP Storage signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Check if file exists in GCP Cloud Storage
   * @param {string} fileUrl - URL or path of the file
   * @returns {Promise<boolean>} - Existence status
   */
  async fileExists(fileUrl) {
    try {
      const filePath = this.extractFileNameFromUrl(fileUrl);
      const file = this.bucket.file(filePath);
      
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error('GCP Storage exists check error:', error);
      return false;
    }
  }

  /**
   * Get the public URL for a file
   * @param {string} filePath - File path in the bucket
   * @returns {string} - Public URL
   */
  getPublicUrl(filePath) {
    return `https://storage.googleapis.com/${this.bucketName}/${filePath}`;
  }

  /**
   * Extract file path from URL
   * @param {string} fileUrl - Full file URL
   * @returns {string} - File path in bucket
   */
  extractFileNameFromUrl(fileUrl) {
    if (fileUrl.startsWith('https://storage.googleapis.com/')) {
      // Extract from GCP public URL
      const urlParts = fileUrl.replace('https://storage.googleapis.com/', '').split('/');
      urlParts.shift(); // Remove bucket name
      return urlParts.join('/');
    } else if (fileUrl.startsWith(`gs://${this.bucketName}/`)) {
      // Extract from gs:// URL
      return fileUrl.replace(`gs://${this.bucketName}/`, '');
    } else if (fileUrl.includes('/')) {
      // Assume it's already a file path
      return fileUrl;
    } else {
      // Assume it's a file name, add folder
      return `${this.folder}/${fileUrl}`;
    }
  }

  /**
   * List files in a folder
   * @param {string} prefix - Folder prefix to list
   * @param {Object} options - List options
   * @returns {Promise<Array>} - List of files
   */
  async listFiles(prefix = this.folder, options = {}) {
    try {
      const [files] = await this.bucket.getFiles({
        prefix: prefix + '/',
        maxResults: options.limit || 1000,
        delimiter: options.delimiter
      });

      return files.map(file => ({
        name: file.name,
        url: this.getPublicUrl(file.name),
        size: file.metadata.size,
        contentType: file.metadata.contentType,
        created: file.metadata.timeCreated,
        updated: file.metadata.updated
      }));
    } catch (error) {
      console.error('GCP Storage list error:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Create the bucket if it doesn't exist
   * @param {Object} options - Bucket creation options
   * @returns {Promise<boolean>} - Success status
   */
  async createBucketIfNotExists(options = {}) {
    try {
      const [exists] = await this.bucket.exists();
      
      if (!exists) {
        console.log(`Creating bucket: ${this.bucketName}`);
        
        const bucketOptions = {
          location: options.location || 'US',
          storageClass: options.storageClass || 'STANDARD',
          versioning: {
            enabled: options.versioning || false
          },
          lifecycle: {
            rule: options.lifecycleRules || []
          }
        };

        await this.storage.createBucket(this.bucketName, bucketOptions);
        console.log(`Bucket ${this.bucketName} created successfully`);
      }
      
      return true;
    } catch (error) {
      console.error('Bucket creation error:', error);
      throw new Error(`Failed to create bucket: ${error.message}`);
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} - Storage statistics
   */
  async getStorageStats() {
    try {
      const [files] = await this.bucket.getFiles({ prefix: this.folder + '/' });
      
      const stats = {
        totalFiles: files.length,
        totalSize: 0,
        fileTypes: {},
        oldestFile: null,
        newestFile: null
      };

      files.forEach(file => {
        const size = parseInt(file.metadata.size || 0);
        const contentType = file.metadata.contentType || 'unknown';
        const created = new Date(file.metadata.timeCreated);

        stats.totalSize += size;
        stats.fileTypes[contentType] = (stats.fileTypes[contentType] || 0) + 1;

        if (!stats.oldestFile || created < new Date(stats.oldestFile.created)) {
          stats.oldestFile = { name: file.name, created: file.metadata.timeCreated };
        }

        if (!stats.newestFile || created > new Date(stats.newestFile.created)) {
          stats.newestFile = { name: file.name, created: file.metadata.timeCreated };
        }
      });

      return stats;
    } catch (error) {
      console.error('Storage stats error:', error);
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }
}

module.exports = GCPStorage;