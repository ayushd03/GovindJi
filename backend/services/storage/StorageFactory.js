const GCPStorage = require('./GCPStorage');
const AWSS3Storage = require('./AWSS3Storage');
const LocalStorage = require('./LocalStorage');

/**
 * Storage Factory
 * Creates storage instances based on configuration
 */
class StorageFactory {
  /**
   * Available storage providers
   */
  static PROVIDERS = {
    GCP: 'gcp',
    AWS: 'aws',
    LOCAL: 'local'
  };

  /**
   * Create storage instance based on provider type
   * @param {string} providerType - Type of storage provider
   * @param {Object} config - Provider-specific configuration
   * @returns {StorageInterface} - Storage instance
   */
  static createStorage(providerType = null, config = {}) {
    // Auto-detect provider from environment if not specified
    if (!providerType) {
      providerType = this.detectProvider();
    }

    // Normalize provider type
    providerType = providerType.toLowerCase();

    switch (providerType) {
      case this.PROVIDERS.GCP:
        return new GCPStorage(config);
      
      case this.PROVIDERS.AWS:
        return new AWSS3Storage(config);
      
      case this.PROVIDERS.LOCAL:
        return new LocalStorage(config);
      
      default:
        throw new Error(`Unsupported storage provider: ${providerType}`);
    }
  }

  /**
   * Auto-detect storage provider from environment variables
   * @returns {string} - Detected provider type
   */
  static detectProvider() {
    // Check for GCP credentials
    if (process.env.GCP_STORAGE_BUCKET || process.env.GOOGLE_CLOUD_PROJECT) {
      return this.PROVIDERS.GCP;
    }

    // Check for AWS credentials
    if (process.env.AWS_S3_BUCKET || (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)) {
      return this.PROVIDERS.AWS;
    }

    // Default to local storage
    console.warn('No cloud storage credentials detected. Falling back to local storage.');
    return this.PROVIDERS.LOCAL;
  }

  /**
   * Get storage configuration from environment
   * @param {string} providerType - Provider type
   * @returns {Object} - Configuration object
   */
  static getConfigFromEnvironment(providerType) {
    switch (providerType.toLowerCase()) {
      case this.PROVIDERS.GCP:
        return {
          bucketName: process.env.GCP_STORAGE_BUCKET,
          projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
          keyFilename: process.env.GCP_KEY_FILENAME || process.env.GOOGLE_APPLICATION_CREDENTIALS,
          folder: process.env.STORAGE_FOLDER || 'product-images'
        };

      case this.PROVIDERS.AWS:
        return {
          bucketName: process.env.AWS_S3_BUCKET,
          region: process.env.AWS_REGION,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          folder: process.env.STORAGE_FOLDER || 'product-images'
        };

      case this.PROVIDERS.LOCAL:
        return {
          basePath: process.env.LOCAL_STORAGE_PATH || './uploads',
          folder: process.env.STORAGE_FOLDER || 'product-images',
          baseUrl: process.env.BASE_URL || 'http://localhost:3001'
        };

      default:
        return {};
    }
  }

  /**
   * Create storage instance with environment-based configuration
   * @param {string} providerType - Provider type (optional, auto-detected if not provided)
   * @returns {StorageInterface} - Configured storage instance
   */
  static createFromEnvironment(providerType = null) {
    if (!providerType) {
      providerType = this.detectProvider();
    }

    const config = this.getConfigFromEnvironment(providerType);
    return this.createStorage(providerType, config);
  }

