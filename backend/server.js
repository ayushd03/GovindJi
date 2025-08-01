require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const storageService = require('./services/StorageService');
const roleMiddleware = require('./middleware/roleMiddleware');

const app = express();
const port = process.env.PORT || 3001;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Serve uploaded images statically
app.use('/product-images', express.static(path.join(__dirname, 'uploads/product-images')));
app.use('/category-images', express.static(path.join(__dirname, 'uploads/category-images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize storage service
(async () => {
    try {
        await storageService.initialize();
        console.log('✅ Storage service initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize storage service:', error);
        process.exit(1);
    }
})();

// Configure multer for memory storage (for cloud upload)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check file type
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Middleware for authentication
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // No token

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) return res.sendStatus(403); // Invalid token

    req.user = user;
    next();
};

// Middleware for admin authentication
const authenticateAdmin = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) return res.sendStatus(403);

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin, role')
        .eq('id', user.id)
        .single();

    if (userError || !userData || !userData.is_admin) {
        return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = user;
    req.userRole = userData;
    next();
};

// Admin Routes
// Admin Dashboard Analytics
app.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
    try {
        // Get order statistics
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('*');

        // Get products count
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('*');

        // Get low stock products
        const { data: lowStock, error: lowStockError } = await supabase
            .from('products')
            .select('*')
            .lt('stock_quantity', 'min_stock_level');

        // Calculate today's revenue
        const today = new Date().toISOString().split('T')[0];
        const { data: todaysOrders, error: todaysError } = await supabase
            .from('orders')
            .select('total_amount')
            .gte('created_at', today)
            .eq('status', 'completed');

        const todaysRevenue = todaysOrders?.reduce((sum, order) => sum + parseFloat(order.total_amount), 0) || 0;

        res.json({
            totalOrders: orders?.length || 0,
            totalProducts: products?.length || 0,
            lowStockItems: lowStock?.length || 0,
            todaysRevenue,
            recentOrders: orders?.slice(-5) || [],
            lowStockProducts: lowStock || []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin Product Management
app.post('/api/admin/products', authenticateAdmin, async (req, res) => {
    const { name, description, price, image_url, category_id, stock_quantity, min_stock_level, sku, weight, unit } = req.body;
    
    const { data, error } = await supabase
        .from('products')
        .insert([{
            name,
            description,
            price,
            image_url,
            category_id,
            stock_quantity: stock_quantity || 0,
            min_stock_level: min_stock_level || 10,
            sku,
            weight,
            unit: unit || 'kg'
        }])
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'CREATE_PRODUCT',
        entity_type: 'product',
        entity_id: data.id,
        details: { product_name: name }
    }]);

    res.status(201).json(data);
});

app.put('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'UPDATE_PRODUCT',
        entity_type: 'product',
        entity_id: id,
        details: updates
    }]);

    res.json(data);
});

app.delete('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'DELETE_PRODUCT',
        entity_type: 'product',
        entity_id: id
    }]);

    res.json({ message: 'Product deleted successfully' });
});

