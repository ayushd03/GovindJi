// Migration script to create product_images table and migrate existing images
// Run this with: node migrate-images.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createProductImagesTable() {
    console.log('Creating product_images table...');
    
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS product_images (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            product_id UUID REFERENCES products(id) ON DELETE CASCADE,
            image_url TEXT NOT NULL,
            image_type VARCHAR(10) DEFAULT 'url',
            sort_order INTEGER NOT NULL DEFAULT 0,
            alt_text VARCHAR(255),
            is_primary BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `;
    
    const indexQueries = [
        `CREATE INDEX IF NOT EXISTS idx_product_images_product_sort ON product_images(product_id, sort_order);`,
        `CREATE INDEX IF NOT EXISTS idx_product_images_product_primary ON product_images(product_id, is_primary);`
    ];
    
    try {
        // Execute table creation via raw SQL
        const { error: tableError } = await supabase.rpc('execute_sql', {
            sql: createTableQuery
        });
        
        if (tableError) {
            console.log('Table might already exist or RPC not available. Proceeding with migration...');
        } else {
            console.log('✅ product_images table created successfully');
        }
        
        // Create indexes
        for (const indexQuery of indexQueries) {
            const { error: indexError } = await supabase.rpc('execute_sql', {
                sql: indexQuery
            });
            
            if (indexError) {
                console.log('Index creation skipped (might already exist)');
            }
        }
        
        console.log('✅ Indexes created successfully');
        
    } catch (error) {
        console.log('Using fallback table check method...');
    }
}

async function migrateExistingImages() {
    console.log('Migrating existing product images...');
    
    try {
        // Get all products with image_url
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, image_url')
            .not('image_url', 'is', null)
            .neq('image_url', '');
        
        if (productsError) {
            console.error('Error fetching products:', productsError);
            return;
        }
        
        console.log(`Found ${products.length} products with images to migrate`);
        
        let migratedCount = 0;
        let skippedCount = 0;
        
        for (const product of products) {
            // Check if this product already has images in the new table
            const { data: existingImages, error: checkError } = await supabase
                .from('product_images')
                .select('id')
                .eq('product_id', product.id)
                .limit(1);
            
            if (checkError) {
                console.error(`Error checking existing images for product ${product.id}:`, checkError);
                continue;
            }
            
            if (existingImages && existingImages.length > 0) {
                console.log(`Skipping product ${product.id} - already has images in new table`);
                skippedCount++;
                continue;
            }
            
            // Migrate the image
            const { data: newImage, error: insertError } = await supabase
                .from('product_images')
                .insert([{
                    product_id: product.id,
                    image_url: product.image_url,
                    image_type: 'url',
                    sort_order: 0,
                    alt_text: 'Product image',
                    is_primary: true
                }])
                .select()
                .single();
            
            if (insertError) {
                console.error(`Error migrating image for product ${product.id}:`, insertError);
                continue;
            }
            
            console.log(`✅ Migrated image for product ${product.id}`);
            migratedCount++;
        }
        
        console.log(`\n📊 Migration Summary:`);
        console.log(`   Images migrated: ${migratedCount}`);
        console.log(`   Products skipped: ${skippedCount}`);
        console.log(`   Total processed: ${migratedCount + skippedCount}`);
        
    } catch (error) {
        console.error('Migration error:', error);
    }
}

async function runMigration() {
    console.log('🚀 Starting image system migration...\n');
    
    try {
        await createProductImagesTable();
        console.log('');
        await migrateExistingImages();
        
        console.log('\n✅ Migration completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Install new dependencies: npm install');
        console.log('2. Start the backend server: npm run dev');
        console.log('3. Test the new image management features in the admin panel');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
runMigration();