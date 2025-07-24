// Migration script to move existing local files to cloud storage
// Run this with: node migrate-to-cloud-storage.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const storageService = require('./services/StorageService');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const OLD_IMAGES_PATH = path.join(__dirname, '../frontend/public/product_images');

async function migrateLocalFilesToCloud() {
    console.log('🚀 Starting migration from local storage to cloud storage...\n');
    
    try {
        // Initialize storage service
        console.log('1. Initializing cloud storage service...');
        await storageService.initialize();
        const providerType = storageService.getProviderType();
        console.log(`✅ Initialized with provider: ${providerType}\n`);
        
        // Get all product images from database
        console.log('2. Fetching product images from database...');
        const { data: productImages, error: fetchError } = await supabase
            .from('product_images')
            .select('*')
            .eq('image_type', 'file')
            .order('created_at');
        
        if (fetchError) {
            throw new Error(`Failed to fetch product images: ${fetchError.message}`);
        }
        
        console.log(`Found ${productImages.length} product images to migrate\n`);
        
        if (productImages.length === 0) {
            console.log('✅ No images to migrate');
            return;
        }
        
        // Check if local images directory exists
        if (!fs.existsSync(OLD_IMAGES_PATH)) {
            console.log(`❌ Local images directory not found: ${OLD_IMAGES_PATH}`);
            console.log('Nothing to migrate.');
            return;
        }
        
        const results = {
            successful: [],
            failed: [],
            skipped: []
        };
        
        // Process each image
        for (let i = 0; i < productImages.length; i++) {
            const image = productImages[i];
            const progress = `[${i + 1}/${productImages.length}]`;
            
            console.log(`${progress} Processing: ${image.image_url}`);
            
            try {
                // Check if image URL is already a cloud URL
                if (image.image_url.startsWith('http') || image.image_url.startsWith('gs://')) {
                    console.log(`   ⏭️  Already in cloud storage, skipping`);
                    results.skipped.push({
                        id: image.id,
                        url: image.image_url,
                        reason: 'Already in cloud storage'
                    });
                    continue;
                }
                
                // Construct local file path
                let localFilePath;
                if (image.image_url.startsWith('/product_images/')) {
                    localFilePath = path.join(OLD_IMAGES_PATH, image.image_url.replace('/product_images/', ''));
                } else if (image.image_url.startsWith('product_images/')) {
                    localFilePath = path.join(OLD_IMAGES_PATH, image.image_url.replace('product_images/', ''));
                } else {
                    localFilePath = path.join(OLD_IMAGES_PATH, path.basename(image.image_url));
                }
                
                // Check if local file exists
                if (!fs.existsSync(localFilePath)) {
                    console.log(`   ❌ Local file not found: ${localFilePath}`);
                    results.failed.push({
                        id: image.id,
                        url: image.image_url,
                        error: 'Local file not found'
                    });
                    continue;
                }
                
                // Read local file
                const fileBuffer = fs.readFileSync(localFilePath);
                const stats = fs.statSync(localFilePath);
                
                // Determine MIME type from file extension
                const ext = path.extname(localFilePath).toLowerCase();
                const mimeTypeMap = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp'
                };
                const mimeType = mimeTypeMap[ext] || 'image/jpeg';
                
                // Upload to cloud storage
                console.log(`   ⬆️  Uploading to cloud storage...`);
                const uploadResult = await storageService.uploadFile(
                    fileBuffer,
                    path.basename(localFilePath),
                    mimeType,
                    {
                        prefix: 'products',
                        uploadedBy: 'migration-script',
                        metadata: {
                            originalPath: image.image_url,
                            migratedAt: new Date().toISOString(),
                            originalSize: stats.size,
                            productId: image.product_id
                        }
                    }
                );
                
                if (!uploadResult.success) {
                    throw new Error('Cloud upload failed');
                }
                
                // Update database with new cloud URL
                console.log(`   📝 Updating database record...`);
                const { error: updateError } = await supabase
                    .from('product_images')
                    .update({
                        image_url: uploadResult.url,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', image.id);
                
                if (updateError) {
                    // Cleanup uploaded file if database update fails
                    try {
                        await storageService.deleteFile(uploadResult.url);
                    } catch (cleanupError) {
                        console.error('Failed to cleanup uploaded file:', cleanupError);
                    }
                    throw new Error(`Database update failed: ${updateError.message}`);
                }
                
                console.log(`   ✅ Successfully migrated to: ${uploadResult.url}`);
                
                results.successful.push({
                    id: image.id,
                    originalUrl: image.image_url,
                    newUrl: uploadResult.url,
                    size: stats.size,
                    localPath: localFilePath
                });
                
            } catch (error) {
                console.log(`   ❌ Failed to migrate: ${error.message}`);
                results.failed.push({
                    id: image.id,
                    url: image.image_url,
                    error: error.message
                });
            }
            
            console.log(''); // Empty line for readability
        }
        
        // Print migration summary
        console.log('📊 Migration Summary:');
        console.log(`   ✅ Successfully migrated: ${results.successful.length}`);
        console.log(`   ❌ Failed to migrate: ${results.failed.length}`);
        console.log(`   ⏭️  Skipped: ${results.skipped.length}`);
        console.log(`   📁 Total processed: ${productImages.length}`);
        
        if (results.failed.length > 0) {
            console.log('\n❌ Failed migrations:');
            results.failed.forEach(item => {
                console.log(`   - ID: ${item.id}, URL: ${item.url}, Error: ${item.error}`);
            });
        }
        
        if (results.successful.length > 0) {
            console.log('\n🗑️  Local file cleanup:');
            console.log('The following local files can now be safely deleted:');
            results.successful.forEach(item => {
                console.log(`   - ${item.localPath}`);
            });
            
            // Ask for confirmation to delete local files
            console.log('\n⚠️  Would you like to delete the local files now? (y/N)');
            console.log('This action cannot be undone. Make sure the cloud migration was successful.');
            
            // In a real scenario, you might want to use readline for interactive input
            // For now, we'll just log the command to delete files manually
            console.log('\nTo delete local files manually, run:');
            results.successful.forEach(item => {
                console.log(`rm "${item.localPath}"`);
            });
        }
        
        console.log('\n✅ Migration completed!');
        
        if (results.successful.length > 0) {
            console.log('\nNext steps:');
            console.log('1. Verify images display correctly in the application');
            console.log('2. Test image upload/delete functionality');
            console.log('3. Clean up local image files (see list above)');
            console.log('4. Update any hardcoded references to local paths');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

async function checkMigrationStatus() {
    console.log('🔍 Checking migration status...\n');
    
    try {
        // Get all product images
        const { data: productImages, error } = await supabase
            .from('product_images')
            .select('image_type, image_url')
            .eq('image_type', 'file');
        
        if (error) {
            throw new Error(`Failed to fetch images: ${error.message}`);
        }
        
        const localImages = productImages.filter(img => 
            !img.image_url.startsWith('http') && 
            !img.image_url.startsWith('gs://') &&
            !img.image_url.startsWith('s3://')
        );
        
        const cloudImages = productImages.filter(img => 
            img.image_url.startsWith('http') || 
            img.image_url.startsWith('gs://') ||
            img.image_url.startsWith('s3://')
        );
        
        console.log(`📊 Image storage status:`);
        console.log(`   📁 Local images: ${localImages.length}`);
        console.log(`   ☁️  Cloud images: ${cloudImages.length}`);
        console.log(`   📋 Total images: ${productImages.length}`);
        
        if (localImages.length > 0) {
            console.log('\n📁 Local images that need migration:');
            localImages.slice(0, 10).forEach(img => {
                console.log(`   - ${img.image_url}`);
            });
            if (localImages.length > 10) {
                console.log(`   ... and ${localImages.length - 10} more`);
            }
        }
        
    } catch (error) {
        console.error('❌ Status check failed:', error);
    }
}

async function runMigration() {
    const args = process.argv.slice(2);
    
    if (args.includes('--status') || args.includes('-s')) {
        await checkMigrationStatus();
    } else if (args.includes('--help') || args.includes('-h')) {
        console.log('🚀 Cloud Storage Migration Tool\n');
        console.log('Usage:');
        console.log('  node migrate-to-cloud-storage.js              Run migration');
        console.log('  node migrate-to-cloud-storage.js --status     Check migration status');
        console.log('  node migrate-to-cloud-storage.js --help       Show this help');
        console.log('');
        console.log('Environment variables required:');
        console.log('  SUPABASE_URL                 Supabase project URL');
        console.log('  SUPABASE_ANON_KEY           Supabase anon key');
        console.log('  GCP_STORAGE_BUCKET          GCP bucket name (for GCP)');
        console.log('  AWS_S3_BUCKET              S3 bucket name (for AWS)');
        console.log('  STORAGE_PROVIDER           Provider: gcp, aws, or local');
    } else {
        await migrateLocalFilesToCloud();
    }
}

// Run the migration
runMigration();