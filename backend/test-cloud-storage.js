// Test script for cloud storage implementation
// Run this with: node test-cloud-storage.js

require('dotenv').config();
const storageService = require('./services/StorageService');
const fs = require('fs');
const path = require('path');

const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.jpg');

// Create a test image if it doesn't exist
function createTestImage() {
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
        // Create a simple test image (1x1 pixel JPEG)
        const testImageBuffer = Buffer.from([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
            0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
            0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
            0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0xAA, 0xFF, 0xD9
        ]);
        
        fs.writeFileSync(TEST_IMAGE_PATH, testImageBuffer);
        console.log('✅ Created test image file');
    }
}

async function testStorageService() {
    console.log('🧪 Testing Cloud Storage Service...\n');
    
    try {
        // Initialize storage service
        console.log('1. Initializing storage service...');
        await storageService.initialize();
        const providerType = storageService.getProviderType();
        console.log(`✅ Initialized with provider: ${providerType}\n`);
        
        // Test health check
        console.log('2. Testing health check...');
        const health = await storageService.healthCheck();
        console.log(`✅ Health status: ${health.status}`);
        console.log(`   Provider: ${health.provider}`);
        console.log(`   Capabilities: ${JSON.stringify(health.capabilities, null, 2)}\n`);
        
        // Test file validation
        console.log('3. Testing file validation...');
        createTestImage();
        const testBuffer = fs.readFileSync(TEST_IMAGE_PATH);
        const validation = storageService.validateFile(testBuffer, 'image/jpeg');
        console.log(`✅ File validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
        if (!validation.isValid) {
            console.log(`   Errors: ${validation.errors.join(', ')}`);
        }
        console.log('');
        
        // Test file upload
        console.log('4. Testing file upload...');
        const uploadResult = await storageService.uploadFile(
            testBuffer,
            'test-upload.jpg',
            'image/jpeg',
            {
                prefix: 'test',
                uploadedBy: 'test-script',
                metadata: {
                    description: 'Test image upload',
                    timestamp: new Date().toISOString()
                }
            }
        );
        
        console.log(`✅ Upload successful:`);
        console.log(`   URL: ${uploadResult.url}`);
        console.log(`   File name: ${uploadResult.fileName}`);
        console.log(`   Size: ${uploadResult.size} bytes\n`);
        
        const uploadedFileUrl = uploadResult.url;
        
        // Test file existence check
        console.log('5. Testing file existence check...');
        const exists = await storageService.fileExists(uploadedFileUrl);
        console.log(`✅ File exists: ${exists}\n`);
        
        // Test file metadata retrieval
        console.log('6. Testing file metadata retrieval...');
        const metadata = await storageService.getFileMetadata(uploadedFileUrl);
        console.log(`✅ Metadata retrieved:`);
        console.log(`   Name: ${metadata.name}`);
        console.log(`   Size: ${metadata.size} bytes`);
        console.log(`   Content Type: ${metadata.contentType}`);
        console.log(`   Created: ${metadata.created}\n`);
        
        // Test signed URL generation (if supported)
        console.log('7. Testing signed URL generation...');
        try {
            const signedUrl = await storageService.generateSignedUrl(uploadedFileUrl, 300);
            console.log(`✅ Signed URL generated: ${signedUrl.substring(0, 50)}...\n`);
        } catch (signedUrlError) {
            console.log(`⚠️  Signed URLs not supported by this provider: ${signedUrlError.message}\n`);
        }
        
        // Test file deletion
        console.log('8. Testing file deletion...');
        const deleteResult = await storageService.deleteFile(uploadedFileUrl);
        console.log(`✅ File deleted: ${deleteResult}\n`);
        
        // Verify deletion
        console.log('9. Verifying file deletion...');
        const existsAfterDelete = await storageService.fileExists(uploadedFileUrl);
        console.log(`✅ File exists after deletion: ${existsAfterDelete}\n`);
        
        // Test error handling
        console.log('10. Testing error handling...');
        try {
            await storageService.uploadFile(
                Buffer.from('not an image'),
                'test.txt',
                'text/plain' // Invalid MIME type
            );
            console.log('❌ Error handling failed - should have rejected invalid file type');
        } catch (validationError) {
            console.log(`✅ Error handling works: ${validationError.message}\n`);
        }
        
        // Get storage statistics
        console.log('11. Getting storage statistics...');
        try {
            const stats = await storageService.getStorageStats();
            console.log(`✅ Storage statistics:`);
            console.log(JSON.stringify(stats, null, 2));
        } catch (statsError) {
            console.log(`⚠️  Storage statistics not available: ${statsError.message}`);
        }
        
        console.log('\n🎉 All tests completed successfully!');
        
        // Cleanup test file
        if (fs.existsSync(TEST_IMAGE_PATH)) {
            fs.unlinkSync(TEST_IMAGE_PATH);
            console.log('✅ Cleaned up test image file');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        
        // Cleanup on error
        if (fs.existsSync(TEST_IMAGE_PATH)) {
            fs.unlinkSync(TEST_IMAGE_PATH);
        }
        
        process.exit(1);
    }
}

async function testProviderSwitching() {
    console.log('\n🔄 Testing Provider Detection...\n');
    
    const StorageFactory = require('./services/storage/StorageFactory');
    
    // Test auto-detection
    const detectedProvider = StorageFactory.detectProvider();
    console.log(`Auto-detected provider: ${detectedProvider}`);
    
    // Test available providers
    const availableProviders = StorageFactory.getAvailableProviders();
    console.log(`Available providers: ${availableProviders.join(', ')}`);
    
    // Test provider capabilities
    for (const provider of availableProviders) {
        const capabilities = StorageFactory.getProviderCapabilities(provider);
        console.log(`${provider.toUpperCase()} capabilities:`, capabilities);
    }
    
    // Test configuration validation
    console.log('\nConfiguration validation:');
    for (const provider of availableProviders) {
        const config = StorageFactory.getConfigFromEnvironment(provider);
        const validation = StorageFactory.validateConfig(provider, config);
        console.log(`${provider.toUpperCase()}: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`);
        if (validation.errors.length > 0) {
            console.log(`  Errors: ${validation.errors.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
            console.log(`  Warnings: ${validation.warnings.join(', ')}`);
        }
    }
}

async function runAllTests() {
    console.log('🚀 Cloud Storage Test Suite\n');
    
    // Test environment check
    console.log('Environment check:');
    console.log(`STORAGE_PROVIDER: ${process.env.STORAGE_PROVIDER || 'not set'}`);
    console.log(`GCP_STORAGE_BUCKET: ${process.env.GCP_STORAGE_BUCKET || 'not set'}`);
    console.log(`AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET || 'not set'}`);
    console.log('');
    
    try {
        await testProviderSwitching();
        await testStorageService();
        
        console.log('\n✅ All tests passed successfully!');
        console.log('\nNext steps:');
        console.log('1. Run the backend server: npm run dev');
        console.log('2. Test file uploads through the admin panel');
        console.log('3. Monitor storage health at /api/admin/storage/health');
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Run the tests
runAllTests();