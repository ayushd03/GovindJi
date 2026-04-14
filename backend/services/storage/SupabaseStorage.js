const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const StorageInterface = require('./StorageInterface');

/**
 * Supabase Storage implementation (S3-compatible buckets via supabase-js Storage API).
 * @see https://supabase.com/docs/reference/javascript/storage-from-upload
 */
class SupabaseStorage extends StorageInterface {
  constructor(config = {}) {
    super();

    this.supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const serviceKey = config.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = config.anonKey || process.env.SUPABASE_ANON_KEY;
    this.supabaseKey = serviceKey || anonKey;

    this.bucketName = config.bucketName || process.env.SUPABASE_STORAGE_BUCKET;
    this.folder = config.folder || process.env.STORAGE_FOLDER || 'product-images';
    this.publicBucket =
      config.publicBucket !== undefined
        ? config.publicBucket
        : process.env.SUPABASE_STORAGE_PUBLIC !== 'false';
    this.signedUrlExpires = parseInt(
      config.signedUrlExpiresSeconds ||
        process.env.SUPABASE_SIGNED_URL_EXPIRES_SECONDS ||
        '3600',
      10
    );

    if (!this.supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is required');
    }
    if (!this.supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required for Supabase Storage');
    }
    if (!this.bucketName) {
      throw new Error('SUPABASE_STORAGE_BUCKET environment variable is required');
    }

    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
  }

  /**
   * @returns {import('@supabase/supabase-js').SupabaseClient}
   */
  get client() {
    return this.supabase;
  }

  bucket() {
    return this.supabase.storage.from(this.bucketName);
  }