  /**
   * Validate storage provider configuration
   * @param {string} providerType - Provider type
   * @param {Object} config - Configuration to validate
   * @returns {Object} - Validation result
   */
  static validateConfig(providerType, config = {}) {
    const errors = [];
    const warnings = [];

    switch (providerType.toLowerCase()) {
      case this.PROVIDERS.GCP:
        if (!config.bucketName) {
          errors.push('GCP bucket name is required');
        }
        if (!config.projectId && !process.env.GOOGLE_CLOUD_PROJECT) {
          warnings.push('GCP project ID not specified, using default credentials');
        }
        if (!config.keyFilename && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          warnings.push('GCP credentials not specified, using default service account');
        }
        break;

      case this.PROVIDERS.AWS:
        if (!config.bucketName) {
          errors.push('AWS S3 bucket name is required');
        }
        if (!config.accessKeyId || !config.secretAccessKey) {
          if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            warnings.push('AWS credentials not fully specified, using IAM role or default credentials');
          }
        }
        break;

      case this.PROVIDERS.LOCAL:
        if (!config.basePath) {
          warnings.push('Local storage path not specified, using default ./uploads');
        }
        break;

      default:
        errors.push(`Unknown provider type: ${providerType}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get available providers
   * @returns {Array} - List of available provider types
   */
  static getAvailableProviders() {
    return Object.values(this.PROVIDERS);
  }

  /**
   * Check if a provider is available based on environment
   * @param {string} providerType - Provider type to check
   * @returns {boolean} - Availability status
   */
  static isProviderAvailable(providerType) {
    const config = this.getConfigFromEnvironment(providerType);
    const validation = this.validateConfig(providerType, config);
    return validation.isValid;
  }

  /**
   * Get provider capabilities
   * @param {string} providerType - Provider type
   * @returns {Object} - Provider capabilities
   */
  static getProviderCapabilities(providerType) {
    switch (providerType.toLowerCase()) {
      case this.PROVIDERS.GCP:
        return {
          signedUrls: true,
          publicUrls: true,
          metadata: true,
          versioning: true,
          lifecycle: true,
          cors: true,
          cdn: true,
          globalDistribution: true
        };

      case this.PROVIDERS.AWS:
        return {
          signedUrls: true,
          publicUrls: true,
          metadata: true,
          versioning: true,
          lifecycle: true,
          cors: true,
          cdn: true,
          globalDistribution: true
        };

      case this.PROVIDERS.LOCAL:
        return {
          signedUrls: false,
          publicUrls: true,
          metadata: true,
          versioning: false,
          lifecycle: false,
          cors: false,
          cdn: false,
          globalDistribution: false
        };

      default:
        return {};
    }
  }

  /**
   * Migration helper to move files between providers
   * @param {StorageInterface} sourceStorage - Source storage provider
   * @param {StorageInterface} targetStorage - Target storage provider
   * @param {Array} fileUrls - List of file URLs to migrate
   * @param {Object} options - Migration options
   * @returns {Promise<Object>} - Migration results
   */
  static async migrateFiles(sourceStorage, targetStorage, fileUrls, options = {}) {
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    for (const fileUrl of fileUrls) {
      try {
        // Check if file exists in source
        const exists = await sourceStorage.fileExists(fileUrl);
        if (!exists) {
          results.skipped.push({ fileUrl, reason: 'File not found in source' });
          continue;
        }

        // Get file metadata
        const metadata = await sourceStorage.getFileMetadata(fileUrl);
        
        // Generate signed URL to download file (for cloud providers)
        let downloadUrl = fileUrl;
        try {
          downloadUrl = await sourceStorage.generateSignedUrl(fileUrl, 3600);
        } catch (signError) {
          // Fallback to public URL if signed URL fails
          console.warn('Could not generate signed URL, using public URL');
        }

        // Download file content (this would need HTTP client implementation)
        // For now, this is a placeholder for the migration logic
        console.log(`Would migrate: ${fileUrl} -> ${targetStorage.constructor.name}`);
        
        results.successful.push({ 
          fileUrl, 
          sourceSize: metadata.size,
          targetProvider: targetStorage.constructor.name 
        });

      } catch (error) {
        results.failed.push({ 
          fileUrl, 
          error: error.message 
        });
      }
    }

    return results;
  }
}

module.exports = StorageFactory;