// Admin Order Management
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
        .from('orders')
        .select(`
            *,
            users (name, email),
            order_items (
                *,
                products (name, price)
            )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/orders/:id/status', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'UPDATE_ORDER_STATUS',
        entity_type: 'order',
        entity_id: id,
        details: { new_status: status }
    }]);

    res.json(data);
});

// Admin Stock Management
app.put('/api/admin/products/:id/stock', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { quantity, movement_type, reason } = req.body;

    // Get current stock
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', id)
        .single();

    if (productError) return res.status(500).json({ error: productError.message });

    let newStock;
    if (movement_type === 'in') {
        newStock = product.stock_quantity + quantity;
    } else if (movement_type === 'out') {
        newStock = product.stock_quantity - quantity;
    } else {
        newStock = quantity; // direct adjustment
    }

    // Update product stock
    const { data, error } = await supabase
        .from('products')
        .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Record stock movement
    await supabase.from('stock_movements').insert([{
        product_id: id,
        movement_type,
        quantity,
        reason,
        created_by: req.user.id
    }]);

    res.json(data);
});

// Product Images Routes
// Get all images for a product
app.get('/api/products/:id/images', async (req, res) => {
    const { id } = req.params;
    
    try {
        const { data, error } = await supabase
            .from('product_images')
            .select('*')
            .eq('product_id', id)
            .order('sort_order', { ascending: true });
        
        if (error) return res.status(500).json({ error: error.message });
        res.json(data || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload image file for a product
app.post('/api/admin/products/:id/images/upload', authenticateAdmin, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { alt_text, is_primary } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }

    try {
        // Get the highest sort_order for this product
        const { data: existingImages, error: sortError } = await supabase
            .from('product_images')
            .select('sort_order')
            .eq('product_id', id)
            .order('sort_order', { ascending: false })
            .limit(1);
        
        const nextSortOrder = existingImages && existingImages.length > 0 
            ? existingImages[0].sort_order + 1 
            : 0;
        
        // If this is set as primary, remove primary flag from other images
        if (is_primary === 'true' || is_primary === true) {
            await supabase
                .from('product_images')
                .update({ is_primary: false })
                .eq('product_id', id);
        }
        
        // Process image before upload
        let processedBuffer = req.file.buffer;
        let processedMimeType = req.file.mimetype;
        let processedFilename = req.file.originalname;
        
        // Check if processing settings are provided
        const processingSettings = req.body.processing_settings ? 
            JSON.parse(req.body.processing_settings) : 
            { mode: 'auto', targetFileSize: 150 * 1024 }; // Default to auto mode with 150KB target
        
        try {
            const ImageProcessingWrapper = require('./services/ImageProcessingWrapper');
            const imageProcessor = new ImageProcessingWrapper();
            
            // Check if Python is available, use fallback if not
            let processResult;
            const isPythonAvailable = await imageProcessor.checkPythonAvailability();
            
            if (isPythonAvailable) {
                processResult = await imageProcessor.processImage(
                    req.file.buffer,
                    processingSettings
                );
            } else {
                console.log('Python not available, using Sharp fallback processing');
                processResult = await imageProcessor.simpleFallbackResize(
                    req.file.buffer,
                    processingSettings
                );
            }
            
            if (processResult.success) {
                if (processResult.fallback && processResult.processed_buffer) {
                    // Sharp fallback processing - buffer is directly available
                    processedBuffer = processResult.processed_buffer;
                    processedMimeType = 'image/webp';
                    
                    const originalName = req.file.originalname.split('.')[0];
                    processedFilename = `${originalName}.webp`;
                    
                    console.log(`Image processed with Sharp fallback: ${processResult.original.file_size} -> ${processResult.processed.file_size} bytes (${processResult.compression_ratio}% reduction)`);
                } else {
                    // Python processing - read from file
                    const fs = require('fs');
                    processedBuffer = await fs.promises.readFile(processResult.output_path);
                    
                    // Update MIME type based on processed format
                    const processedFormat = processResult.processed.format.toLowerCase();
                    processedMimeType = `image/${processedFormat === 'jpeg' ? 'jpeg' : processedFormat}`;
                    
                    // Update filename with processed extension
                    const originalName = req.file.originalname.split('.')[0];
                    const extension = processedFormat === 'jpeg' ? 'jpg' : processedFormat;
                    processedFilename = `${originalName}.${extension}`;
                    
                    console.log(`Image processed with Python: ${processResult.original.file_size} -> ${processResult.processed.file_size} bytes (${processResult.compression_ratio}% reduction)`);
                    
                    // Clean up processed file
                    try {
                        await fs.promises.unlink(processResult.output_path);
                    } catch (cleanupError) {
                        console.warn('Could not clean up processed file:', cleanupError.message);
                    }
                }
            } else {
                console.warn('Image processing failed, using original:', processResult.error);
                // Continue with original file if processing fails
            }
        } catch (processingError) {
            console.warn('Image processing error, using original:', processingError.message);
            // Continue with original file if processing fails
        }

        // Upload to cloud storage (now with processed image)
        const uploadResult = await storageService.uploadFile(
            processedBuffer,
            processedFilename,
            processedMimeType,
            {
                prefix: 'products',
                uploadedBy: req.user.id,
                metadata: {
                    productId: id,
                    altText: alt_text || ''
                }
            }
        );

        if (!uploadResult.success) {
            throw new Error('Failed to upload file to cloud storage');
        }
        
        const { data, error } = await supabase
            .from('product_images')
            .insert([{
                product_id: id, // Keep as string since it's UUID
                image_url: uploadResult.url,
                image_type: 'file',
                sort_order: nextSortOrder,
                alt_text: alt_text || '',
                is_primary: is_primary === 'true' || is_primary === true
            }])
            .select()
            .single();
        
        if (error || !data) {
            // Delete the uploaded file from cloud storage if database insert fails
            console.error('Failed to insert image into database:', error);
            try {
                await storageService.deleteFile(uploadResult.url);
            } catch (deleteError) {
                console.error('Failed to cleanup uploaded file:', deleteError);
            }
            return res.status(500).json({ error: error.message });
        }
        
        // Log admin action
        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'UPLOAD_PRODUCT_IMAGE',
            entity_type: 'product',
            entity_id: id,
            details: { 
                image_id: data.id, 
                filename: uploadResult.fileName,
                cloud_url: uploadResult.url 
            }
        }]);
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Product image upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add image by URL for a product
app.post('/api/admin/products/:id/images/url', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { image_url, alt_text, is_primary } = req.body;
    
    if (!image_url) {
        return res.status(400).json({ error: 'Image URL is required' });
    }
    
    try {
        // Get the highest sort_order for this product
        const { data: existingImages, error: sortError } = await supabase
            .from('product_images')
            .select('sort_order')
            .eq('product_id', id)
            .order('sort_order', { ascending: false })
            .limit(1);
        
        const nextSortOrder = existingImages && existingImages.length > 0 
            ? existingImages[0].sort_order + 1 
            : 0;
        
        // If this is set as primary, remove primary flag from other images
        if (is_primary) {
            await supabase
                .from('product_images')
                .update({ is_primary: false })
                .eq('product_id', id);
        }
        
        const { data, error } = await supabase
            .from('product_images')
            .insert([{
                product_id: id,
                image_url,
                image_type: 'url',
                sort_order: nextSortOrder,
                alt_text: alt_text || '',
                is_primary: is_primary || false
            }])
            .select()
            .single();
        
        if (error) return res.status(500).json({ error: error.message });
        
        // Log admin action
        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'ADD_PRODUCT_IMAGE_URL',
            entity_type: 'product',
            entity_id: id,
            details: { image_id: data.id, image_url }
        }]);
        
        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update image order for a product
app.put('/api/admin/products/:id/images/reorder', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { imageOrders } = req.body; // Array of { id, sort_order }
    
    if (!Array.isArray(imageOrders)) {
        return res.status(400).json({ error: 'imageOrders must be an array' });
    }
    
    try {
        // Update each image's sort_order
        const updatePromises = imageOrders.map(async (item) => {
            return supabase
                .from('product_images')
                .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
                .eq('id', item.id)
                .eq('product_id', id); // Ensure image belongs to this product
        });
        
        await Promise.all(updatePromises);
        
        // Get updated images
        const { data, error } = await supabase
            .from('product_images')
            .select('*')
            .eq('product_id', id)
            .order('sort_order', { ascending: true });
        
        if (error) return res.status(500).json({ error: error.message });
        
        // Log admin action
        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'REORDER_PRODUCT_IMAGES',
            entity_type: 'product',
            entity_id: id,
            details: { image_count: imageOrders.length }
        }]);
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a product image
app.delete('/api/admin/products/:productId/images/:imageId', authenticateAdmin, async (req, res) => {
    const { productId, imageId } = req.params;
    
    try {
        // Get image details before deletion
        const { data: imageData, error: fetchError } = await supabase
            .from('product_images')
            .select('*')
            .eq('id', imageId)
            .eq('product_id', productId)
            .single();
        
        if (fetchError || !imageData) {
            return res.status(404).json({ error: 'Image not found' });
        }
        
        // Delete from database
        const { error } = await supabase
            .from('product_images')
            .delete()
            .eq('id', imageId)
            .eq('product_id', productId);
        
        if (error) return res.status(500).json({ error: error.message });
        
        // If it was a file upload, delete from cloud storage
        if (imageData.image_type === 'file') {
            try {
                await storageService.deleteFile(imageData.image_url);
            } catch (deleteError) {
                console.error('Failed to delete file from cloud storage:', deleteError);
                // Continue with the response even if cloud deletion fails
            }
        }
        
        // Log admin action
        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'DELETE_PRODUCT_IMAGE',
            entity_type: 'product',
            entity_id: productId,
            details: { image_id: imageId, image_url: imageData.image_url }
        }]);
        
        res.json({ message: 'Image deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set an image as primary
app.put('/api/admin/products/:productId/images/:imageId/primary', authenticateAdmin, async (req, res) => {
    const { productId, imageId } = req.params;
    
    try {
        // Remove primary flag from all images of this product
        await supabase
            .from('product_images')
            .update({ is_primary: false, updated_at: new Date().toISOString() })
            .eq('product_id', productId);
        
        // Set the specified image as primary
        const { data, error } = await supabase
            .from('product_images')
            .update({ is_primary: true, updated_at: new Date().toISOString() })
            .eq('id', imageId)
            .eq('product_id', productId)
            .select()
            .single();
        
        if (error) return res.status(500).json({ error: error.message });
        
        // Log admin action
        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'SET_PRIMARY_PRODUCT_IMAGE',
            entity_type: 'product',
            entity_id: productId,
            details: { image_id: imageId }
        }]);
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Categories Routes
app.get('/api/categories', async (req, res) => {
    try {
        const { data: categories, error } = await supabase
            .from('categories')
            .select(`
                *,
                category_images (
                    id,
                    image_url,
                    sort_order,
                    alt_text,
                    is_primary
                )
            `)
            .eq('is_active', true)
            .order('display_order', { ascending: true });
        
        if (error) return res.status(500).json({ error: error.message });
        
        // Sort images by sort_order and mark primary image
        const categoriesWithImages = categories.map(category => ({
            ...category,
            category_images: category.category_images.sort((a, b) => a.sort_order - b.sort_order),
            primary_image: category.category_images.find(img => img.is_primary)?.image_url || category.category_images[0]?.image_url
        }));
        
        res.json(categoriesWithImages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/categories', authenticateAdmin, async (req, res) => {
    try {
        const { data: categories, error } = await supabase
            .from('categories')
            .select(`
                *,
                category_images (
                    id,
                    image_url,
                    sort_order,
                    alt_text,
                    is_primary
                )
            `)
            .order('display_order', { ascending: true });
        
        if (error) return res.status(500).json({ error: error.message });
        
        const categoriesWithImages = categories.map(category => ({
            ...category,
            category_images: category.category_images.sort((a, b) => a.sort_order - b.sort_order),
            primary_image: category.category_images.find(img => img.is_primary)?.image_url || category.category_images[0]?.image_url
        }));
        
        res.json(categoriesWithImages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/categories/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('categories')
            .select(`
                *,
                category_images (
                    id,
                    image_url,
                    sort_order,
                    alt_text,
                    is_primary
                )
            `)
            .eq('id', id)
            .single();
        
        if (error) return res.status(500).json({ error: error.message });
        if (!data) return res.status(404).json({ message: 'Category not found' });
        
        data.category_images = data.category_images.sort((a, b) => a.sort_order - b.sort_order);
        data.primary_image = data.category_images.find(img => img.is_primary)?.image_url || data.category_images[0]?.image_url;
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/categories', authenticateAdmin, async (req, res) => {
    try {
        const { name, description, display_order = 0, gradient_colors, is_active = true } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Category name is required' });
        }
        
        const { data, error } = await supabase
            .from('categories')
            .insert([{ 
                name: name.trim(), 
                description, 
                display_order, 
                gradient_colors, 
                is_active 
            }])
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });

        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'CREATE_CATEGORY',
            entity_type: 'category',
            entity_id: data.id,
            details: { category_name: name, description, display_order }
        }]);

        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/categories/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, display_order, gradient_colors, is_active } = req.body;
        
        const updateData = {
            updated_at: new Date().toISOString()
        };
        
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description;
        if (display_order !== undefined) updateData.display_order = display_order;
        if (gradient_colors !== undefined) updateData.gradient_colors = gradient_colors;
        if (is_active !== undefined) updateData.is_active = is_active;
        
        const { data, error } = await supabase
            .from('categories')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        if (!data) return res.status(404).json({ message: 'Category not found' });

        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'UPDATE_CATEGORY',
            entity_type: 'category',
            entity_id: id,
            details: { updated_fields: Object.keys(updateData) }
        }]);

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/categories/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if category has products
        const { data: products, error: productError } = await supabase
            .from('products')
            .select('id')
            .eq('category_id', id)
            .limit(1);
            
        if (productError) return res.status(500).json({ error: productError.message });
        
        if (products && products.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category with existing products. Please move or delete products first.' 
            });
        }
        
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) return res.status(500).json({ error: error.message });

        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'DELETE_CATEGORY',
            entity_type: 'category',
            entity_id: id,
            details: { deleted_at: new Date().toISOString() }
        }]);

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Category Image Management Routes
app.post('/api/admin/categories/:id/images', authenticateAdmin, upload.single('image'), async (req, res) => {
    try {
        const { id: category_id } = req.params;
        const { alt_text, is_primary = false } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }
        
        // Verify category exists
        const { data: category, error: categoryError } = await supabase
            .from('categories')
            .select('id')
            .eq('id', category_id)
            .single();
            
        if (categoryError || !category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        // Get next sort order
        const { data: existingImages, error: sortError } = await supabase
            .from('category_images')
            .select('sort_order')
            .eq('category_id', category_id)
            .order('sort_order', { ascending: false })
            .limit(1);
            
        const next_sort_order = (existingImages && existingImages.length > 0) 
            ? existingImages[0].sort_order + 1 
            : 0;
        
        // If this is primary, unset other primary images
        if (is_primary) {
            await supabase
                .from('category_images')
                .update({ is_primary: false })
                .eq('category_id', category_id);
        }
        
        // Process image before upload
        let processedBuffer = req.file.buffer;
        let processedMimeType = req.file.mimetype;
        let processedFilename = req.file.originalname;
        
        // Check if processing settings are provided
        const processingSettings = req.body.processing_settings ? 
            JSON.parse(req.body.processing_settings) : 
            { mode: 'auto', targetFileSize: 150 * 1024 }; // Default to auto mode with 150KB target
        
        try {
            const ImageProcessingWrapper = require('./services/ImageProcessingWrapper');
            const imageProcessor = new ImageProcessingWrapper();
            
            // Check if Python is available, use fallback if not
            let processResult;
            const isPythonAvailable = await imageProcessor.checkPythonAvailability();
            
            if (isPythonAvailable) {
                processResult = await imageProcessor.processImage(
                    req.file.buffer,
                    processingSettings
                );
            } else {
                console.log('Python not available, using Sharp fallback processing');
                processResult = await imageProcessor.simpleFallbackResize(
                    req.file.buffer,
                    processingSettings
                );
            }
            
            if (processResult.success) {
                if (processResult.fallback && processResult.processed_buffer) {
                    // Sharp fallback processing - buffer is directly available
                    processedBuffer = processResult.processed_buffer;
                    processedMimeType = 'image/webp';
                    
                    const originalName = req.file.originalname.split('.')[0];
                    processedFilename = `${originalName}.webp`;
                    
                    console.log(`Category image processed with Sharp fallback: ${processResult.original.file_size} -> ${processResult.processed.file_size} bytes (${processResult.compression_ratio}% reduction)`);
                } else {
                    // Python processing - read from file
                    const fs = require('fs');
                    processedBuffer = await fs.promises.readFile(processResult.output_path);
                    
                    // Update MIME type based on processed format
                    const processedFormat = processResult.processed.format.toLowerCase();
                    processedMimeType = `image/${processedFormat === 'jpeg' ? 'jpeg' : processedFormat}`;
                    
                    // Update filename with processed extension
                    const originalName = req.file.originalname.split('.')[0];
                    const extension = processedFormat === 'jpeg' ? 'jpg' : processedFormat;
                    processedFilename = `${originalName}.${extension}`;
                    
                    console.log(`Category image processed with Python: ${processResult.original.file_size} -> ${processResult.processed.file_size} bytes (${processResult.compression_ratio}% reduction)`);
                    
                    // Clean up processed file
                    try {
                        await fs.promises.unlink(processResult.output_path);
                    } catch (cleanupError) {
                        console.warn('Could not clean up processed file:', cleanupError.message);
                    }
                }
            } else {
                console.warn('Category image processing failed, using original:', processResult.error);
                // Continue with original file if processing fails
            }
        } catch (processingError) {
            console.warn('Category image processing error, using original:', processingError.message);
            // Continue with original file if processing fails
        }
        
        // Upload to cloud storage (now with processed image)
        const uploadResult = await storageService.uploadFile(
            processedBuffer,
            processedFilename,
            processedMimeType,
            {
                prefix: 'category_images',
                uploadedBy: req.user.id,
                metadata: {
                    categoryId: category_id,
                    altText: alt_text || ''
                }
            }
        );
        
        const image_url = uploadResult.url;
        
        const { data, error } = await supabase
            .from('category_images')
            .insert([{
                category_id,
                image_url,
                sort_order: next_sort_order,
                alt_text,
                is_primary: is_primary === 'true' || is_primary === true
            }])
            .select()
            .single();
            
        if (error) return res.status(500).json({ error: error.message });
        
        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'ADD_CATEGORY_IMAGE',
            entity_type: 'category_image',
            entity_id: data.id,
            details: { 
                category_id, 
                image_url, 
                is_primary,
                file_name: uploadResult.fileName,
                file_size: uploadResult.size
            }
        }]);
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Category image upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add category image by URL
app.post('/api/admin/categories/:id/images/url', authenticateAdmin, async (req, res) => {
    const { id: category_id } = req.params;
    const { image_url, alt_text, is_primary, processing_settings } = req.body;
    
    if (!image_url) {
        return res.status(400).json({ error: 'Image URL is required' });
    }
    
    try {
        // Verify category exists
        const { data: category, error: categoryError } = await supabase
            .from('categories')
            .select('id')
            .eq('id', category_id)
            .single();
            
        if (categoryError || !category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        // Get next sort order
        const { data: existingImages, error: sortError } = await supabase
            .from('category_images')
            .select('sort_order')
            .eq('category_id', category_id)
            .order('sort_order', { ascending: false })
            .limit(1);
            
        const next_sort_order = (existingImages && existingImages.length > 0) 
            ? existingImages[0].sort_order + 1 
            : 0;
        
        // If this is primary, unset other primary images
        if (is_primary) {
            await supabase
                .from('category_images')
                .update({ is_primary: false })
                .eq('category_id', category_id);
        }
        
        // For URL images, we'll store the original URL
        // But we could also process it if needed in the future
        
        const { data, error } = await supabase
            .from('category_images')
            .insert([{
                category_id,
                image_url,
                sort_order: next_sort_order,
                alt_text: alt_text || '',
                is_primary: is_primary || false,
                image_type: 'url'
            }])
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });

        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'ADD_CATEGORY_IMAGE_URL',
            entity_type: 'category_image',
            entity_id: data.id,
            details: { category_id, image_url, alt_text }
        }]);

        res.status(201).json(data);
    } catch (error) {
        console.error('Category image URL upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/categories/:category_id/images/:image_id', authenticateAdmin, async (req, res) => {
    try {
        const { category_id, image_id } = req.params;
        const { alt_text, is_primary, sort_order } = req.body;
        
        const updateData = { updated_at: new Date().toISOString() };
        
        if (alt_text !== undefined) updateData.alt_text = alt_text;
        if (sort_order !== undefined) updateData.sort_order = sort_order;
        if (is_primary !== undefined) {
            updateData.is_primary = is_primary;
            
            // If setting as primary, unset others
            if (is_primary) {
                await supabase
                    .from('category_images')
                    .update({ is_primary: false })
                    .eq('category_id', category_id)
                    .neq('id', image_id);
            }
        }
        
        const { data, error } = await supabase
            .from('category_images')
            .update(updateData)
            .eq('id', image_id)
            .eq('category_id', category_id)
            .select()
            .single();
            
        if (error) return res.status(500).json({ error: error.message });
        if (!data) return res.status(404).json({ message: 'Image not found' });
        
        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'UPDATE_CATEGORY_IMAGE',
            entity_type: 'category_image',
            entity_id: image_id,
            details: { category_id, updated_fields: Object.keys(updateData) }
        }]);
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/categories/:category_id/images/:image_id', authenticateAdmin, async (req, res) => {
    try {
        const { category_id, image_id } = req.params;
        
        // Get image details before deletion
        const { data: image, error: getError } = await supabase
            .from('category_images')
            .select('image_url')
            .eq('id', image_id)
            .eq('category_id', category_id)
            .single();
            
        if (getError || !image) {
            return res.status(404).json({ message: 'Image not found' });
        }
        
        const { error } = await supabase
            .from('category_images')
            .delete()
            .eq('id', image_id)
            .eq('category_id', category_id);
            
        if (error) return res.status(500).json({ error: error.message });
        
        // Try to delete physical file
        try {
            const imagePath = path.join(__dirname, '../frontend/public', image.image_url);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        } catch (fileError) {
            console.warn('Could not delete physical file:', fileError.message);
        }
        
        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'DELETE_CATEGORY_IMAGE',
            entity_type: 'category_image',
            entity_id: image_id,
            details: { category_id, image_url: image.image_url }
        }]);
        
        res.json({ message: 'Image deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize default categories if none exist
app.post('/api/admin/init-categories', authenticateAdmin, async (req, res) => {
    try {
        // Check if categories already exist
        const { data: existingCategories, error: checkError } = await supabase
            .from('categories')
            .select('*');

        if (checkError) return res.status(500).json({ error: checkError.message });

        if (existingCategories.length === 0) {
            const defaultCategories = [
                { 
                    name: 'Nuts', 
                    description: 'Premium quality nuts including almonds, cashews, and walnuts',
                    display_order: 1,
                    gradient_colors: 'from-amber-400 to-orange-500',
                    is_active: true
                },
                { 
                    name: 'Dried Fruits', 
                    description: 'Natural dried fruits with no added preservatives',
                    display_order: 2,
                    gradient_colors: 'from-red-400 to-pink-500',
                    is_active: true
                },
                { 
                    name: 'Seeds', 
                    description: 'Nutritious seeds and kernels for healthy snacking',
                    display_order: 3,
                    gradient_colors: 'from-green-400 to-emerald-500',
                    is_active: true
                },
                { 
                    name: 'Spices', 
                    description: 'Aromatic spices to enhance your culinary experience',
                    display_order: 4,
                    gradient_colors: 'from-yellow-400 to-amber-500',
                    is_active: true
                },
                { 
                    name: 'Traditional Sweets', 
                    description: 'Authentic traditional sweets and confections',
                    display_order: 5,
                    gradient_colors: 'from-purple-400 to-indigo-500',
                    is_active: true
                }
            ];

            const { data, error } = await supabase
                .from('categories')
                .insert(defaultCategories)
                .select();

            if (error) return res.status(500).json({ error: error.message });

            await supabase.from('admin_logs').insert([{
                admin_id: req.user.id,
                action: 'INIT_CATEGORIES',
                entity_type: 'category',
                details: { categories_created: data.length }
            }]);

            res.status(201).json({ message: 'Default categories created', categories: data });
        } else {
            res.json({ message: 'Categories already exist', categories: existingCategories });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Product Routes
app.get('/api/products', async (req, res) => {
    const { data, error } = await supabase
        .from('products')
        .select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ message: 'Product not found' });
    res.json(data);
});

app.get('/api/products/category/:category_name', async (req, res) => {
    const { category_name } = req.params;
    const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('name', category_name)
        .single();

    if (categoryError) return res.status(500).json({ error: categoryError.message });
    if (!categoryData) return res.status(404).json({ message: 'Category not found' });

    const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', categoryData.id);
    
    if (productsError) return res.status(500).json({ error: productsError.message });
    res.json(productsData);
});

// Admin user creation route
app.post('/api/admin/create-admin', async (req, res) => {
    const { user_id, email, name } = req.body;
    
    try {
        // Check if user already exists in users table
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user_id)
            .single();

        if (existingUser) {
            // Update existing user to be admin
            const { data, error } = await supabase
                .from('users')
                .update({ is_admin: true, role: 'admin' })
                .eq('id', user_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.json({ message: 'User updated to admin', user: data });
        } else {
            // Create new admin user record
            const { data, error } = await supabase
                .from('users')
                .insert([{
                    id: user_id,
                    name: name,
                    email: email,
                    password: 'managed_by_supabase_auth', // Dummy password since we use Supabase Auth
                    role: 'admin',
                    is_admin: true
                }])
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ message: 'Admin user created', user: data });
        }
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User Authentication Routes
app.post('/api/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { name: name },
                emailRedirectTo: undefined
            },
        });
        
        if (error) {
            console.error('Signup error:', error);
            return res.status(400).json({ error: error.message });
        }
        
        // Check if user needs email confirmation
        if (data.user && !data.session) {
            return res.status(201).json({ 
                message: 'Please check your email to confirm your account',
                user: data.user,
                confirmationRequired: true 
            });
        }

        // If user is created successfully, also create record in users table
        if (data.user) {
            const isAdmin = email.includes('admin'); // Users with 'admin' in email become admin
            
            try {
                await supabase
                    .from('users')
                    .insert([{
                        id: data.user.id,
                        name: name,
                        email: email,
                        password: 'managed_by_supabase_auth', // Dummy password since we use Supabase Auth
                        role: isAdmin ? 'admin' : 'customer',
                        is_admin: isAdmin
                    }]);
            } catch (insertError) {
                console.log('User record creation failed (user might already exist):', insertError);
            }
        }
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });
        
        if (error) {
            console.error('Login error:', error);
            return res.status(400).json({ error: error.message });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Token validation route
app.get('/api/auth/validate', authenticateToken, async (req, res) => {
    try {
        // If we reach here, the token is valid (authenticateToken middleware passed)
        res.json({ 
            valid: true, 
            user: req.user,
            message: 'Token is valid' 
        });
    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user profile with role information
app.get('/api/auth/profile', roleMiddleware.authenticateToken, async (req, res) => {
    try {
        // Get user role from database
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, name, email, role, is_admin, created_at')
            .eq('id', req.user.id)
            .single();

        if (userError || !userData) {
            // If user doesn't exist in users table, create a default customer entry
            const defaultUser = {
                id: req.user.id,
                name: req.user.user_metadata?.name || req.user.email.split('@')[0],
                email: req.user.email,
                role: 'customer',
                is_admin: false
            };

            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert([{
                    id: req.user.id,
                    name: defaultUser.name,
                    email: defaultUser.email,
                    password: 'managed_by_supabase_auth',
                    role: defaultUser.role,
                    is_admin: defaultUser.is_admin
                }])
                .select()
                .single();

            if (createError) {
                console.error('Error creating user:', createError);
                return res.status(500).json({ error: 'Failed to create user profile' });
            }

            return res.json({
                user: req.user,
                profile: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    is_admin: newUser.is_admin,
                    created_at: newUser.created_at
                }
            });
        }

        res.json({
            user: req.user,
            profile: userData
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Token refresh route
app.post('/api/auth/refresh', async (req, res) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    try {
        const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refresh_token
        });
        
        if (error) {
            console.error('Token refresh error:', error);
            return res.status(401).json({ error: error.message });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Order Routes (protected by authentication middleware)
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { total_amount, status, items } = req.body;
    const { user } = req;

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{ user_id: user.id, total_amount, status }])
        .select()
        .single();

    if (orderError) return res.status(500).json({ error: orderError.message });

    const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
    }));

    const { data: newOrderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .insert(orderItems)
        .select();

    if (orderItemsError) return res.status(500).json({ error: orderItemsError.message });

    res.status(201).json({ order, newOrderItems });
});

app.get('/api/orders/:user_id', authenticateToken, async (req, res) => {
    const { user_id } = req.params;
    if (req.user.id !== user_id) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (
                *,
                products (*)
            )
        `)
        .eq('user_id', user_id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Payment Gateway Integration (Stripe Placeholder)
app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
    const { items } = req.body;

    // Here you would integrate with your chosen payment gateway (e.g., Stripe, Razorpay)
    // For Stripe, it would look something like this:
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const session = await stripe.checkout.sessions.create({
    //     "payment_method_types": ["card"],
    //     line_items: items.map(item => {
    //         return {
    //             price_data: {
    //                 currency: 'usd',
    //                 product_data: {
    //                     name: item.name,
    //                 },
    //                 unit_amount: item.price * 100, // Price in cents
    //             },
    //             quantity: item.quantity,
    //         };
    //     }),
    //     mode: 'payment',
    //     success_url: `${process.env.CLIENT_URL}/success`,
    //     cancel_url: `${process.env.CLIENT_URL}/cancel`,
    // });

    // res.json({ url: session.url });

    res.status(501).json({ message: "Payment gateway not yet implemented. Cash on Delivery is assumed." });
});

// Review Routes
app.get('/api/products/:id/reviews', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('reviews')
        .select(`
            *,
            users (name)
        `)
        .eq('product_id', id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/products/:id/reviews', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const { user } = req;

    const { data, error } = await supabase
        .from('reviews')
        .insert([{
            product_id: id,
            user_id: user.id,
            rating,
            comment
        }])
        .select(`
            *,
            users (name)
        `)
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// Storage health check endpoint
app.get('/api/admin/storage/health', authenticateAdmin, async (req, res) => {
    try {
        const healthStatus = await storageService.healthCheck();
        res.json(healthStatus);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Storage configuration endpoint  
app.get('/api/admin/storage/config', authenticateAdmin, async (req, res) => {
    try {
        const providerType = storageService.getProviderType();
        const capabilities = storageService.getCapabilities();
        
        res.json({
            provider: providerType,
            capabilities,
            initialized: storageService.initialized,
            environment: {
                STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'auto-detected',
                GCP_STORAGE_BUCKET: process.env.GCP_STORAGE_BUCKET ? '***configured***' : 'not set',
                AWS_S3_BUCKET: process.env.AWS_S3_BUCKET ? '***configured***' : 'not set',
                STORAGE_FOLDER: process.env.STORAGE_FOLDER || 'product-images'
            }
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            initialized: false
        });
    }
});

// ======================================
// VENDOR MANAGEMENT ROUTES
// ======================================

// Get all vendors
app.get('/api/admin/vendors', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_VENDORS), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('vendors')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new vendor
app.post('/api/admin/vendors', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), async (req, res) => {
    try {
        const { name, contact_person, phone_number, email, address, category, notes } = req.body;

        const { data, error } = await supabase
            .from('vendors')
            .insert([{
                name,
                contact_person,
                phone_number,
                email,
                address,
                category,
                notes
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating vendor:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update vendor
app.put('/api/admin/vendors/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contact_person, phone_number, email, address, category, notes } = req.body;

        const { data, error } = await supabase
            .from('vendors')
            .update({
                name,
                contact_person,
                phone_number,
                email,
                address,
                category,
                notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating vendor:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete vendor (soft delete)
app.delete('/api/admin/vendors/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('vendors')
            .update({
                is_active: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: 'Vendor deleted successfully' });
    } catch (error) {
        console.error('Error deleting vendor:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================================
// EMPLOYEE MANAGEMENT ROUTES
// ======================================

// Get all employees
app.get('/api/admin/employees', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EMPLOYEES), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new employee
app.post('/api/admin/employees', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_EMPLOYEES), async (req, res) => {
    try {
        const { name, role, contact_number, email, start_date, salary, address, emergency_contact, emergency_phone, notes } = req.body;

        const { data, error } = await supabase
            .from('employees')
            .insert([{
                name,
                role,
                contact_number,
                email,
                start_date,
                salary,
                address,
                emergency_contact,
                emergency_phone,
                notes
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating employee:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update employee
app.put('/api/admin/employees/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_EMPLOYEES), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, role, contact_number, email, start_date, salary, address, emergency_contact, emergency_phone, notes } = req.body;

        const { data, error } = await supabase
            .from('employees')
            .update({
                name,
                role,
                contact_number,
                email,
                start_date,
                salary,
                address,
                emergency_contact,
                emergency_phone,
                notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete employee (soft delete)
app.delete('/api/admin/employees/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_EMPLOYEES), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('employees')
            .update({
                is_active: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================================
// EXPENSE MANAGEMENT ROUTES
// ======================================

// Get all expenses with vendor/employee names
app.get('/api/admin/expenses', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('expenses')
            .select(`
                *,
                vendor:vendor_id(name),
                employee:employee_id(name)
            `)
            .order('expense_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Format the response to include vendor/employee names
        const formattedData = data.map(expense => ({
            ...expense,
            vendor_name: expense.vendor?.name || null,
            employee_name: expense.employee?.name || null
        }));

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get expense analytics
app.get('/api/admin/expenses/analytics', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES), async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        // Today's total
        const { data: todayData } = await supabase
            .from('expenses')
            .select('amount')
            .eq('expense_date', today);

        // Week total
        const { data: weekData } = await supabase
            .from('expenses')
            .select('amount')
            .gte('expense_date', weekAgo);

        // Month total
        const { data: monthData } = await supabase
            .from('expenses')
            .select('amount')
            .gte('expense_date', monthStart);

        // Category breakdown for current month
        const { data: categoryData } = await supabase
            .from('expenses')
            .select('category, amount')
            .gte('expense_date', monthStart);

        // Daily trend for last 7 days
        const { data: dailyData } = await supabase
            .from('expenses')
            .select('expense_date, amount')
            .gte('expense_date', weekAgo)
            .order('expense_date');

        const todayTotal = todayData?.reduce((sum, exp) => sum + parseFloat(exp.amount), 0) || 0;
        const weekTotal = weekData?.reduce((sum, exp) => sum + parseFloat(exp.amount), 0) || 0;
        const monthTotal = monthData?.reduce((sum, exp) => sum + parseFloat(exp.amount), 0) || 0;

        // Process category breakdown
        const categoryBreakdown = {};
        categoryData?.forEach(expense => {
            const category = expense.category;
            categoryBreakdown[category] = (categoryBreakdown[category] || 0) + parseFloat(expense.amount);
        });

        const categoryBreakdownArray = Object.entries(categoryBreakdown).map(([name, amount]) => ({
            name,
            amount
        }));

        // Process daily trend
        const dailyBreakdown = {};
        dailyData?.forEach(expense => {
            const date = expense.expense_date;
            dailyBreakdown[date] = (dailyBreakdown[date] || 0) + parseFloat(expense.amount);
        });

        const dailyTrend = Object.entries(dailyBreakdown).map(([date, amount]) => ({
            date: new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
            amount
        }));

        res.json({
            todayTotal,
            weekTotal,
            monthTotal,
            dailyAverage: monthTotal / new Date().getDate(),
            categoryBreakdown: categoryBreakdownArray,
            dailyTrend
        });
    } catch (error) {
        console.error('Error fetching expense analytics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new expense
app.post('/api/admin/expenses', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_EXPENSES), async (req, res) => {
    try {
        const { amount, description, category, vendor_id, employee_id, payment_mode, expense_date, notes } = req.body;

        const { data, error } = await supabase
            .from('expenses')
            .insert([{
                amount,
                description,
                category,
                vendor_id: vendor_id || null,
                employee_id: employee_id || null,
                payment_mode,
                expense_date,
                notes,
                created_by: req.user.id
            }])
            .select(`
                *,
                vendor:vendor_id(name),
                employee:employee_id(name)
            `)
            .single();

        if (error) throw error;

        const formattedData = {
            ...data,
            vendor_name: data.vendor?.name || null,
            employee_name: data.employee?.name || null
        };

        res.status(201).json(formattedData);
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update expense
app.put('/api/admin/expenses/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_EXPENSES), async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, description, category, vendor_id, employee_id, payment_mode, expense_date, notes } = req.body;

        const { data, error } = await supabase
            .from('expenses')
            .update({
                amount,
                description,
                category,
                vendor_id: vendor_id || null,
                employee_id: employee_id || null,
                payment_mode,
                expense_date,
                notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select(`
                *,
                vendor:vendor_id(name),
                employee:employee_id(name)
            `)
            .single();

        if (error) throw error;

        const formattedData = {
            ...data,
            vendor_name: data.vendor?.name || null,
            employee_name: data.employee?.name || null
        };

        res.json(formattedData);
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete expense
app.delete('/api/admin/expenses/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_EXPENSES), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
}); 