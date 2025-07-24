# Cloud Storage Implementation Guide

## Overview

This document describes the cloud storage implementation for the vibe-kanban e-commerce platform. The system supports multiple cloud storage providers (GCP Cloud Storage, AWS S3) with an abstraction layer that allows easy switching between providers.

## Features

### Multi-Provider Support
- **Google Cloud Platform (GCP) Cloud Storage** - Primary recommendation
- **Amazon Web Services (AWS) S3** - Alternative cloud option
- **Local Storage** - Development/fallback option

### Provider-Agnostic Design
- Abstract storage interface for consistent API
- Factory pattern for easy provider switching
- Environment-based configuration
- Automatic provider detection

### Production-Ready Features
- File validation and security
- Error handling and rollback
- Health monitoring
- Admin endpoints for storage management
- Comprehensive logging

## Architecture

### Storage Interface
All storage providers implement the `StorageInterface` class:

```javascript
class StorageInterface {
  async uploadFile(fileBuffer, fileName, mimeType, options = {})
  async deleteFile(fileUrl)
  async getFileMetadata(fileUrl)
  async generateSignedUrl(fileUrl, expiresIn = 3600)
  async fileExists(fileUrl)
  getPublicUrl(fileName)
  extractFileNameFromUrl(fileUrl)
  validateFile(fileBuffer, mimeType, options = {})
}
```

### Provider Implementations

#### GCP Cloud Storage (`GCPStorage`)
- Uses `@google-cloud/storage` library
- Supports service account authentication
- Automatic bucket creation
- Public URL generation
- Signed URL support for temporary access

#### AWS S3 (`AWSS3Storage`)
- Uses `@aws-sdk/client-s3` library
- IAM role or access key authentication
- Presigned URL support
- Cross-region bucket support

#### Local Storage (`LocalStorage`)
- File system storage for development
- Metadata file support
- Directory management

### Storage Factory
The `StorageFactory` class handles provider creation and configuration:

```javascript
// Auto-detect provider from environment
const storage = StorageFactory.createFromEnvironment();

// Specify provider explicitly
const storage = StorageFactory.createStorage('gcp', config);
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install @google-cloud/storage @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 2. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

### For GCP Cloud Storage (Recommended)

#### Option A: Service Account Key File
1. Create a GCP service account with Cloud Storage permissions
2. Download the JSON key file
3. Set environment variables:

```bash
GCP_STORAGE_BUCKET=your-bucket-name
GCP_PROJECT_ID=your-project-id
GCP_KEY_FILENAME=path/to/service-account-key.json
STORAGE_PROVIDER=gcp
```

#### Option B: Default Credentials (Recommended for production)
If running on GCP (Cloud Run, GKE, Compute Engine):

```bash
GCP_STORAGE_BUCKET=your-bucket-name
GCP_PROJECT_ID=your-project-id
STORAGE_PROVIDER=gcp
```

### For AWS S3

```bash
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
STORAGE_PROVIDER=aws
```

### For Local Storage (Development)

```bash
LOCAL_STORAGE_PATH=./uploads
BASE_URL=http://localhost:3001
STORAGE_PROVIDER=local
```

### 3. Create Storage Bucket

#### GCP Cloud Storage
```bash
# Using gcloud CLI
gsutil mb gs://your-bucket-name

# Set public access (optional)
gsutil iam ch allUsers:objectViewer gs://your-bucket-name
```

#### AWS S3
```bash
# Using AWS CLI
aws s3 mb s3://your-bucket-name --region us-east-1

# Set public access policy (optional)
aws s3api put-public-access-block --bucket your-bucket-name --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false
```

### 4. Test the Implementation

Start the server:
```bash
npm run dev
```

Check storage health:
```bash
curl http://localhost:3001/api/admin/storage/health \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## API Endpoints

### Storage Management (Admin Only)

#### GET `/api/admin/storage/health`
Returns storage service health status.

