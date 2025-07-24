const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const StorageInterface = require('./StorageInterface');

/**
 * AWS S3 Storage Implementation
 */
class AWSS3Storage extends StorageInterface {
  constructor(config = {}) {
    super();
    
    this.bucketName = config.bucketName || process.env.AWS_S3_BUCKET;
    this.region = config.region || process.env.AWS_REGION || 'us-east-1';
    this.folder = config.folder || 'product-images';
    
    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET environment variable is required');
    }

    // Initialize AWS S3 client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      }
    });
  }

  /**
   * Upload a file to AWS S3
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
      const key = `${this.folder}/${uniqueFileName}`;

      // Set up upload parameters
      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000', // 1 year cache
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
          uploadedBy: options.uploadedBy || 'system',
          ...options.metadata
        }
      };

      // Set ACL if specified
      if (options.makePublic !== false) {
        uploadParams.ACL = 'public-read';
      }

      // Upload file
      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      // Get the public URL
      const publicUrl = this.getPublicUrl(key);

      return {
        success: true,
        url: publicUrl,
        fileName: uniqueFileName,
        filePath: key,
        size: fileBuffer.length,
        mimeType: mimeType,
        metadata: {
          bucket: this.bucketName,
          originalName: fileName,
          uploadedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('AWS S3 upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Delete a file from AWS S3
   * @param {string} fileUrl - URL or key of the file to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(fileUrl) {
    try {
      const key = this.extractFileNameFromUrl(fileUrl);
      
      const deleteParams = {
        Bucket: this.bucketName,
        Key: key
      };

      const command = new DeleteObjectCommand(deleteParams);
      await this.s3Client.send(command);
      
      return true;
    } catch (error) {
      console.error('AWS S3 delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Get file metadata from AWS S3
   * @param {string} fileUrl - URL or key of the file
   * @returns {Promise<Object>} - File metadata
   */
  async getFileMetadata(fileUrl) {
    try {
      const key = this.extractFileNameFromUrl(fileUrl);
      
      const headParams = {
        Bucket: this.bucketName,
        Key: key
      };

      const command = new HeadObjectCommand(headParams);
      const response = await this.s3Client.send(command);
      
      return {
        name: key,
        size: response.ContentLength,
        contentType: response.ContentType,
        created: response.LastModified,
        updated: response.LastModified,
        etag: response.ETag,
        customMetadata: response.Metadata || {}
      };
    } catch (error) {
      console.error('AWS S3 metadata error:', error);
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for temporary access
   * @param {string} fileUrl - URL or key of the file
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>} - Signed URL
   */
  async generateSignedUrl(fileUrl, expiresIn = 3600) {
    try {
      const key = this.extractFileNameFromUrl(fileUrl);
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn 
      });
      
      return signedUrl;
    } catch (error) {
      console.error('AWS S3 signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Check if file exists in AWS S3
   * @param {string} fileUrl - URL or key of the file
   * @returns {Promise<boolean>} - Existence status
   */
  async fileExists(fileUrl) {
    try {
      const key = this.extractFileNameFromUrl(fileUrl);
      
      const headParams = {
        Bucket: this.bucketName,
        Key: key
      };

      const command = new HeadObjectCommand(headParams);
      await this.s3Client.send(command);
      
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      console.error('AWS S3 exists check error:', error);
      return false;
    }
  }

  /**
   * Get the public URL for a file
   * @param {string} key - File key in the bucket
   * @returns {string} - Public URL
   */
  getPublicUrl(key) {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Extract file key from URL
   * @param {string} fileUrl - Full file URL
   * @returns {string} - File key in bucket
   */
  extractFileNameFromUrl(fileUrl) {
    if (fileUrl.includes('.s3.') && fileUrl.includes('amazonaws.com')) {
      // Extract from S3 public URL
      const urlParts = fileUrl.split('.amazonaws.com/');
      return urlParts.length > 1 ? urlParts[1] : fileUrl;
    } else if (fileUrl.startsWith(`s3://${this.bucketName}/`)) {
      // Extract from s3:// URL
      return fileUrl.replace(`s3://${this.bucketName}/`, '');
    } else if (fileUrl.includes('/')) {
      // Assume it's already a file key
      return fileUrl;
    } else {
      // Assume it's a file name, add folder
      return `${this.folder}/${fileUrl}`;
    }
  }
}

module.exports = AWSS3Storage;