  async uploadFile(fileBuffer, fileName, mimeType, options = {}) {
    try {
      const validation = this.validateFile(fileBuffer, mimeType, options);
      if (!validation.isValid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      const uniqueFileName = this.generateUniqueFileName(fileName, options.prefix);
      const objectPath = path.posix.join(this.folder.replace(/^\/+|\/+$/g, ''), uniqueFileName);

      const { data, error } = await this.bucket().upload(objectPath, fileBuffer, {
        contentType: mimeType,
        cacheControl: '31536000',
        upsert: false,
        metadata: {
          originalName: String(fileName),
          uploadedAt: new Date().toISOString(),
          uploadedBy: String(options.uploadedBy || 'system'),
          ...(options.metadata && typeof options.metadata === 'object' ? options.metadata : {})
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      let publicUrl;
      if (this.publicBucket) {
        const { data: urlData } = this.bucket().getPublicUrl(objectPath);
        publicUrl = urlData.publicUrl;
      } else {
        const { data: signed, error: signErr } = await this.bucket().createSignedUrl(
          objectPath,
          this.signedUrlExpires
        );
        if (signErr) {
          throw new Error(signErr.message);
        }
        publicUrl = signed.signedUrl;
      }

      return {
        success: true,
        url: publicUrl,
        fileName: uniqueFileName,
        filePath: objectPath,
        size: fileBuffer.length,
        mimeType,
        metadata: {
          bucket: this.bucketName,
          id: data?.path,
          originalName: fileName,
          uploadedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Supabase Storage upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async deleteFile(fileUrl) {
    try {
      const objectPath = this.extractFileNameFromUrl(fileUrl);
      const { error } = await this.bucket().remove([objectPath]);
      if (error) {
        throw new Error(error.message);
      }
      return true;
    } catch (error) {
      console.error('Supabase Storage delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  async getFileMetadata(fileUrl) {
    try {
      const objectPath = this.extractFileNameFromUrl(fileUrl);
      const dir = path.posix.dirname(objectPath);
      const base = path.posix.basename(objectPath);
      const listPath = dir === '.' ? '' : dir;

      let files;
      let error;
      ({ data: files, error } = await this.bucket().list(listPath, {
        limit: 1000,
        search: base
      }));

      if (error) {
        throw new Error(error.message);
      }

      let entry = files?.find((f) => f.name === base);
      if (!entry) {
        ({ data: files, error } = await this.bucket().list(listPath, { limit: 1000 }));
        if (error) {
          throw new Error(error.message);
        }
        entry = files?.find((f) => f.name === base);
      }
      if (!entry) {
        throw new Error(`File not found: ${objectPath}`);
      }

      return {
        name: objectPath,
        size: entry.metadata?.size ?? null,
        contentType: entry.metadata?.mimetype,
        created: entry.created_at,
        updated: entry.updated_at,
        customMetadata: entry.metadata || {}
      };
    } catch (error) {
      console.error('Supabase Storage metadata error:', error);
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  }

  async generateSignedUrl(fileUrl, expiresIn = 3600) {
    try {
      const objectPath = this.extractFileNameFromUrl(fileUrl);
      const { data, error } = await this.bucket().createSignedUrl(objectPath, expiresIn);
      if (error) {
        throw new Error(error.message);
      }
      return data.signedUrl;
    } catch (error) {
      console.error('Supabase Storage signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  async fileExists(fileUrl) {
    try {
      const objectPath = this.extractFileNameFromUrl(fileUrl);
      const dir = path.posix.dirname(objectPath);
      const base = path.posix.basename(objectPath);
      const listPath = dir === '.' ? '' : dir;

      const { data: files, error } = await this.bucket().list(listPath, {
        limit: 1000,
        search: base
      });

      if (error) {
        return false;
      }

      return Boolean(files?.some((f) => f.name === base));
    } catch (error) {
      console.error('Supabase Storage exists check error:', error);
      return false;
    }
  }

  getPublicUrl(objectPath) {
    const { data } = this.bucket().getPublicUrl(objectPath);
    return data.publicUrl;
  }

  extractFileNameFromUrl(fileUrl) {
    if (!fileUrl.startsWith('http')) {
      const trimmed = fileUrl.replace(/^\/+/, '');
      if (trimmed.includes('/')) {
        return trimmed;
      }
      return path.posix.join(this.folder, trimmed);
    }

    const bucketSeg = `/${this.bucketName}/`;
    const publicMarker = `/storage/v1/object/public/${this.bucketName}/`;
    const signMarker = `/storage/v1/object/sign/${this.bucketName}/`;

    let idx = fileUrl.indexOf(publicMarker);
    if (idx !== -1) {
      return decodeURIComponent(fileUrl.slice(idx + publicMarker.length).split('?')[0]);
    }

    idx = fileUrl.indexOf(signMarker);
    if (idx !== -1) {
      return decodeURIComponent(fileUrl.slice(idx + signMarker.length).split('?')[0]);
    }

    idx = fileUrl.indexOf(bucketSeg);
    if (idx !== -1) {
      return decodeURIComponent(fileUrl.slice(idx + bucketSeg.length).split('?')[0]);
    }

    try {
      const u = new URL(fileUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      const b = parts.indexOf(this.bucketName);
      if (b >= 0 && b < parts.length - 1) {
        return decodeURIComponent(parts.slice(b + 1).join('/'));
      }
    } catch (_) {
      // ignore
    }

    return path.posix.basename(fileUrl.split('?')[0]);
  }

  async listFiles(prefix = this.folder, options = {}) {
    try {
      const p = prefix === this.folder ? this.folder : prefix;
      const { data: files, error } = await this.bucket().list(p, {
        limit: options.limit || 1000,
        offset: options.offset || 0,
        sortBy: options.sortBy
      });

      if (error) {
        throw new Error(error.message);
      }

      return (files || [])
        .filter((f) => f.id)
        .map((f) => {
          const objectPath = path.posix.join(p, f.name);
          return {
            name: f.name,
            url: this.getPublicUrl(objectPath),
            size: f.metadata?.size,
            contentType: f.metadata?.mimetype,
            created: f.created_at,
            updated: f.updated_at
          };
        });
    } catch (error) {
      console.error('Supabase Storage list error:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async createBucketIfNotExists() {
    try {
      const { data: existing, error: getErr } = await this.supabase.storage.getBucket(this.bucketName);
      if (!getErr && existing) {
        return true;
      }

      const { error: createErr } = await this.supabase.storage.createBucket(this.bucketName, {
        public: this.publicBucket
      });

      if (createErr) {
        if (/already exists|Duplicate/i.test(createErr.message)) {
          return true;
        }
        console.warn('Supabase Storage createBucket:', createErr.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Supabase Storage bucket check error:', error);
      throw new Error(`Failed to ensure bucket: ${error.message}`);
    }
  }

  async getStorageStats() {
    try {
      const { data: files, error } = await this.bucket().list(this.folder, { limit: 1000 });
      if (error) {
        throw new Error(error.message);
      }

      const list = files || [];
      return {
        provider: 'supabase',
        totalFiles: list.filter((f) => f.id).length,
        totalSize: 0,
        bucket: this.bucketName
      };
    } catch (error) {
      console.error('Supabase Storage stats error:', error);
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }
}

module.exports = SupabaseStorage;