**Response:**
```json
{
  "status": "healthy",
  "provider": "gcp",
  "initialized": true,
  "capabilities": {
    "signedUrls": true,
    "publicUrls": true,
    "metadata": true,
    "versioning": true
  },
  "stats": {
    "totalFiles": 150,
    "totalSize": 52428800
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### GET `/api/admin/storage/config`
Returns current storage configuration.

**Response:**
```json
{
  "provider": "gcp",
  "capabilities": {...},
  "initialized": true,
  "environment": {
    "STORAGE_PROVIDER": "gcp",
    "GCP_STORAGE_BUCKET": "***configured***",
    "AWS_S3_BUCKET": "not set",
    "STORAGE_FOLDER": "product-images"
  }
}
```

## Provider-Specific Configuration

### GCP Cloud Storage

#### Required Permissions
Your service account needs these IAM roles:
- `Storage Object Admin` - For file operations
- `Storage Bucket Reader` - For bucket operations

#### Bucket Configuration
```javascript
// Automatic bucket creation with options
const bucketOptions = {
  location: 'US',
  storageClass: 'STANDARD',
  versioning: { enabled: false },
  lifecycle: { rule: [] }
};
```

#### URL Format
```
https://storage.googleapis.com/bucket-name/product-images/filename.jpg
```

### AWS S3

#### Required Permissions
Your IAM user/role needs these permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

#### URL Format
```
https://bucket-name.s3.region.amazonaws.com/product-images/filename.jpg
```

## Migration Between Providers

### Switching Providers
1. Update environment variables
2. Restart the application
3. The system will automatically use the new provider

### Data Migration (Future Enhancement)
The `StorageFactory` includes a migration helper:

```javascript
const results = await StorageFactory.migrateFiles(
  sourceStorage,
  targetStorage,
  fileUrls,
  options
);
```

## File Organization

### Directory Structure
```
bucket-name/
├── product-images/
│   ├── products_timestamp_uuid.jpg
│   ├── products_timestamp_uuid.png
│   └── ...
└── other-folders/
```

### File Naming Convention
- Format: `{prefix}_{timestamp}_{uuid}.{extension}`
- Example: `products_1641123456789_550e8400-e29b-41d4-a716-446655440000.jpg`
- Ensures uniqueness and prevents conflicts

## Security Considerations

### File Validation
- File type validation (images only)
- File size limits (25MB default)
- MIME type checking
- Buffer inspection

### Access Control
- Admin-only upload endpoints
- Authentication required for management operations
- Public read access for product images
- Signed URLs for temporary access

### Error Handling
- Graceful degradation on provider failures
- Automatic cleanup on failed operations
- Comprehensive error logging
- Fallback mechanisms

## Performance Optimization

### Caching
- Browser caching headers (1 year)
- CDN integration support
- Optimized file naming for cache efficiency

### File Processing
- Memory-based upload processing
- Streaming for large files
- Compression support (provider-dependent)

### Monitoring
- Health check endpoints
- Storage statistics
- Error tracking
- Performance metrics

## Troubleshooting

### Common Issues

#### GCP Authentication Errors
```bash
# Check service account key
gcloud auth activate-service-account --key-file=path/to/key.json

# Verify permissions
gsutil iam get gs://your-bucket-name
```

#### AWS Authentication Errors
```bash
# Check credentials
aws sts get-caller-identity

# Verify bucket access
aws s3 ls s3://your-bucket-name
```

#### Upload Failures
1. Check file size limits
2. Verify MIME type restrictions
3. Check network connectivity
4. Review storage quotas

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=storage:*
```

### Health Monitoring
Monitor the health endpoint:
```bash
# Simple health check
curl -f http://localhost:3001/api/admin/storage/health \
  -H "Authorization: Bearer $ADMIN_TOKEN" || echo "Storage unhealthy"
```

## Best Practices

### Production Deployment
1. Use managed identities (GCP) or IAM roles (AWS)
2. Enable bucket versioning for data protection
3. Set up lifecycle policies for cost optimization
4. Implement monitoring and alerting
5. Regular backup and disaster recovery testing

### Development
1. Use local storage for development
2. Separate buckets for different environments
3. Mock storage for unit tests
4. Environment-specific configuration

### Security
1. Rotate access keys regularly
2. Use least-privilege access policies
3. Enable audit logging
4. Monitor for unusual access patterns
5. Implement rate limiting

## Cost Optimization

### GCP Cloud Storage
- Use Standard storage class for frequently accessed files
- Implement lifecycle policies for archival
- Consider regional vs multi-regional based on usage

### AWS S3
- Use Standard-IA for infrequently accessed files
- Implement intelligent tiering
- Monitor data transfer costs

### General
- Compress images before upload
- Implement client-side caching
- Use CDN for global distribution
- Monitor storage usage regularly

## Support and Maintenance

### Monitoring
- Storage health checks
- File upload/download metrics
- Error rate monitoring
- Cost tracking

### Maintenance
- Regular credential rotation
- Bucket policy reviews
- Performance optimization
- Security updates

---

**Last Updated:** January 2024  
**Version:** 2.0.0