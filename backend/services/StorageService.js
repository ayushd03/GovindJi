const StorageFactory = require('./storage/StorageFactory');

/**
 * Storage Service Singleton
 * Provides a centralized storage service for the application
 */
class StorageService {
  constructor() {
    this.storage = null;
    this.initialized = false;
  }

  /**
   * Initialize the storage service
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    if (this.initialized) {
      return this.storage;
    }

    try {
      const provider = options.provider || process.env.STORAGE_PROVIDER;
      const config = options.config || {};

      // Create storage instance
      if (provider) {
        this.storage = StorageFactory.createStorage(provider, config);
      } else {
        this.storage = StorageFactory.createFromEnvironment();
      }

      // Validate configuration
      const providerType = this.getProviderType();
      const actualConfig = Object.keys(config).length > 0 ? config : StorageFactory.getConfigFromEnvironment(providerType);
      const validation = StorageFactory.validateConfig(providerType, actualConfig);
      
      if (!validation.isValid) {
        console.error('Storage configuration errors:', validation.errors);
        throw new Error(`Storage configuration invalid: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn('Storage configuration warnings:', validation.warnings);
      }

      // Test the connection
      await this.testConnection();

      this.initialized = true;
      console.log(`Storage service initialized with provider: ${providerType}`);
      
      return this.storage;
    } catch (error) {
      console.error('Failed to initialize storage service:', error);
      throw error;
    }
  }

  /**
   * Get the current storage provider type
   * @returns {string} - Provider type
   */
  getProviderType() {
    if (!this.storage) {
      throw new Error('Storage service not initialized');
    }

    if (this.storage.constructor.name === 'GCPStorage') {
      return 'gcp';
    } else if (this.storage.constructor.name === 'AWSS3Storage') {
      return 'aws';
    } else if (this.storage.constructor.name === 'LocalStorage') {
      return 'local';
    } else {
      return 'unknown';
    }
  }

  /**
   * Test storage connection
   * @returns {Promise<boolean>} - Connection status
   */
  async testConnection() {
    try {
      // For GCP and AWS, try to create bucket if it doesn't exist
      if (this.storage.createBucketIfNotExists) {
        await this.storage.createBucketIfNotExists();
      }

      // Test basic operations
      const testBuffer = Buffer.from('test-connection', 'utf8');
      const result = await this.storage.uploadFile(
        testBuffer, 
        'test-connection.txt', 
        'text/plain',
        { prefix: 'health-check' }
      );

      // Clean up test file
      await this.storage.deleteFile(result.url);

      return true;
    } catch (error) {
      console.error('Storage connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get storage instance
   * @returns {StorageInterface} - Storage instance
   */
  getInstance() {
    if (!this.initialized || !this.storage) {
      throw new Error('Storage service not initialized. Call initialize() first.');
    }
    return this.storage;
  }

  /**
   * Upload file using the configured storage provider
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} fileName - Original file name
   * @param {string} mimeType - File MIME type
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} - Upload result
   */
  async uploadFile(fileBuffer, fileName, mimeType, options = {}) {
    const storage = this.getInstance();
    return await storage.uploadFile(fileBuffer, fileName, mimeType, options);
  }

  /**
   * Delete file using the configured storage provider
   * @param {string} fileUrl - File URL to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(fileUrl) {
    const storage = this.getInstance();
    return await storage.deleteFile(fileUrl);
  }

  /**
   * Get file metadata
   * @param {string} fileUrl - File URL
   * @returns {Promise<Object>} - File metadata
   */
  async getFileMetadata(fileUrl) {
    const storage = this.getInstance();
    return await storage.getFileMetadata(fileUrl);
  }

  /**
   * Generate signed URL for temporary access
   * @param {string} fileUrl - File URL
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>} - Signed URL
   */
  async generateSignedUrl(fileUrl, expiresIn = 3600) {
    const storage = this.getInstance();
    return await storage.generateSignedUrl(fileUrl, expiresIn);
  }

  /**
   * Check if file exists
   * @param {string} fileUrl - File URL
   * @returns {Promise<boolean>} - Existence status
   */
  async fileExists(fileUrl) {
    const storage = this.getInstance();
    return await storage.fileExists(fileUrl);
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} - Storage statistics
   */
  async getStorageStats() {
    const storage = this.getInstance();
    
    if (storage.getStorageStats) {
      return await storage.getStorageStats();
    }

    // Fallback basic stats
    return {
      provider: this.getProviderType(),
      initialized: this.initialized,
      capabilities: StorageFactory.getProviderCapabilities(this.getProviderType())
    };
  }

  /**
   * Validate file before upload
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} mimeType - File MIME type
   * @param {Object} options - Validation options
   * @returns {Object} - Validation result
   */
  validateFile(fileBuffer, mimeType, options = {}) {
    const storage = this.getInstance();
    return storage.validateFile(fileBuffer, mimeType, options);
  }

  /**
   * Get provider capabilities
   * @returns {Object} - Provider capabilities
   */
  getCapabilities() {
    return StorageFactory.getProviderCapabilities(this.getProviderType());
  }

  /**
   * Health check for the storage service
   * @returns {Promise<Object>} - Health status
   */
  async healthCheck() {
    try {
      const isHealthy = await this.testConnection();
      const stats = await this.getStorageStats();
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        provider: this.getProviderType(),
        initialized: this.initialized,
        capabilities: this.getCapabilities(),
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        provider: this.getProviderType(),
        initialized: this.initialized,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
const storageService = new StorageService();
module.exports = storageService;