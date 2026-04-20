require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const storageService = require('./services/StorageService');
const roleMiddleware = require('./middleware/roleMiddleware');
const { authenticateToken: authenticateScopedAuthToken } = require('./middleware/authMiddleware');
const { validateProduct } = require('./middleware/validateProduct');
const { errorHandler, notFoundHandler, requestId, asyncHandler, logger, sendSuccess, sendError } = require('./middleware/errorHandler');
const {
    createBackendSupabaseClient,
    getSupabaseServiceRoleKey
} = require('./config/supabaseClient');

// Import expense routes
const expenseRoutes = require('./routes/expenseRoutes');

// Import payment routes
const paymentRoutes = require('./routes/paymentRoutes');
const adminPaymentRoutes = require('./routes/adminPaymentRoutes');

// Import delivery routes
const deliveryRoutes = require('./routes/deliveryRoutes');
const adminDeliveryRoutes = require('./routes/adminDeliveryRoutes');
const deliveryService = require('./services/delivery/DeliveryService');
const pickupScheduler = require('./services/delivery/pickupScheduler');
const orderRecoveryService = require('./services/order/OrderRecoveryService');
const { buildVariantMutationPlan } = require('./services/productVariantSync');
const {
    parseProcessingSettings,
    fetchImageFromUrl,
} = require('./utils/imageProcessingHttp');
const ImageProcessingWrapper = require('./services/ImageProcessingWrapper');
const {
    parsePageLimit,
    parseOffsetLimit,
    buildPagePagination,
    buildOffsetPagination
} = require('./utils/pagination');

const app = express();
const port = process.env.PORT || 3001;
const parsedMaxImageUploadBytes = Number.parseInt(
    process.env.MAX_IMAGE_UPLOAD_BYTES || `${30 * 1024 * 1024}`,
    10
);
const MAX_IMAGE_UPLOAD_BYTES = Number.isFinite(parsedMaxImageUploadBytes) && parsedMaxImageUploadBytes > 0
    ? parsedMaxImageUploadBytes
    : 30 * 1024 * 1024;
const uploadTempDir = path.join(__dirname, 'uploads', 'tmp');

if (!fs.existsSync(uploadTempDir)) {
    fs.mkdirSync(uploadTempDir, { recursive: true });
}

// Initialize Supabase client
const supabase = createBackendSupabaseClient();
const supabaseServiceRoleKey = getSupabaseServiceRoleKey();
const supabaseAdmin = supabaseServiceRoleKey
    ? createBackendSupabaseClient({
        preferServiceRole: true,
        allowAnonFallback: false,
        options: {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            }
        }
    })
    : null;

const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and contain uppercase, lowercase, numbers, and special characters';

const isStrongPassword = (password = '') => (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
);

const getFrontendBaseUrl = () => (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    'http://localhost:3000'
);

const buildFrontendAuthUrl = (query = {}) => {
    const url = new URL('/auth', getFrontendBaseUrl());
    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });
    return url.toString();
};

const ORDER_STATUS_VALUES = new Set([
    'pending',
    'processing',
    'shipped',
    'completed',
    'cancelled'
]);

const parseOptionalNumber = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const roundToPrecision = (value, precision = 1) => {
    const multiplier = 10 ** precision;
    return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
};

const computeDiscountPercent = (mrpValue, priceValue) => {
    const mrp = parseOptionalNumber(mrpValue, null);
    const price = parseOptionalNumber(priceValue, null);

    if (!mrp || !price || mrp <= 0 || price <= 0 || mrp <= price) {
        return 0;
    }

    return roundToPrecision(((mrp - price) / mrp) * 100, 1);
};

const selectDefaultVariant = (variants = []) => {
    if (!Array.isArray(variants) || variants.length === 0) {
        return null;
    }

    return (
        variants.find((variant) => variant?.is_default) ||
        [...variants].sort((left, right) => (left?.display_order || 0) - (right?.display_order || 0))[0]
    );
};

const normalizeVariantPricing = (variant = {}) => {
    const price = parseOptionalNumber(variant.price, 0);
    const mrp = parseOptionalNumber(variant.mrp, null);
    const discountPercent = mrp
        ? computeDiscountPercent(mrp, price)
        : Math.max(parseOptionalNumber(variant.discount_percent ?? variant.discount, 0), 0);

    return {
        ...variant,
        price,
        mrp,
        discount_percent: discountPercent,
        discount: discountPercent
    };
};

const enrichProductPricing = (product = {}, variants = []) => {
    const normalizedVariants = Array.isArray(variants)
        ? variants.map(normalizeVariantPricing)
        : [];
    const defaultVariant = selectDefaultVariant(normalizedVariants);
    const productMrp = parseOptionalNumber(product.mrp, null);
    const productDiscount = productMrp
        ? computeDiscountPercent(productMrp, product.price)
        : (
            product.discount_type === 'percentage'
                ? Math.max(parseOptionalNumber(product.discount_on_sale_price, 0), 0)
                : 0
        );
    const effectiveMrp = defaultVariant ? defaultVariant.mrp : productMrp;
    const effectiveDiscount = defaultVariant ? defaultVariant.discount_percent : productDiscount;

    return {
        ...product,
        mrp: effectiveMrp,
        discount: effectiveDiscount,
        discount_percent: effectiveDiscount,
        variants: normalizedVariants
    };
};

const mapAuthFailure = (error, fallbackMessage = 'Invalid login credentials') => {
    const code = error?.code;
    const message = (error?.message || '').toLowerCase();

    if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
        return {
            status: 403,
            body: {
                success: false,
                error: 'Please confirm your email before signing in',
                code: 'email_not_confirmed'
            }
        };
    }

    if (code === 'weak_password' || message.includes('password')) {
        return {
            status: 400,
            body: {
                success: false,
                error: PASSWORD_POLICY_MESSAGE,
                code: 'weak_password'
            }
        };
    }

    if (code === 'user_already_exists' || message.includes('already registered')) {
        return {
            status: 409,
            body: {
                success: false,
                error: 'An account with this email already exists. Please sign in instead.',
                code: 'user_already_exists'
            }
        };
    }

    if (message.includes('rate limit')) {
        return {
            status: 429,
            body: {
                success: false,
                error: 'Too many attempts. Please wait a moment and try again.',
                code: 'rate_limited'
            }
        };
    }

    return {
        status: 401,
        body: {
            success: false,
            error: fallbackMessage,
            code: 'invalid_credentials'
        }
    };
};

const createServerAuthClient = (accessToken) => createBackendSupabaseClient({
    options: {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        },
        global: accessToken ? {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        } : undefined
    }
});

// Add request ID middleware first
app.use(requestId);

// Configure CORS with explicit settings
const corsOptions = {
  origin: [
    'http://localhost:80',
    'http://localhost:3000',
    'http://localhost',
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL
  ].filter(Boolean), // Remove any undefined values
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Note: CORS preflight requests are handled automatically by app.use(cors(corsOptions))
// The explicit app.options('*', cors(...)) call was causing an error in Express 5.x
// Removing it to fix the issue

app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ limit: '1gb', extended: true }));

// Serve uploaded images statically
app.use('/product-images', express.static(path.join(__dirname, 'uploads/product-images')));
app.use('/category-images', express.static(path.join(__dirname, 'uploads/category-images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize storage service
(async () => {
    try {
        await storageService.initialize();
        logger.info('✅ Storage service initialized successfully');
    } catch (error) {
        logger.error('❌ Failed to initialize storage service', error);
        process.exit(1);
    }
})();

// Initialize delivery service
try {
    deliveryService.initialize();
    logger.info('✅ Delivery service initialized successfully');

    // Start automated pickup scheduler
    if (process.env.ENABLE_PICKUP_SCHEDULER === 'true') {
        pickupScheduler.start();
        logger.info('✅ Pickup scheduler started - daily pickups will be scheduled at 6 PM IST');
    }
} catch (error) {
    logger.warn('⚠️  Delivery service initialization failed - delivery features will be disabled', error.message);
}

const cleanupUploadedTempFile = async (file) => {
    if (!file?.path) {
        return;
    }

    try {
        await fs.promises.unlink(file.path);
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            logger.warn('Failed to clean up temporary upload file', {
                path: file.path,
                error: error.message
            });
        }
    }
};

const readUploadedFile = async (file) => {
    if (!file?.path) {
        throw new Error('Uploaded file path is missing');
    }

    return fs.promises.readFile(file.path);
};

const isFatalImageProcessingError = (message = '') => {
    const normalized = String(message).toLowerCase();
    return normalized.includes('pixel limit');
};

// Configure multer for disk storage to avoid keeping large uploads in RAM
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadTempDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname || '');
            cb(null, `upload_${Date.now()}_${uuidv4()}${ext}`);
        }
    }),
    limits: {
        fileSize: MAX_IMAGE_UPLOAD_BYTES
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
const authenticateToken = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        logger.warn('Authentication attempt without token', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.originalUrl
        });
        return res.sendStatus(401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
        logger.warn('Authentication attempt with invalid token', {
            error: error.message,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.originalUrl
        });
        return res.sendStatus(403);
    }

    req.user = user;
    next();
});

// Middleware for admin authentication
const authenticateAdmin = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        logger.warn('Admin authentication attempt without token', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.originalUrl
        });
        return res.sendStatus(401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) {
        logger.warn('Admin authentication attempt with invalid token', {
            error: error.message,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.originalUrl
        });
        return res.sendStatus(403);
    }

    // Check if user has admin or manager role
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (userError || !userData || (userData.role !== 'admin' && userData.role !== 'manager')) {
        logger.warn('Non-admin user attempted to access admin route', {
            userId: user.id,
            userEmail: user.email,
            userRole: userData?.role,
            path: req.originalUrl,
            ip: req.ip
        });
        return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = user;
    req.userRole = userData.role;
    next();
});

// Use expense routes
app.use('/api/admin/expenses', expenseRoutes);

// Use payment routes
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminPaymentRoutes);

// Use delivery routes
app.use('/api/delivery', deliveryRoutes);
app.use('/api/admin/delivery', adminDeliveryRoutes);

// Admin Routes
// Admin Dashboard
app.get('/api/admin/dashboard', authenticateAdmin, asyncHandler(async (req, res) => {
    // Get order statistics
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*');
    if (ordersError) throw ordersError;

    // Get products count
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*');
    if (productsError) throw productsError;

    // Get low stock products (filter from already fetched products)
    const lowStock = products?.filter(product => 
        product.stock_quantity < product.min_stock_level
    ) || [];

    // Calculate today's revenue
    const today = new Date().toISOString().split('T')[0];
    const { data: todaysOrders, error: todaysError } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', today)
        .eq('status', 'completed');
    if (todaysError) throw todaysError;

    const todaysRevenue = todaysOrders?.reduce((sum, order) => sum + parseFloat(order.total_amount), 0) || 0;

    const dashboardData = {
        totalOrders: orders?.length || 0,
        totalProducts: products?.length || 0,
        lowStockItems: lowStock?.length || 0,
        todaysRevenue,
        recentOrders: orders?.slice(-5) || [],
        lowStockProducts: lowStock || []
    };

    logger.info('Dashboard data retrieved successfully', {
        userId: req.user?.id,
        dataPoints: Object.keys(dashboardData).length
    });

    res.json(dashboardData);
}));

// ============================================================================
// HELPER FUNCTIONS FOR WEIGHT MANAGEMENT
// ============================================================================

/**
 * Calculate weight in grams based on weight value and unit
 * This ensures consistent weight storage for Delhivery integration
 *
 * @param {number} weight - The weight value
 * @param {string} unit - The unit (kg, g, etc.)
 * @param {number} explicitWeightGrams - Optional explicit weight_grams value
 * @returns {number} Weight in grams
 */
function calculateWeightGrams(weight, unit, explicitWeightGrams = null) {
    // If explicit weight_grams provided, use it (for non-weight units like "pieces")
    if (explicitWeightGrams !== null && explicitWeightGrams !== undefined && explicitWeightGrams !== '') {
        const parsedExplicitWeight = Math.round(parseFloat(explicitWeightGrams) || 0);
        if (parsedExplicitWeight <= 0) {
            throw new Error('Shipping weight must be greater than 0 grams.');
        }

        return parsedExplicitWeight;
    }

    const weightValue = parseFloat(weight) || 0;
    const normalizedUnit = (unit || '').toLowerCase().trim();

    if (weightValue <= 0) {
        throw new Error('Shipping weight is required. Enter the pack weight or explicit grams.');
    }

    // Convert based on unit
    switch (normalizedUnit) {
        case 'kg':
        case 'kilograms':
        case 'kilogram':
            return Math.round(weightValue * 1000);

        case 'g':
        case 'grams':
        case 'gram':
            return Math.round(weightValue);

        case 'lb':
        case 'lbs':
        case 'pounds':
        case 'pound':
            // 1 pound = 453.592 grams
            return Math.round(weightValue * 453.592);

        case 'oz':
        case 'ounces':
        case 'ounce':
            // 1 ounce = 28.3495 grams
            return Math.round(weightValue * 28.3495);

        default:
            throw new Error(`Shipping weight in grams is required for unit "${unit || 'unknown'}".`);
    }
}

/**
 * Calculate variant weight in grams based on size_value and size_unit
 *
 * @param {number} sizeValue - The size value
 * @param {string} sizeUnit - The size unit (GRAMS, KILOGRAMS, PIECES, etc.)
 * @param {number} explicitWeightGrams - Optional explicit weight_grams value
 * @returns {number} Weight in grams
 */
function calculateVariantWeightGrams(sizeValue, sizeUnit, explicitWeightGrams = null) {
    // For weight-based units, auto-calculate from size
    const normalizedUnit = (sizeUnit || '').toUpperCase().trim();
    const value = parseFloat(sizeValue) || 0;

    if (value <= 0) {
        throw new Error('Variant size must be greater than 0.');
    }

    switch (normalizedUnit) {
        case 'GRAMS':
            return Math.round(value);

        case 'KILOGRAMS':
            return Math.round(value * 1000);

        case 'POUNDS':
            return Math.round(value * 453.592);

        case 'OUNCES':
            return Math.round(value * 28.3495);

        default:
            // For non-weight units (PIECES, LITERS, etc.), require explicit weight
            if (explicitWeightGrams !== null && explicitWeightGrams !== undefined && explicitWeightGrams !== '') {
                const parsedExplicitWeight = Math.round(parseFloat(explicitWeightGrams) || 0);
                if (parsedExplicitWeight <= 0) {
                    throw new Error('Variant shipping weight must be greater than 0 grams.');
                }

                return parsedExplicitWeight;
            }

            throw new Error(`Variant shipping weight in grams is required for ${sizeUnit || 'this unit'}.`);
    }
}

// ============================================================================
// Admin Product Management
// ============================================================================

app.post('/api/admin/products', authenticateAdmin, validateProduct, asyncHandler(async (req, res) => {
    const {
        name, description, price, image_url, category_id, stock_quantity, min_stock_level, sku, weight, unit,
        // New enhanced fields
        item_hsn, is_service, base_unit, secondary_unit, unit_conversion_value,
        sale_price_without_tax, discount_on_sale_price, discount_type, mrp,
        opening_quantity_at_price, opening_quantity_as_of_date, stock_location,
        wholesale_prices,
        weight_grams  // Optional explicit weight in grams
    } = req.body;

    const normalizedPrice = parseOptionalNumber(price, 0);
    const normalizedMrp = parseOptionalNumber(mrp, null);
    const effectiveDiscount = normalizedMrp
        ? computeDiscountPercent(normalizedMrp, normalizedPrice)
        : parseOptionalNumber(discount_on_sale_price, 0);

    if (normalizedMrp !== null && normalizedMrp < normalizedPrice) {
        return sendError(res, 'MRP must be greater than or equal to the selling price', 400, { field: 'mrp' });
    }

    let calculatedWeightGrams = 0;

    try {
        calculatedWeightGrams = is_service
            ? 0
            : calculateWeightGrams(weight, unit || 'kg', weight_grams);
    } catch (error) {
        return sendError(res, error.message, 400, { field: 'weight_grams' });
    }

    // Log weight calculation for debugging
    logger.info('Product weight calculated', {
        productName: name,
        inputWeight: weight,
        inputUnit: unit,
        explicitWeightGrams: weight_grams,
        calculatedWeightGrams
    });

    // Insert product with new fields
    const { data: product, error: productError } = await supabase
        .from('products')
        .insert([{
            name,
            description,
            price: normalizedPrice,
            image_url,
            category_id,
            stock_quantity,
            min_stock_level,
            sku,
            weight,
            unit: unit || 'kg',
            weight_grams: calculatedWeightGrams,  // Add calculated weight
            // New fields
            item_hsn,
            is_service: is_service || false,
            mrp: normalizedMrp,
            base_unit: base_unit || 'KILOGRAMS',
            secondary_unit: secondary_unit || 'GRAMS',
            unit_conversion_value,
            sale_price_without_tax: sale_price_without_tax || false,
            discount_on_sale_price: effectiveDiscount,
            discount_type: 'percentage',
            opening_quantity_at_price,
            opening_quantity_as_of_date,
            stock_location
        }])
        .select()
        .single();

    if (productError) throw productError;

    // Handle wholesale prices if provided
    if (wholesale_prices && Array.isArray(wholesale_prices) && wholesale_prices.length > 0) {
        const wholesalePriceData = wholesale_prices
            .filter(wp => wp.quantity && wp.price) // Only insert valid entries
            .map(wp => ({
                product_id: product.id,
                variant_id: wp.variant_id || null,
                quantity: parseFloat(wp.quantity),
                price: parseFloat(wp.price)
            }));

        if (wholesalePriceData.length > 0) {
            const { error: wholesaleError } = await supabase
                .from('wholesale_prices')
                .insert(wholesalePriceData);

            if (wholesaleError) {
                await supabase
                    .from('products')
                    .delete()
                    .eq('id', product.id);

                logger.error('Product create rolled back after wholesale price failure', {
                    userId: req.user?.id,
                    productId: product.id,
                    error: wholesaleError
                });
                throw new Error('Failed to save wholesale prices. Product creation was rolled back.');
            }
        }
    }

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'CREATE_PRODUCT',
        entity_type: 'product',
        entity_id: product.id,
        details: { product_name: name, is_service, wholesale_price_tiers: wholesale_prices?.length || 0 }
    }]);

    logger.info('Product created successfully', {
        userId: req.user?.id,
        productId: product.id,
        productName: name
    });

    res.status(201).json(product);
}));

app.put('/api/admin/products/:id', authenticateAdmin, validateProduct, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { wholesale_prices, ...productUpdates } = req.body;
    productUpdates.updated_at = new Date().toISOString();

    const needsCurrentProduct = (
        productUpdates.weight !== undefined ||
        productUpdates.unit !== undefined ||
        productUpdates.weight_grams !== undefined ||
        productUpdates.price !== undefined ||
        productUpdates.mrp !== undefined ||
        productUpdates.is_service !== undefined
    );
    let currentProduct = null;

    if (needsCurrentProduct) {
        const { data, error: fetchError } = await supabase
            .from('products')
            .select('price, mrp, weight, unit, weight_grams, is_service')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        currentProduct = data;
    }

    const finalIsService = productUpdates.is_service !== undefined
        ? productUpdates.is_service
        : currentProduct?.is_service;
    const finalPrice = productUpdates.price !== undefined
        ? parseOptionalNumber(productUpdates.price, 0)
        : parseOptionalNumber(currentProduct?.price, 0);
    const finalMrp = productUpdates.mrp !== undefined
        ? parseOptionalNumber(productUpdates.mrp, null)
        : parseOptionalNumber(currentProduct?.mrp, null);

    if (finalMrp !== null && finalMrp < finalPrice) {
        return sendError(res, 'MRP must be greater than or equal to the selling price', 400, { field: 'mrp' });
    }

    if (productUpdates.price !== undefined || productUpdates.mrp !== undefined) {
        productUpdates.discount_on_sale_price = finalMrp
            ? computeDiscountPercent(finalMrp, finalPrice)
            : 0;
        productUpdates.discount_type = 'percentage';
        productUpdates.mrp = finalMrp;
    }

    if (finalIsService) {
        productUpdates.weight_grams = 0;
    }

    // Recalculate weight_grams if weight or unit is being updated
    if (productUpdates.weight !== undefined || productUpdates.unit !== undefined || productUpdates.weight_grams !== undefined) {
        // Use updated values if provided, otherwise use current values
        const finalWeight = productUpdates.weight !== undefined ? productUpdates.weight : currentProduct.weight;
        const finalUnit = productUpdates.unit !== undefined ? productUpdates.unit : currentProduct.unit;
        const explicitWeightGrams = productUpdates.weight_grams;

        try {
            productUpdates.weight_grams = finalIsService
                ? 0
                : calculateWeightGrams(finalWeight, finalUnit, explicitWeightGrams);
        } catch (error) {
            return sendError(res, error.message, 400, { field: 'weight_grams' });
        }

        logger.info('Product weight recalculated on update', {
            productId: id,
            oldWeight: currentProduct.weight,
            oldUnit: currentProduct.unit,
            oldWeightGrams: currentProduct.weight_grams,
            newWeight: finalWeight,
            newUnit: finalUnit,
            newWeightGrams: productUpdates.weight_grams
        });
    }

    // Update product
    const { data: product, error: productError } = await supabase
        .from('products')
        .update(productUpdates)
        .eq('id', id)
        .select()
        .single();

    if (productError) throw productError;

    // Handle wholesale prices update if provided
    if (wholesale_prices !== undefined) {
        // Delete existing wholesale prices
        await supabase
            .from('wholesale_prices')
            .delete()
            .eq('product_id', id);

        // Insert new wholesale prices
        if (Array.isArray(wholesale_prices) && wholesale_prices.length > 0) {
            const wholesalePriceData = wholesale_prices
                .filter(wp => wp.quantity && wp.price) // Only insert valid entries
                .map(wp => ({
                    product_id: id,
                    variant_id: wp.variant_id || null,
                    quantity: parseFloat(wp.quantity),
                    price: parseFloat(wp.price)
                }));

            if (wholesalePriceData.length > 0) {
                const { error: wholesaleError } = await supabase
                    .from('wholesale_prices')
                    .insert(wholesalePriceData);

                if (wholesaleError) {
                    logger.error('Error updating wholesale prices', {
                        userId: req.user?.id,
                        productId: id,
                        error: wholesaleError
                    });
                    throw new Error('Failed to save wholesale prices');
                }
            }
        }
    }

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'UPDATE_PRODUCT',
        entity_type: 'product',
        entity_id: id,
        details: { ...productUpdates, wholesale_price_tiers_updated: wholesale_prices !== undefined }
    }]);

    logger.info('Product updated successfully', {
        userId: req.user?.id,
        productId: id
    });

    res.json(product);
}));

app.patch('/api/admin/products/:id/status', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    const { data: product, error } = await supabase
        .from('products')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    res.json(product);
}));

app.delete('/api/admin/products/:id', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Delete wholesale prices first (due to foreign key constraint)
    await supabase
        .from('wholesale_prices')
        .delete()
        .eq('product_id', id);

    // Delete the product
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) throw error;

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'DELETE_PRODUCT',
        entity_type: 'product',
        entity_id: id
    }]);

    logger.info('Product deleted successfully', {
        userId: req.user?.id,
        productId: id
    });

    res.json({ message: 'Product deleted successfully' });
}));

// Admin Order Management
app.get('/api/admin/orders', authenticateAdmin, asyncHandler(async (req, res) => {
    const { status } = req.query;
    const { page, limit, offset } = parsePageLimit(req.query, {
        defaultLimit: 20,
        minLimit: 1,
        maxLimit: 100
    });

    let query = supabase
        .from('orders')
        .select(`
            *,
            users (name, email),
            order_items (
                *,
                products (name, price),
                product_variants (variant_name, size_value, size_unit)
            )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (status) {
        if (status === 'completed' || status === 'delivered') {
            query = query.in('status', ['completed', 'delivered']);
        } else {
            query = query.eq('status', status);
        }
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const pagination = buildPagePagination({
        total: count || 0,
        page,
        limit
    });

    logger.info('Orders retrieved successfully', {
        userId: req.user?.id,
        status,
        page: pagination.page,
        limit: pagination.limit,
        resultCount: data?.length,
        totalCount: pagination.total
    });

    res.json({
        orders: data || [],
        pagination,
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: pagination.totalPages
    });
}));

// Check shipment readiness before creating shipment
app.get('/api/admin/orders/:id/shipment-readiness', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Fetch order with all details including variants
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (
                *,
                products (id, name, weight_grams),
                product_variants (id, variant_name, weight_grams)
            )
        `)
        .eq('id', id)
        .single();

    if (orderError) throw orderError;
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const issues = [];
    let totalWeight = 0;
    const itemDetails = [];

    // Check each order item for weight configuration
    for (const item of order.order_items || []) {
        let itemWeight = 0;
        let weightSource = 'missing';

        // Determine weight source (variant > product > default)
        if (item.variant_id && item.product_variants?.weight_grams) {
            itemWeight = item.product_variants.weight_grams;
            weightSource = 'variant';
        } else if (item.products?.weight_grams) {
            itemWeight = item.products.weight_grams;
            weightSource = 'product';
        }

        // Flag items with missing or default weight
        if (itemWeight === 0 || !itemWeight) {
            issues.push({
                type: 'MISSING_WEIGHT',
                product: item.products?.name || 'Unknown Product',
                variant: item.product_variants?.variant_name || null,
                message: 'Weight not configured',
                severity: 'error'
            });
        }

        const lineWeight = itemWeight * item.quantity;
        totalWeight += lineWeight;

        itemDetails.push({
            product: item.products?.name,
            variant: item.product_variants?.variant_name || null,
            quantity: item.quantity,
            unit_weight: itemWeight || 250,
            total_weight: lineWeight,
            weight_source: weightSource
        });
    }

    // Check shipping address
    if (!order.shipping_address?.pincode) {
        issues.push({
            type: 'MISSING_PINCODE',
            message: 'Shipping pincode is required',
            severity: 'error'
        });
    }

    if (!order.shipping_address?.address) {
        issues.push({
            type: 'MISSING_ADDRESS',
            message: 'Shipping address is required',
            severity: 'error'
        });
    }

    // Check customer phone
    if (!order.customer_phone) {
        issues.push({
            type: 'MISSING_PHONE',
            message: 'Customer phone is required',
            severity: 'error'
        });
    }

    // Determine overall readiness
    const errorIssues = issues.filter(i => i.severity === 'error');
    const ready = errorIssues.length === 0 && totalWeight > 0;

    logger.info('Shipment readiness check completed', {
        orderId: id,
        userId: req.user?.id,
        ready,
        totalWeight,
        issueCount: issues.length
    });

    res.json({
        ready,
        total_weight_grams: totalWeight,
        total_weight_kg: Math.ceil(totalWeight / 1000),
        issues,
        item_details: itemDetails,
        summary: {
            item_count: order.order_items?.length || 0,
            error_count: errorIssues.length,
            warning_count: issues.filter(i => i.severity === 'warning').length
        }
    });
}));

app.put('/api/admin/orders/:id/status', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const normalizedStatus = status === 'delivered' ? 'completed' : status;
    let fulfillment = null;

    if (!ORDER_STATUS_VALUES.has(normalizedStatus)) {
        return sendError(res, `Invalid order status "${status}"`, 400, { field: 'status' });
    }

    const { data, error } = await supabase
        .from('orders')
        .update({ status: normalizedStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'UPDATE_ORDER_STATUS',
        entity_type: 'order',
        entity_id: id,
        details: { new_status: normalizedStatus }
    }]);

    logger.info('Order status updated successfully', {
        userId: req.user?.id,
        orderId: id,
        newStatus: normalizedStatus
    });

    // Auto-create shipment and schedule pickup when order status changes to processing
    if (normalizedStatus === 'processing') {
        try {
            fulfillment = await deliveryService.processOrderForFulfillment(id);

            if (fulfillment.success) {
                logger.info('Order fulfillment automation completed', {
                    orderId: id,
                    shipmentCreated: fulfillment.shipment_created,
                    pickupScheduled: fulfillment.pickup_scheduled
                });
            } else {
                logger.warn('Order fulfillment automation completed with warnings', {
                    orderId: id,
                    shipmentError: fulfillment.shipment_error,
                    pickupError: fulfillment.pickup_error,
                    reason: fulfillment.reason
                });
            }
        } catch (fulfillmentError) {
            fulfillment = {
                success: false,
                order_id: id,
                shipment_error: fulfillmentError.message
            };
            logger.error('Order fulfillment automation failed unexpectedly', fulfillmentError, {
                orderId: id
            });
        }
    }

    res.json({
        ...data,
        fulfillment
    });
}));

// Cancel an order: restores stock, cancels Delhivery shipment if any
app.put('/api/admin/orders/:id/cancel', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [{ data: order, error: fetchError }, { data: shipment }] = await Promise.all([
        supabase
            .from('orders')
            .select(`*, order_items (product_id, variant_id, quantity)`)
            .eq('id', id)
            .single(),
        supabase
            .from('shipments')
            .select('id, awb_number, status')
            .eq('order_id', id)
            .single(),
    ]);

    if (fetchError || !order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'cancelled') return res.status(400).json({ error: 'Order already cancelled' });
    if (order.status === 'delivered' || order.status === 'completed') {
        return res.status(400).json({ error: 'Cannot cancel a delivered order' });
    }

    if (shipment && !['DELIVERED', 'CANCELLED'].includes(shipment.status)) {
        try {
            await deliveryService.cancelShipment(shipment.awb_number);
        } catch (deliveryErr) {
            // Log but don't block the cancellation
            logger.error('Delhivery shipment cancel failed during order cancel', deliveryErr, {
                orderId: id,
                awbNumber: shipment.awb_number
            });
        }
    }

    const restoreResults = await Promise.all(
        (order.order_items || []).map(item =>
            supabase.rpc('restore_stock', {
                p_product_id: item.product_id,
                p_quantity: item.quantity,
                p_variant_id: item.variant_id || null,
            }).then(r => ({ ...r, product_id: item.product_id }))
        )
    );
    for (const r of restoreResults) {
        if (r.error) {
            logger.error('Stock restore failed during order cancel', r.error, {
                orderId: id,
                productId: r.product_id,
            });
        }
    }

    const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (updateError) throw updateError;

    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'CANCEL_ORDER',
        entity_type: 'order',
        entity_id: id,
        details: { previous_status: order.status }
    }]);

    logger.info('Order cancelled', { orderId: id, userId: req.user.id, previousStatus: order.status });
    res.json(updated);
}));

// Cleanup abandoned PhonePe orders: orders that were created but never paid
// within the timeout window. Stock was reserved at order creation time; this
// restores it so the inventory doesn't silently shrink from abandoned carts.
app.post('/api/admin/cleanup-abandoned-orders', authenticateAdmin, asyncHandler(async (req, res) => {
    const TIMEOUT_MINUTES = 30;
    const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000).toISOString();

    const { data: abandonedOrders, error } = await supabase
        .from('orders')
        .select('id, order_items(product_id, variant_id, quantity)')
        .eq('status', 'pending')
        .eq('payment_status', 'PENDING')
        .lt('created_at', cutoff);

    if (error) throw error;

    let cleaned = 0;
    for (const order of (abandonedOrders || [])) {
        await orderRecoveryService.cancelUnpaidOrder(order.id, {
            paymentStatus: 'EXPIRED',
        });
        cleaned++;
    }

    logger.info('Abandoned order cleanup completed', { cleaned, cutoffMinutes: TIMEOUT_MINUTES });
    res.json({ cleaned, message: `Cleaned up ${cleaned} abandoned order(s)` });
}));

// Mark COD payment as collected
app.put('/api/admin/orders/:id/mark-cod-collected', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('payment_method, payment_status, status')
        .eq('id', id)
        .single();

    if (fetchError || !order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment_method !== 'COD') return res.status(400).json({ error: 'Not a COD order' });
    if (order.payment_status === 'PAID') return res.status(400).json({ error: 'Already marked as collected' });

    const { data, error } = await supabase
        .from('orders')
        .update({ payment_status: 'PAID', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'MARK_COD_COLLECTED',
        entity_type: 'order',
        entity_id: id
    }]);

    logger.info('COD payment marked as collected', { orderId: id, userId: req.user.id });
    res.json(data);
}));

// Admin Stock Management
// Accepts optional variant_id to adjust a specific variant's stock.
// For variant products the sync trigger keeps products.stock_quantity updated.
app.put('/api/admin/products/:id/stock', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { quantity, movement_type, reason, variant_id } = req.body;

    if (!quantity || isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'quantity must be a positive number' });
    }
    if (!['in', 'out', 'direct'].includes(movement_type)) {
        return res.status(400).json({ error: 'movement_type must be "in", "out", or "direct"' });
    }

    let currentStock, updatedRow;

    if (variant_id) {
        // Per-variant adjustment
        const { data: variant, error: variantError } = await supabase
            .from('product_variants')
            .select('stock_quantity')
            .eq('id', variant_id)
            .eq('product_id', id)
            .single();

        if (variantError || !variant) {
            return res.status(404).json({ error: 'Variant not found for this product' });
        }

        currentStock = variant.stock_quantity;
        let newStock;
        if (movement_type === 'in') {
            newStock = currentStock + quantity;
        } else if (movement_type === 'out') {
            newStock = currentStock - quantity;
        } else {
            newStock = quantity;
        }

        if (newStock < 0) {
            return res.status(400).json({
                error: `Cannot reduce stock below 0. Current: ${currentStock}, requested reduction: ${quantity}`,
            });
        }

        const { data, error } = await supabase
            .from('product_variants')
            .update({ stock_quantity: newStock })
            .eq('id', variant_id)
            .select()
            .single();

        if (error) throw error;
        // Sync trigger automatically updates products.stock_quantity
        updatedRow = data;
    } else {
        // Product-level adjustment (non-variant products)
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', id)
            .single();

        if (productError) throw productError;

        currentStock = product.stock_quantity;
        let newStock;
        if (movement_type === 'in') {
            newStock = currentStock + quantity;
        } else if (movement_type === 'out') {
            newStock = currentStock - quantity;
        } else {
            newStock = quantity;
        }

        if (newStock < 0) {
            return res.status(400).json({
                error: `Cannot reduce stock below 0. Current: ${currentStock}, requested reduction: ${quantity}`,
            });
        }

        const { data, error } = await supabase
            .from('products')
            .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        updatedRow = data;
    }

    // Record stock movement (with variant_id for the audit trail)
    await supabase.from('stock_movements').insert([{
        product_id: id,
        variant_id: variant_id || null,
        movement_type,
        quantity,
        reason,
        created_by: req.user.id
    }]);

    logger.info('Product stock updated successfully', {
        userId: req.user?.id,
        productId: id,
        variantId: variant_id || null,
        movementType: movement_type,
        quantity,
        reason
    });

    res.json(updatedRow);
}));

// Product Images Routes
// Get all images for a product
app.get('/api/products/:id/images', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', id)
        .order('sort_order', { ascending: true });
    
    if (error) throw error;
    
    logger.info('Product images retrieved successfully', {
        productId: id,
        imageCount: data?.length
    });
    
    res.json(data || []);
}));

// Upload image file for a product
app.post('/api/admin/products/:id/images/upload', authenticateAdmin, upload.single('image'), asyncHandler(async (req, res) => {
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
        let processedBuffer;
        let processedMimeType = req.file.mimetype;
        let processedFilename = req.file.originalname;

        const processingSettings = parseProcessingSettings(req.body.processing_settings);

        try {
            const imageProcessor = new ImageProcessingWrapper();

            // Process image using Sharp
            const processResult = await imageProcessor.processImage(
                req.file.path,
                processingSettings
            );
            
            if (processResult.success) {
                // Use processed buffer directly
                processedBuffer = processResult.processed_buffer;
                
                // Update MIME type based on processed format
                const processedFormat = processResult.processed.format.toLowerCase();
                processedMimeType = `image/${processedFormat === 'jpeg' ? 'jpeg' : processedFormat}`;
                
                // Update filename with processed extension
                const originalName = req.file.originalname.split('.')[0];
                const extension = processedFormat === 'jpeg' ? 'jpg' : processedFormat;
                processedFilename = `${originalName}.${extension}`;
                
                logger.info('Image processed successfully', {
                    userId: req.user?.id,
                    productId: id,
                    originalSize: processResult.original.file_size,
                    processedSize: processResult.processed.file_size,
                    compressionRatio: processResult.compression_ratio
                });
            } else {
                if (isFatalImageProcessingError(processResult.error)) {
                    return res.status(413).json({ error: processResult.error });
                }
                logger.warn('Image processing failed, using original', {
                    userId: req.user?.id,
                    productId: id,
                    error: processResult.error
                });
                processedBuffer = await readUploadedFile(req.file);
            }
        } catch (processingError) {
            if (isFatalImageProcessingError(processingError.message)) {
                return res.status(413).json({ error: processingError.message });
            }
            logger.warn('Image processing error, using original', {
                userId: req.user?.id,
                productId: id,
                error: processingError.message
            });
            processedBuffer = await readUploadedFile(req.file);
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
            logger.error('Failed to insert image into database', {
                userId: req.user?.id,
                productId: id,
                error
            });
            try {
                await storageService.deleteFile(uploadResult.url);
            } catch (deleteError) {
                logger.error('Failed to cleanup uploaded file', {
                    userId: req.user?.id,
                    productId: id,
                    error: deleteError
                });
            }
            throw error;
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
        
        logger.info('Product image uploaded successfully', {
            userId: req.user?.id,
            productId: id,
            imageId: data.id,
            filename: uploadResult.fileName
        });
        
        res.status(201).json(data);
    } finally {
        await cleanupUploadedTempFile(req.file);
    }
}));

// Add image by URL for a product (download, optional processing, host like file uploads)
app.post('/api/admin/products/:id/images/url', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { image_url, alt_text, is_primary, processing_settings } = req.body;

    if (!image_url) {
        return res.status(400).json({ error: 'Image URL is required' });
    }

    let fetchResult;
    try {
        fetchResult = await fetchImageFromUrl(image_url);
    } catch (fetchErr) {
        logger.warn('Product image URL fetch failed', {
            userId: req.user?.id,
            productId: id,
            message: fetchErr.message,
            code: fetchErr.code,
        });
        return res.status(400).json({ error: fetchErr.message || 'Could not download image from URL' });
    }

    const { buffer: remoteBuffer, contentType } = fetchResult;
    const processingSettings = parseProcessingSettings(processing_settings);

    let processedBuffer = remoteBuffer;
    let processedMimeType = contentType;
    const baseName = `url_${uuidv4()}`;
    let processedFilename = `${baseName}.${(contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`;

    try {
        const imageProcessor = new ImageProcessingWrapper();
        const processResult = await imageProcessor.processImage(remoteBuffer, processingSettings);
        if (processResult.success) {
            processedBuffer = processResult.processed_buffer;
            const processedFormat = processResult.processed.format.toLowerCase();
            processedMimeType = `image/${processedFormat === 'jpeg' ? 'jpeg' : processedFormat}`;
            const extension = processedFormat === 'jpeg' ? 'jpg' : processedFormat;
            processedFilename = `${baseName}.${extension}`;
        } else {
            logger.warn('Product URL image processing failed, using downloaded bytes', {
                userId: req.user?.id,
                productId: id,
                error: processResult.error,
            });
        }
    } catch (processingError) {
        logger.warn('Product URL image processing error, using downloaded bytes', {
            userId: req.user?.id,
            productId: id,
            error: processingError.message,
        });
    }

    const uploadResult = await storageService.uploadFile(
        processedBuffer,
        processedFilename,
        processedMimeType,
        {
            prefix: 'products',
            uploadedBy: req.user.id,
            metadata: {
                productId: id,
                altText: alt_text || '',
                sourceUrl: image_url,
            },
        }
    );

    if (!uploadResult.success) {
        throw new Error('Failed to upload file to cloud storage');
    }

    const { data: existingImages, error: sortError } = await supabase
        .from('product_images')
        .select('sort_order')
        .eq('product_id', id)
        .order('sort_order', { ascending: false })
        .limit(1);

    const nextSortOrder =
        existingImages && existingImages.length > 0 ? existingImages[0].sort_order + 1 : 0;

    if (is_primary) {
        await supabase.from('product_images').update({ is_primary: false }).eq('product_id', id);
    }

    const { data, error } = await supabase
        .from('product_images')
        .insert([
            {
                product_id: id,
                image_url: uploadResult.url,
                image_type: 'file',
                sort_order: nextSortOrder,
                alt_text: alt_text || '',
                is_primary: is_primary || false,
            },
        ])
        .select()
        .single();

    if (error || !data) {
        logger.error('Failed to insert URL-sourced product image', {
            userId: req.user?.id,
            productId: id,
            error,
        });
        try {
            await storageService.deleteFile(uploadResult.url);
        } catch (deleteError) {
            logger.error('Failed to cleanup uploaded file after DB error', {
                userId: req.user?.id,
                productId: id,
                error: deleteError,
            });
        }
        throw error || new Error('Failed to insert product image');
    }

    await supabase.from('admin_logs').insert([
        {
            admin_id: req.user.id,
            action: 'ADD_PRODUCT_IMAGE_URL',
            entity_type: 'product',
            entity_id: id,
            details: {
                image_id: data.id,
                image_url: uploadResult.url,
                source_url: image_url,
            },
        },
    ]);

    logger.info('Product image URL added successfully', {
        userId: req.user?.id,
        productId: id,
        imageId: data.id,
        imageUrl: uploadResult.url,
    });

    res.status(201).json(data);
}));

// Update image order for a product
app.put('/api/admin/products/:id/images/reorder', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { imageOrders } = req.body; // Array of { id, sort_order }
    
    if (!Array.isArray(imageOrders)) {
        return res.status(400).json({ error: 'imageOrders must be an array' });
    }
    
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
    
    if (error) throw error;
    
    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'REORDER_PRODUCT_IMAGES',
        entity_type: 'product',
        entity_id: id,
        details: { image_count: imageOrders.length }
    }]);
    
    logger.info('Product images reordered successfully', {
        userId: req.user?.id,
        productId: id,
        imageCount: imageOrders.length
    });
    
    res.json(data);
}));

// Delete a product image
app.delete('/api/admin/products/:productId/images/:imageId', authenticateAdmin, asyncHandler(async (req, res) => {
    const { productId, imageId } = req.params;
    
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
    
    if (error) throw error;
    
    // If it was a file upload, delete from cloud storage
    if (imageData.image_type === 'file') {
        try {
            await storageService.deleteFile(imageData.image_url);
        } catch (deleteError) {
            logger.warn('Failed to delete file from cloud storage', {
                userId: req.user?.id,
                productId,
                imageId,
                error: deleteError
            });
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
    
    logger.info('Product image deleted successfully', {
        userId: req.user?.id,
        productId,
        imageId
    });
    
    res.json({ message: 'Image deleted successfully' });
}));

// Set an image as primary
app.put('/api/admin/products/:productId/images/:imageId/primary', authenticateAdmin, asyncHandler(async (req, res) => {
    const { productId, imageId } = req.params;
    
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
    
    if (error) throw error;
    
    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'SET_PRIMARY_PRODUCT_IMAGE',
        entity_type: 'product',
        entity_id: productId,
        details: { image_id: imageId }
    }]);
    
    logger.info('Primary product image set successfully', {
        userId: req.user?.id,
        productId,
        imageId
    });
    
    res.json(data);
}));

// Categories Routes
app.get('/api/categories', asyncHandler(async (req, res) => {
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
    
    if (error) throw error;
    
    // Sort images by sort_order and mark primary image
    const categoriesWithImages = categories.map(category => ({
        ...category,
        category_images: category.category_images.sort((a, b) => a.sort_order - b.sort_order),
        primary_image: category.category_images.find(img => img.is_primary)?.image_url || category.category_images[0]?.image_url
    }));
    
    logger.info('Categories retrieved successfully', {
        categoryCount: categoriesWithImages?.length
    });
    
    res.json(categoriesWithImages);
}));

app.get('/api/admin/categories', authenticateAdmin, asyncHandler(async (req, res) => {
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
    
    if (error) throw error;
    
    const categoriesWithImages = categories.map(category => ({
        ...category,
        category_images: category.category_images.sort((a, b) => a.sort_order - b.sort_order),
        primary_image: category.category_images.find(img => img.is_primary)?.image_url || category.category_images[0]?.image_url
    }));
    
    logger.info('Admin categories retrieved successfully', {
        userId: req.user?.id,
        categoryCount: categoriesWithImages?.length
    });
    
    res.json(categoriesWithImages);
}));

app.get('/api/admin/categories/:id', authenticateAdmin, asyncHandler(async (req, res) => {
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
    
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Category not found' });
    
    data.category_images = data.category_images.sort((a, b) => a.sort_order - b.sort_order);
    data.primary_image = data.category_images.find(img => img.is_primary)?.image_url || data.category_images[0]?.image_url;
    
    logger.info('Admin category retrieved successfully', {
        userId: req.user?.id,
        categoryId: id
    });
    
    res.json(data);
}));

app.post('/api/admin/categories', authenticateAdmin, asyncHandler(async (req, res) => {
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

    if (error) throw error;

    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'CREATE_CATEGORY',
        entity_type: 'category',
        entity_id: data.id,
        details: { category_name: name, description, display_order }
    }]);

    logger.info('Category created successfully', {
        userId: req.user?.id,
        categoryId: data.id,
        categoryName: name
    });

    res.status(201).json(data);
}));

app.put('/api/admin/categories/:id', authenticateAdmin, asyncHandler(async (req, res) => {
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

    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Category not found' });

    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'UPDATE_CATEGORY',
        entity_type: 'category',
        entity_id: id,
        details: { updated_fields: Object.keys(updateData) }
    }]);

    logger.info('Category updated successfully', {
        userId: req.user?.id,
        categoryId: id
    });

    res.json(data);
}));

app.delete('/api/admin/categories/:id', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if category has products
    const { data: products, error: productError } = await supabase
        .from('products')
        .select('id')
        .eq('category_id', id)
        .limit(1);
        
    if (productError) throw productError;
    
    if (products && products.length > 0) {
        return res.status(400).json({ 
            error: 'Cannot delete category with existing products. Please move or delete products first.' 
        });
    }
    
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

    if (error) throw error;

    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'DELETE_CATEGORY',
        entity_type: 'category',
        entity_id: id,
        details: { deleted_at: new Date().toISOString() }
    }]);

    logger.info('Category deleted successfully', {
        userId: req.user?.id,
        categoryId: id
    });

    res.json({ message: 'Category deleted successfully' });
}));

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
        let processedBuffer;
        let processedMimeType = req.file.mimetype;
        let processedFilename = req.file.originalname;
        
        const processingSettings = parseProcessingSettings(req.body.processing_settings);

        try {
            const imageProcessor = new ImageProcessingWrapper();

            // Process category image using Sharp
            const processResult = await imageProcessor.processImage(
                req.file.path,
                processingSettings
            );
            
            if (processResult.success) {
                // Use processed buffer directly
                processedBuffer = processResult.processed_buffer;
                
                // Update MIME type based on processed format
                const processedFormat = processResult.processed.format.toLowerCase();
                processedMimeType = `image/${processedFormat === 'jpeg' ? 'jpeg' : processedFormat}`;
                
                // Update filename with processed extension
                const originalName = req.file.originalname.split('.')[0];
                const extension = processedFormat === 'jpeg' ? 'jpg' : processedFormat;
                processedFilename = `${originalName}.${extension}`;
                
                console.log(`Category image processed: ${processResult.original.file_size} -> ${processResult.processed.file_size} bytes (${processResult.compression_ratio}% reduction)`)
            } else {
                if (isFatalImageProcessingError(processResult.error)) {
                    return res.status(413).json({ error: processResult.error });
                }
                console.warn('Category image processing failed, using original:', processResult.error);
                processedBuffer = await readUploadedFile(req.file);
            }
        } catch (processingError) {
            if (isFatalImageProcessingError(processingError.message)) {
                return res.status(413).json({ error: processingError.message });
            }
            console.warn('Category image processing error, using original:', processingError.message);
            processedBuffer = await readUploadedFile(req.file);
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
    } finally {
        await cleanupUploadedTempFile(req.file);
    }
});

// Add category image by URL (download, optional processing, host like file uploads)
app.post('/api/admin/categories/:id/images/url', authenticateAdmin, async (req, res) => {
    const { id: category_id } = req.params;
    const { image_url, alt_text, is_primary, processing_settings } = req.body;

    if (!image_url) {
        return res.status(400).json({ error: 'Image URL is required' });
    }

    try {
        const { data: category, error: categoryError } = await supabase
            .from('categories')
            .select('id')
            .eq('id', category_id)
            .single();

        if (categoryError || !category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        let fetchResult;
        try {
            fetchResult = await fetchImageFromUrl(image_url);
        } catch (fetchErr) {
            console.warn('Category image URL fetch failed:', fetchErr.message);
            return res.status(400).json({ error: fetchErr.message || 'Could not download image from URL' });
        }

        const { buffer: remoteBuffer, contentType } = fetchResult;
        const processingSettings = parseProcessingSettings(processing_settings);

        let processedBuffer = remoteBuffer;
        let processedMimeType = contentType;
        const baseName = `url_${uuidv4()}`;
        let processedFilename = `${baseName}.${(contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`;

        try {
            const imageProcessor = new ImageProcessingWrapper();
            const processResult = await imageProcessor.processImage(remoteBuffer, processingSettings);
            if (processResult.success) {
                processedBuffer = processResult.processed_buffer;
                const processedFormat = processResult.processed.format.toLowerCase();
                processedMimeType = `image/${processedFormat === 'jpeg' ? 'jpeg' : processedFormat}`;
                const extension = processedFormat === 'jpeg' ? 'jpg' : processedFormat;
                processedFilename = `${baseName}.${extension}`;
            } else {
                console.warn('Category URL image processing failed, using downloaded bytes:', processResult.error);
            }
        } catch (processingError) {
            console.warn('Category URL image processing error, using downloaded bytes:', processingError.message);
        }

        const uploadResult = await storageService.uploadFile(
            processedBuffer,
            processedFilename,
            processedMimeType,
            {
                prefix: 'category_images',
                uploadedBy: req.user.id,
                metadata: {
                    categoryId: category_id,
                    altText: alt_text || '',
                    sourceUrl: image_url,
                },
            }
        );

        if (!uploadResult.success) {
            return res.status(500).json({ error: 'Failed to upload file to cloud storage' });
        }

        const { data: existingImages } = await supabase
            .from('category_images')
            .select('sort_order')
            .eq('category_id', category_id)
            .order('sort_order', { ascending: false })
            .limit(1);

        const next_sort_order =
            existingImages && existingImages.length > 0 ? existingImages[0].sort_order + 1 : 0;

        if (is_primary) {
            await supabase
                .from('category_images')
                .update({ is_primary: false })
                .eq('category_id', category_id);
        }

        const image_url_stored = uploadResult.url;

        const { data, error } = await supabase
            .from('category_images')
            .insert([
                {
                    category_id,
                    image_url: image_url_stored,
                    sort_order: next_sort_order,
                    alt_text: alt_text || '',
                    is_primary: is_primary || false,
                },
            ])
            .select()
            .single();

        if (error || !data) {
            try {
                await storageService.deleteFile(uploadResult.url);
            } catch (deleteError) {
                console.warn('Could not cleanup uploaded category image:', deleteError.message);
            }
            return res.status(500).json({ error: error?.message || 'Failed to save image record' });
        }

        await supabase.from('admin_logs').insert([
            {
                admin_id: req.user.id,
                action: 'ADD_CATEGORY_IMAGE_URL',
                entity_type: 'category_image',
                entity_id: data.id,
                details: { category_id, image_url: image_url_stored, source_url: image_url, alt_text },
            },
        ]);

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
app.get('/api/products', asyncHandler(async (req, res) => {
    const normalizedSearch = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    let productsQuery = supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

    if (normalizedSearch) {
        productsQuery = productsQuery.or(
            `name.ilike.%${normalizedSearch}%,description.ilike.%${normalizedSearch}%,sku.ilike.%${normalizedSearch}%,item_hsn.ilike.%${normalizedSearch}%`
        );
    }

    const { data: products, error: productsError } = await productsQuery;

    if (productsError) throw productsError;
    if (!products || products.length === 0) {
        logger.info('Products retrieved successfully', {
            productCount: 0,
            variantCount: 0,
            search: normalizedSearch
        });
        return res.json([]);
    }

    const productIds = products.map((product) => product.id);

    // Fetch variants and wholesale prices in parallel for efficiency
    const [variantsResult, wholesalePricesResult] = await Promise.all([
        supabase
            .from('product_variants')
            .select('*')
            .eq('is_active', true)
            .in('product_id', productIds)
            .order('product_id')
            .order('display_order', { ascending: true }),
        supabase
            .from('wholesale_prices')
            .select('*')
            .in('product_id', productIds)
            .order('quantity', { ascending: true })
    ]);

    const { data: variants, error: variantsError } = variantsResult;
    const { data: wholesalePrices, error: wholesaleError } = wholesalePricesResult;

    if (variantsError) throw variantsError;
    if (wholesaleError) throw wholesaleError;

    // Group variants by product_id
    const variantsByProduct = {};
    variants?.forEach(variant => {
        if (!variantsByProduct[variant.product_id]) {
            variantsByProduct[variant.product_id] = [];
        }
        variantsByProduct[variant.product_id].push(variant);
    });

    // Group wholesale prices by product_id
    const wholesalePricesByProduct = {};
    wholesalePrices?.forEach(wp => {
        if (!wholesalePricesByProduct[wp.product_id]) {
            wholesalePricesByProduct[wp.product_id] = [];
        }
        wholesalePricesByProduct[wp.product_id].push(wp);
    });

    // Attach variants, wholesale prices, and storefront pricing metadata
    const productsWithData = products.map((product) => enrichProductPricing({
        ...product,
        wholesale_prices: wholesalePricesByProduct[product.id] || []
    }, variantsByProduct[product.id] || []));

    logger.info('Products retrieved successfully', {
        productCount: productsWithData?.length,
        variantCount: variants?.length || 0,
        search: normalizedSearch
    });

    res.json(productsWithData);
}));

app.get('/api/products/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

    if (productError) throw productError;
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Fetch variants and wholesale prices in parallel for efficiency
    const [variantsResult, wholesalePricesResult] = await Promise.all([
        supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', id)
            .eq('is_active', true)
            .order('display_order', { ascending: true }),
        supabase
            .from('wholesale_prices')
            .select('*')
            .eq('product_id', id)
            .order('quantity', { ascending: true })
    ]);

    const { data: variants, error: variantsError } = variantsResult;
    const { data: wholesalePrices, error: wholesaleError } = wholesalePricesResult;

    if (variantsError) throw variantsError;
    if (wholesaleError) throw wholesaleError;

    const productWithData = enrichProductPricing({
        ...product,
        wholesale_prices: wholesalePrices || []
    }, variants || []);

    logger.info('Product retrieved successfully', {
        productId: id,
        variantCount: variants?.length || 0
    });

    res.json(productWithData);
}));

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
        .eq('category_id', categoryData.id)
        .eq('is_active', true);
    
    if (productsError) return res.status(500).json({ error: productsError.message });

    const [variantsResult, wholesalePricesResult] = await Promise.all([
        supabase
            .from('product_variants')
            .select('*')
            .eq('is_active', true)
            .order('product_id')
            .order('display_order', { ascending: true }),
        supabase
            .from('wholesale_prices')
            .select('*')
            .order('quantity', { ascending: true })
    ]);

    if (variantsResult.error) return res.status(500).json({ error: variantsResult.error.message });
    if (wholesalePricesResult.error) return res.status(500).json({ error: wholesalePricesResult.error.message });

    const variantsByProduct = {};
    (variantsResult.data || []).forEach((variant) => {
        if (!variantsByProduct[variant.product_id]) {
            variantsByProduct[variant.product_id] = [];
        }
        variantsByProduct[variant.product_id].push(variant);
    });

    const wholesalePricesByProduct = {};
    (wholesalePricesResult.data || []).forEach((tier) => {
        if (!wholesalePricesByProduct[tier.product_id]) {
            wholesalePricesByProduct[tier.product_id] = [];
        }
        wholesalePricesByProduct[tier.product_id].push(tier);
    });

    res.json(productsData.map((product) => enrichProductPricing({
        ...product,
        wholesale_prices: wholesalePricesByProduct[product.id] || []
    }, variantsByProduct[product.id] || [])));
});

// Admin Products Routes
app.get('/api/admin/products', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_PRODUCTS), async (req, res) => {
    try {
        const [productsResult, variantsResult, wholesaleResult] = await Promise.all([
            supabase
                .from('products')
                .select(`*, category:category_id(id, name)`)
                .order('name'),
            supabase
                .from('product_variants')
                .select('id, product_id, variant_name, size_value, size_unit, price, mrp, discount_percent, stock_quantity, sku, is_active, is_default, display_order, weight_grams')
                .order('display_order', { ascending: true }),
            supabase
                .from('wholesale_prices')
                .select('*')
                .order('quantity', { ascending: true }),
        ]);

        if (productsResult.error) throw productsResult.error;
        if (variantsResult.error) throw variantsResult.error;
        if (wholesaleResult.error) throw wholesaleResult.error;

        // Group variants by product for O(1) lookup
        const variantsByProduct = {};
        (variantsResult.data || []).forEach(v => {
            if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
            variantsByProduct[v.product_id].push(v);
        });

        const wholesaleByProduct = {};
        (wholesaleResult.data || []).forEach((tier) => {
            if (!wholesaleByProduct[tier.product_id]) {
                wholesaleByProduct[tier.product_id] = [];
            }
            wholesaleByProduct[tier.product_id].push(tier);
        });

        const enhancedProducts = productsResult.data.map((product) => enrichProductPricing({
            ...product,
            category_name: product.category?.name || null,
            wholesale_prices: wholesaleByProduct[product.id] || []
        }, variantsByProduct[product.id] || []));

        res.json({ products: enhancedProducts });
    } catch (error) {
        console.error('Error fetching admin products:', error);
        res.status(500).json({ error: error.message });
    }
});

// Product Variants Routes
app.get('/api/admin/products/:id/variants', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', id)
        .order('display_order', { ascending: true });

    if (error) throw error;

    logger.info('Product variants retrieved', {
        userId: req.user?.id,
        productId: id,
        variantCount: data?.length || 0
    });

    res.json(data || []);
}));

app.post('/api/admin/products/:id/variants', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { variants } = req.body;

    if (!Array.isArray(variants)) {
        return res.status(400).json({ error: 'Variants must be an array' });
    }

    const normalizedVariants = variants.map((variant, index) => ({
        ...variant,
        is_default: variant.is_default === true,
        is_active: variant.is_active !== undefined ? variant.is_active : true,
        display_order: variant.display_order !== undefined ? variant.display_order : index
    }));

    if (normalizedVariants.length > 0) {
        const defaultVariantIndices = normalizedVariants
            .map((variant, index) => (variant.is_default ? index : -1))
            .filter((index) => index >= 0);

        if (defaultVariantIndices.length === 0) {
            normalizedVariants[0].is_default = true;
        } else if (defaultVariantIndices.length > 1) {
            const preservedDefaultIndex = defaultVariantIndices[0];
            normalizedVariants.forEach((variant, index) => {
                variant.is_default = index === preservedDefaultIndex;
            });
        }
    }

    const { data: existingVariants, error: existingVariantsError } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', id);

    if (existingVariantsError) throw existingVariantsError;

    let variantPlan;
    try {
        variantPlan = buildVariantMutationPlan(existingVariants || [], normalizedVariants);
    } catch (error) {
        return sendError(res, error.message, 400, { field: 'variants' });
    }

    const buildPersistedVariantRecord = (variant, index) => {
        const normalizedPrice = parseOptionalNumber(variant.price, 0);
        const normalizedMrp = parseOptionalNumber(variant.mrp, null);

        if (normalizedPrice <= 0) {
            throw new Error(`Variant ${index + 1} price must be greater than 0.`);
        }

        if (normalizedMrp !== null && normalizedMrp < normalizedPrice) {
            throw new Error(`Variant ${index + 1} MRP must be greater than or equal to its selling price.`);
        }

        const weightGrams = calculateVariantWeightGrams(
            variant.size_value,
            variant.size_unit,
            variant.weight_grams
        );
        const discountPercent = normalizedMrp
            ? computeDiscountPercent(normalizedMrp, normalizedPrice)
            : 0;

        logger.info('Variant weight calculated', {
            productId: id,
            variantName: variant.variant_name,
            sizeValue: variant.size_value,
            sizeUnit: variant.size_unit,
            explicitWeightGrams: variant.weight_grams,
            calculatedWeightGrams: weightGrams
        });

        return {
            product_id: id,
            variant_name: variant.variant_name,
            size_value: Number.parseFloat(variant.size_value),
            size_unit: variant.size_unit,
            price: normalizedPrice,
            mrp: normalizedMrp,
            discount_percent: discountPercent,
            stock_quantity: Number.parseInt(variant.stock_quantity, 10) || 0,
            sku: variant.sku || null,
            is_active: variant.is_active,
            is_default: variant.is_default,
            display_order: variant.display_order,
            weight_grams: weightGrams
        };
    };

    const timestamp = new Date().toISOString();
    let updatesToApply;
    let insertsToApply;

    try {
        updatesToApply = variantPlan.updates.map((variant, index) => ({
            id: variant.id,
            ...buildPersistedVariantRecord(variant, index)
        }));
        insertsToApply = variantPlan.inserts.map((variant, index) => (
            buildPersistedVariantRecord(variant, variantPlan.updates.length + index)
        ));
    } catch (error) {
        return sendError(res, error.message, 400, { field: 'variants' });
    }

    for (const variantUpdate of updatesToApply) {
        const { id: variantId, ...updatePayload } = variantUpdate;
        const { error: updateError } = await supabase
            .from('product_variants')
            .update({
                ...updatePayload,
                updated_at: timestamp
            })
            .eq('id', variantId)
            .eq('product_id', id);

        if (updateError) throw updateError;
    }

    if (variantPlan.deleteIds.length > 0) {
        const { error: deleteError } = await supabase
            .from('product_variants')
            .delete()
            .in('id', variantPlan.deleteIds)
            .eq('product_id', id);

        if (deleteError) throw deleteError;
    }

    if (insertsToApply.length > 0) {
        const { error: insertError } = await supabase
            .from('product_variants')
            .insert(insertsToApply);

        if (insertError) throw insertError;
    }

    const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', id)
        .order('display_order', { ascending: true });

    if (error) throw error;

    const defaultVariant = selectDefaultVariant((data || []).map(normalizeVariantPricing));

    if (defaultVariant) {
        const { error: productSyncError } = await supabase
            .from('products')
            .update({
                price: defaultVariant.price,
                mrp: defaultVariant.mrp,
                discount_on_sale_price: defaultVariant.discount_percent || 0,
                discount_type: 'percentage',
                updated_at: timestamp
            })
            .eq('id', id);

        if (productSyncError) throw productSyncError;
    }

    if (normalizedVariants.length > 0) {
        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'UPDATE_PRODUCT_VARIANTS',
            entity_type: 'product',
            entity_id: id,
            details: {
                variant_count: data?.length || 0,
                updated_variant_count: updatesToApply.length,
                inserted_variant_count: insertsToApply.length,
                deleted_variant_count: variantPlan.deleteIds.length
            }
        }]);

        logger.info('Product variants updated', {
            userId: req.user?.id,
            productId: id,
            variantCount: data?.length || 0,
            updatedVariantCount: updatesToApply.length,
            insertedVariantCount: insertsToApply.length,
            deletedVariantCount: variantPlan.deleteIds.length
        });

        return res.json(data || []);
    }

    if (variantPlan.deleteIds.length > 0) {
        await supabase.from('admin_logs').insert([{
            admin_id: req.user.id,
            action: 'UPDATE_PRODUCT_VARIANTS',
            entity_type: 'product',
            entity_id: id,
            details: {
                variant_count: 0,
                updated_variant_count: 0,
                inserted_variant_count: 0,
                deleted_variant_count: variantPlan.deleteIds.length
            }
        }]);

        logger.info('Product variants cleared', {
            userId: req.user?.id,
            productId: id,
            deletedVariantCount: variantPlan.deleteIds.length
        });
    }

    res.json(data || []);
}));

app.put('/api/admin/products/:productId/variants/:variantId', authenticateAdmin, asyncHandler(async (req, res) => {
    const { productId, variantId } = req.params;
    const variantUpdates = req.body;

    // Ensure we're only updating fields that should be updateable
    const allowedFields = ['variant_name', 'size_value', 'size_unit', 'price', 'mrp', 'stock_quantity', 'sku', 'is_active', 'is_default', 'display_order', 'weight_grams'];
    const updates = {};
    allowedFields.forEach(field => {
        if (variantUpdates[field] !== undefined) {
            updates[field] = variantUpdates[field];
        }
    });
    if (updates.stock_quantity !== undefined) {
        updates.stock_quantity = parseInt(updates.stock_quantity) || 0;
    }

    const { data: currentVariant, error: fetchError } = await supabase
        .from('product_variants')
        .select('size_value, size_unit, weight_grams, price, mrp, is_default')
        .eq('id', variantId)
        .single();

    if (fetchError) throw fetchError;

    const finalPrice = updates.price !== undefined
        ? parseOptionalNumber(updates.price, 0)
        : parseOptionalNumber(currentVariant.price, 0);
    const finalMrp = updates.mrp !== undefined
        ? parseOptionalNumber(updates.mrp, null)
        : parseOptionalNumber(currentVariant.mrp, null);

    if (finalPrice <= 0) {
        return sendError(res, 'Variant price must be greater than 0', 400, { field: 'price' });
    }

    if (finalMrp !== null && finalMrp < finalPrice) {
        return sendError(res, 'Variant MRP must be greater than or equal to the selling price', 400, { field: 'mrp' });
    }

    if (updates.size_value !== undefined || updates.size_unit !== undefined || updates.weight_grams !== undefined) {
        const finalSizeValue = updates.size_value !== undefined ? updates.size_value : currentVariant.size_value;
        const finalSizeUnit = updates.size_unit !== undefined ? updates.size_unit : currentVariant.size_unit;
        const explicitWeightGrams = updates.weight_grams;

        try {
            updates.weight_grams = calculateVariantWeightGrams(finalSizeValue, finalSizeUnit, explicitWeightGrams);
        } catch (error) {
            return sendError(res, error.message, 400, { field: 'weight_grams' });
        }

        logger.info('Variant weight recalculated on update', {
            productId,
            variantId,
            oldSizeValue: currentVariant.size_value,
            oldSizeUnit: currentVariant.size_unit,
            oldWeightGrams: currentVariant.weight_grams,
            newSizeValue: finalSizeValue,
            newSizeUnit: finalSizeUnit,
            newWeightGrams: updates.weight_grams
        });
    }

    updates.price = finalPrice;
    updates.mrp = finalMrp;
    updates.discount_percent = finalMrp
        ? computeDiscountPercent(finalMrp, finalPrice)
        : 0;

    if (updates.is_default === true) {
        await supabase
            .from('product_variants')
            .update({ is_default: false })
            .eq('product_id', productId)
            .neq('id', variantId);
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('product_variants')
        .update(updates)
        .eq('id', variantId)
        .eq('product_id', productId)
        .select()
        .single();

    if (error) throw error;

    if (data.is_default || currentVariant.is_default || updates.is_default === true) {
        const { error: productSyncError } = await supabase
            .from('products')
            .update({
                price: data.price,
                mrp: data.mrp,
                discount_on_sale_price: data.discount_percent || 0,
                discount_type: 'percentage',
                updated_at: new Date().toISOString()
            })
            .eq('id', productId);

        if (productSyncError) throw productSyncError;
    }

    logger.info('Product variant updated', {
        userId: req.user?.id,
        productId,
        variantId
    });

    res.json(data);
}));

app.delete('/api/admin/products/:productId/variants/:variantId', authenticateAdmin, asyncHandler(async (req, res) => {
    const { productId, variantId } = req.params;

    const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId)
        .eq('product_id', productId);

    if (error) throw error;

    logger.info('Product variant deleted', {
        userId: req.user?.id,
        productId,
        variantId
    });

    res.json({ message: 'Variant deleted successfully' });
}));

// Wholesale Prices Routes
app.get('/api/admin/products/:id/wholesale-prices', authenticateAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('wholesale_prices')
            .select('*')
            .eq('product_id', id)
            .order('quantity', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching wholesale prices:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/products/:id/wholesale-prices', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { wholesale_prices } = req.body;
    
    try {
        // Delete existing wholesale prices
        await supabase
            .from('wholesale_prices')
            .delete()
            .eq('product_id', id);

        // Insert new wholesale prices
        if (Array.isArray(wholesale_prices) && wholesale_prices.length > 0) {
            const wholesalePriceData = wholesale_prices
                .filter(wp => wp.quantity && wp.price)
                .map(wp => ({
                    product_id: id,
                    variant_id: wp.variant_id || null,
                    quantity: parseFloat(wp.quantity),
                    price: parseFloat(wp.price)
                }));

            if (wholesalePriceData.length > 0) {
                const { data, error } = await supabase
                    .from('wholesale_prices')
                    .insert(wholesalePriceData)
                    .select();

                if (error) return res.status(500).json({ error: error.message });
                
                // Log admin action
                await supabase.from('admin_logs').insert([{
                    admin_id: req.user.id,
                    action: 'UPDATE_WHOLESALE_PRICES',
                    entity_type: 'product',
                    entity_id: id,
                    details: { wholesale_price_count: wholesalePriceData.length }
                }]);

                return res.json(data);
            }
        }

        res.json([]);
    } catch (error) {
        console.error('Error updating wholesale prices:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/logs', roleMiddleware.requireAdminRole, asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePageLimit(req.query, {
        defaultLimit: 25,
        minLimit: 1,
        maxLimit: 100
    });

    const { data, error, count } = await supabase
        .from('admin_logs')
        .select('*, admin:admin_id(id, email, name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw error;

    const pagination = buildPagePagination({
        total: count || 0,
        page,
        limit
    });

    res.json({
        logs: data || [],
        pagination,
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: pagination.totalPages
    });
}));

// Admin user creation route
app.post('/api/admin/create-admin', roleMiddleware.requireAdminRole, asyncHandler(async (req, res) => {
    const { user_id, email, name } = req.body;
    
    // Check if user already exists in users table
    const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user_id)
        .maybeSingle();

    if (checkError) throw checkError;

    if (existingUser) {
        // Update existing user to be admin
        const { data, error } = await supabase
            .from('users')
            .update({ role: 'admin' })
            .eq('id', user_id)
            .select()
            .single();

        if (error) {
            logger.warn('Failed to update user to admin', error, {
                userId: user_id,
                email,
                adminCreator: req.user?.id,
                ip: req.ip
            });
            throw error;
        }
        
        logger.info('User updated to admin successfully', {
            userId: user_id,
            email,
            adminCreator: req.user?.id
        });
        
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
                role: 'admin'
            }])
            .select()
            .single();

        if (error) {
            logger.error('Failed to create admin user', error, {
                userId: user_id,
                email,
                adminCreator: req.user?.id,
                ip: req.ip
            });
            throw error;
        }
        
        logger.info('Admin user created successfully', {
            userId: user_id,
            email,
            adminCreator: req.user?.id
        });
        
        return res.status(201).json({ message: 'Admin user created', user: data });
    }
}));

// User Authentication Routes
app.post('/api/auth/signup', asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({
            success: false,
            error: 'Name, email, and password are required',
            code: 'missing_fields'
        });
    }

    if (!isStrongPassword(password)) {
        return res.status(400).json({
            success: false,
            error: PASSWORD_POLICY_MESSAGE,
            code: 'weak_password'
        });
    }
    
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { name: name },
            emailRedirectTo: buildFrontendAuthUrl()
        },
    });
    
    if (error) {
        logger.warn('User signup failed', error, {
            email,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        const mappedFailure = mapAuthFailure(error, 'Signup failed');
        return res.status(mappedFailure.status).json(mappedFailure.body);
    }
    
    // Check if user needs email confirmation
    if (data.user && !data.session) {
        logger.info('User signup successful - email confirmation required', {
            userId: data.user.id,
            email
        });
        return res.status(201).json({ 
            message: 'Please check your email to confirm your account',
            user: data.user,
            email,
            confirmationRequired: true 
        });
    }

    // If user is created successfully, also create record in users table
    if (data.user) {
        // New users are always created as customers - admins must be set explicitly via admin endpoint
        try {
            await supabase
                .from('users')
                .insert([{
                    id: data.user.id,
                    name: name,
                    email: email,
                    password: 'managed_by_supabase_auth', // Dummy password since we use Supabase Auth
                    role: 'customer'
                }]);
        } catch (insertError) {
            logger.warn('User record creation failed (user might already exist)', insertError, {
                userId: data.user.id,
                email
            });
        }
        
        logger.info('User signup completed successfully', {
            userId: data.user.id,
            email,
            role: 'customer'
        });
    }
    
    res.status(201).json(data);
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email and password are required',
            code: 'missing_fields'
        });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        logger.warn('User login failed', error, {
            email,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
        const mappedFailure = mapAuthFailure(error);
        return res.status(mappedFailure.status).json({
            ...mappedFailure.body,
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            method: req.method,
            requestId: req.requestId
        });
    }

    logger.info('User login successful', {
        userId: data.user?.id,
        email,
        ip: req.ip,
        sessionId: data.session?.access_token?.substring(0, 20) + '...'
    });

    res.json(data);
}));

app.post('/api/auth/forgot-password', asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            success: false,
            error: 'Email is required',
            code: 'missing_email'
        });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: buildFrontendAuthUrl({ mode: 'reset-password' })
    });

    if (error) {
        logger.warn('Forgot password request failed', error, {
            email,
            ip: req.ip
        });

        const mappedFailure = mapAuthFailure(error, 'Unable to send password reset email');
        return res.status(mappedFailure.status).json(mappedFailure.body);
    }

    logger.info('Forgot password email requested', {
        email,
        ip: req.ip
    });

    res.json({
        success: true,
        email,
        message: 'If an account exists for this email, a password reset link has been sent.'
    });
}));

app.post('/api/auth/resend-confirmation', asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            success: false,
            error: 'Email is required',
            code: 'missing_email'
        });
    }

    const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
            emailRedirectTo: buildFrontendAuthUrl()
        }
    });

    if (error) {
        logger.warn('Resend confirmation failed', error, {
            email,
            ip: req.ip
        });

        const mappedFailure = mapAuthFailure(error, 'Unable to resend confirmation email');
        return res.status(mappedFailure.status).json(mappedFailure.body);
    }

    logger.info('Confirmation email resent', {
        email,
        ip: req.ip
    });

    res.json({
        success: true,
        email,
        message: 'Confirmation email sent. Please check your inbox.'
    });
}));

app.post('/api/auth/session-from-link', asyncHandler(async (req, res) => {
    const { code, token_hash: tokenHash, type } = req.body || {};
    const authClient = createServerAuthClient();

    if (!code && !tokenHash) {
        return res.status(400).json({
            success: false,
            error: 'A code or token hash is required',
            code: 'missing_link_token'
        });
    }

    let result;

    if (code) {
        result = await authClient.auth.exchangeCodeForSession(code);
    } else {
        result = await authClient.auth.verifyOtp({
            token_hash: tokenHash,
            type: type || 'recovery'
        });
    }

    const { data, error } = result;

    if (error) {
        logger.warn('Auth link exchange failed', error, {
            codePresent: Boolean(code),
            tokenHashPresent: Boolean(tokenHash),
            type,
            ip: req.ip
        });

        const mappedFailure = mapAuthFailure(error, 'Unable to verify authentication link');
        return res.status(mappedFailure.status).json(mappedFailure.body);
    }

    logger.info('Auth link exchange successful', {
        userId: data.user?.id,
        type: type || (code ? 'pkce' : 'recovery'),
        ip: req.ip
    });

    res.json(data);
}));

app.post('/api/auth/update-password', authenticateScopedAuthToken, asyncHandler(async (req, res) => {
    const { password, refresh_token: refreshToken } = req.body;
    const accessToken = req.headers.authorization?.replace('Bearer ', '') || req.body?.access_token || '';

    if (!password) {
        return res.status(400).json({
            success: false,
            error: 'Password is required',
            code: 'missing_password'
        });
    }

    if (!isStrongPassword(password)) {
        return res.status(400).json({
            success: false,
            error: PASSWORD_POLICY_MESSAGE,
            code: 'weak_password'
        });
    }

    let updatedUser = null;
    let error = null;

    if (refreshToken) {
        const sessionClient = createServerAuthClient();
        const { data: sessionData, error: sessionError } = await sessionClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        if (sessionError || !sessionData?.session) {
            logger.warn('Password update session setup failed', sessionError, {
                userId: req.user?.id,
                ip: req.ip
            });

            const mappedFailure = mapAuthFailure(sessionError, 'Unable to verify your password reset session');
            return res.status(mappedFailure.status).json(mappedFailure.body);
        }

        const { data, error: updateError } = await sessionClient.auth.updateUser({
            password
        });

        updatedUser = data?.user || null;
        error = updateError;
    } else if (supabaseAdmin) {
        const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
            password
        });

        updatedUser = data?.user || null;
        error = updateError;
    } else {
        return res.status(400).json({
            success: false,
            error: 'Refresh token is required to update password in this environment',
            code: 'missing_refresh_token'
        });
    }

    if (error) {
        logger.warn(error);
        logger.warn('Password update failed', error, {
            userId: req.user?.id,
            ip: req.ip
        });

        const mappedFailure = mapAuthFailure(error, 'Unable to update password');
        return res.status(mappedFailure.status).json(mappedFailure.body);
    }

    logger.info('Password updated successfully', {
        userId: req.user?.id,
        ip: req.ip
    });

    res.json({
        success: true,
        user: updatedUser,
        message: 'Password updated successfully'
    });
}));

// Token validation route
app.get('/api/auth/validate', authenticateToken, asyncHandler(async (req, res) => {
    // If we reach here, the token is valid (authenticateToken middleware passed)
    logger.info('Token validation successful', {
        userId: req.user?.id,
        email: req.user?.email
    });
    
    res.json({ 
        valid: true, 
        user: req.user,
        message: 'Token is valid' 
    });
}));

// Get user profile with role information
app.get('/api/auth/profile', roleMiddleware.authenticateToken, asyncHandler(async (req, res) => {
    // Get user role from database
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, created_at')
        .eq('id', req.user.id)
        .single();

    if (userError || !userData) {
        // If user doesn't exist in users table, create a default customer entry
        const defaultUser = {
            id: req.user.id,
            name: req.user.user_metadata?.name || req.user.email.split('@')[0],
            email: req.user.email,
            role: 'customer'
        };

        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{
                id: req.user.id,
                name: defaultUser.name,
                email: defaultUser.email,
                password: 'managed_by_supabase_auth',
                role: defaultUser.role
            }])
            .select()
            .single();

        if (createError) {
            logger.error('Failed to create user profile', createError, {
                userId: req.user.id,
                email: req.user.email
            });
            throw createError;
        }

        logger.info('User profile created on first access', {
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role
        });

        return res.json({
            user: req.user,
            profile: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                created_at: newUser.created_at
            }
        });
    }

    logger.info('User profile retrieved', {
        userId: userData.id,
        role: userData.role
    });

    res.json({
        user: req.user,
        profile: userData
    });
}));

// Token refresh route
app.post('/api/auth/refresh', asyncHandler(async (req, res) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
        logger.warn('Token refresh attempted without refresh token', {
            ip: req.ip
        });
        return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refresh_token
    });
    
    if (error) {
        logger.warn('Token refresh failed', error, {
            ip: req.ip,
            refreshTokenPrefix: refresh_token.substring(0, 20) + '...'
        });
        throw error;
    }
    
    logger.info('Token refresh successful', {
        userId: data.user?.id,
        ip: req.ip
    });
    
    res.json(data);
}));

// Order Routes (protected by authentication middleware)
app.post('/api/orders', authenticateToken, asyncHandler(async (req, res) => {
    const {
        items,
        payment_method,
        payment_status,
        customer_phone,
        customer_email,
        shipping_address,
        delivery_mode
    } = req.body;
    const { user } = req;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    if (!shipping_address || typeof shipping_address !== 'object') {
        return res.status(400).json({ error: 'Shipping address is required' });
    }

    if (!/^\d{6}$/.test(String(shipping_address.pincode || '').trim())) {
        return res.status(400).json({ error: 'A valid 6-digit delivery pincode is required' });
    }

    if (!String(shipping_address.address || '').trim()) {
        return res.status(400).json({ error: 'Shipping address is required' });
    }

    // Validate that all product_id / variant_id values are proper UUIDs.
    // Cart items for variant products use a composite string id on the frontend;
    // Checkout.jsx always sets originalId so product_id should be a plain UUID.
    // If originalId was somehow missing the composite string would arrive here
    // and cause a cryptic DB error — catch it early with a clear message.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const item of items) {
        if (!UUID_RE.test(item.product_id)) {
            return res.status(400).json({
                error: `Invalid product_id "${item.product_id}". Make sure variant cart items set originalId.`,
            });
        }
        if (item.variant_id && !UUID_RE.test(item.variant_id)) {
            return res.status(400).json({ error: `Invalid variant_id "${item.variant_id}"` });
        }
    }

    // Fetch all referenced products and variants in parallel.
    // We use the DB prices — never trust the client-sent price (Bug #6).
    const productIds = [...new Set(items.map(i => i.product_id))];
    const variantIds = items.map(i => i.variant_id).filter(Boolean);

    const [productsResult, variantsResult] = await Promise.all([
        supabase
            .from('products')
            .select('id, name, price, stock_quantity')
            .in('id', productIds),
        variantIds.length > 0
            ? supabase
                .from('product_variants')
                .select('id, product_id, price, stock_quantity')
                .in('id', variantIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (productsResult.error) throw productsResult.error;
    if (variantsResult.error) throw variantsResult.error;

    const productMap = Object.fromEntries(productsResult.data.map(p => [p.id, p]));
    const variantMap = Object.fromEntries((variantsResult.data || []).map(v => [v.id, v]));

    // Per-item stock validation.
    // Variant items check their own variant stock; non-variant items check the product total.
    const stockErrors = [];
    // Track checked non-variant product quantities to avoid duplicate errors
    const nonVariantChecked = {};

    for (const item of items) {
        const product = productMap[item.product_id];
        if (!product) {
            stockErrors.push(`Product ${item.product_id} not found`);
            continue;
        }

        if (item.variant_id) {
            const variant = variantMap[item.variant_id];
            if (!variant) {
                stockErrors.push(`Variant ${item.variant_id} not found`);
                continue;
            }
            if (variant.stock_quantity < item.quantity) {
                stockErrors.push(
                    `"${product.name}" (${item.variant_id}) has only ${variant.stock_quantity} units in stock (requested ${item.quantity})`
                );
            }
        } else {
            // Aggregate for products that appear multiple times without a variant
            nonVariantChecked[item.product_id] = (nonVariantChecked[item.product_id] || 0) + item.quantity;
        }
    }

    for (const [productId, qty] of Object.entries(nonVariantChecked)) {
        const product = productMap[productId];
        if (product && product.stock_quantity < qty) {
            stockErrors.push(
                `"${product.name}" only has ${product.stock_quantity} units in stock (requested ${qty})`
            );
        }
    }

    if (stockErrors.length > 0) {
        return res.status(400).json({ error: stockErrors.join('; ') });
    }

    // Build order items using DB-verified prices (never the client price).
    // Also compute the authoritative total_amount server-side.
    const verifiedItems = items.map(item => {
        const variant = item.variant_id ? variantMap[item.variant_id] : null;
        const verifiedPrice = variant
            ? parseFloat(variant.price)
            : parseFloat(productMap[item.product_id].price);
        return { ...item, verifiedPrice };
    });
    const subtotalAmount = verifiedItems.reduce((sum, i) => sum + i.verifiedPrice * i.quantity, 0);
    let selectedDeliveryOption;
    try {
        selectedDeliveryOption = await deliveryService.resolveDeliverySelection({
            pincode: shipping_address.pincode,
            orderSubtotal: subtotalAmount,
            requestedMode: delivery_mode
        });
    } catch (deliveryQuoteError) {
        return res.status(400).json({ error: deliveryQuoteError.message });
    }
    const shippingFee = Number.parseFloat(selectedDeliveryOption.fee) || 0;
    const serverTotal = subtotalAmount + shippingFee;

    const resolvedPaymentMethod = ['COD', 'PHONEPE'].includes(String(payment_method || '').toUpperCase())
        ? String(payment_method).toUpperCase()
        : 'COD';
    const resolvedPaymentStatus = 'PENDING';
    const resolvedOrderStatus = 'pending';

    if (
        resolvedPaymentMethod === 'COD' &&
        selectedDeliveryOption.quote_snapshot?.serviceability?.serviceability_checked &&
        selectedDeliveryOption.quote_snapshot?.serviceability?.cod_available === false
    ) {
        return res.status(400).json({
            error: 'Cash on Delivery is not available for the selected pincode. Please choose an online payment method.'
        });
    }

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
            user_id: user.id,
            subtotal_amount: subtotalAmount,
            shipping_fee: shippingFee,
            total_amount: serverTotal,
            status: resolvedOrderStatus,
            payment_method: resolvedPaymentMethod,
            payment_status: resolvedPaymentStatus,
            customer_phone,
            customer_email,
            shipping_address,
            delivery_mode: selectedDeliveryOption.mode,
            delivery_quote: selectedDeliveryOption.quote_snapshot
        }])
        .select()
        .single();

    if (orderError) {
        logger.error('Failed to create order', orderError, {
            userId: user.id,
            totalAmount: serverTotal,
            subtotalAmount,
            shippingFee,
            itemCount: items?.length || 0
        });
        throw orderError;
    }

    const orderItems = verifiedItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        price: item.verifiedPrice,
    }));

    const { data: newOrderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .insert(orderItems)
        .select();

    if (orderItemsError) {
        logger.error('Failed to create order items', orderItemsError, {
            orderId: order.id,
            userId: user.id,
            itemCount: orderItems.length
        });
        throw orderItemsError;
    }

    // Atomically decrement stock per item (variant-aware).
    // The new decrement_stock RPC uses WHERE stock_quantity >= p_quantity so it
    // returns false instead of silently clipping — this catches the rare race where
    // another order consumed the last unit between our check above and now.
    const decrementResults = await Promise.all(
        verifiedItems.map(item =>
            supabase.rpc('decrement_stock', {
                p_product_id: item.product_id,
                p_quantity: item.quantity,
                p_variant_id: item.variant_id || null,
            }).then(r => ({ ...r, item }))
        )
    );

    const decrementFailures = decrementResults.filter(r => r.error || r.data === false);
    if (decrementFailures.length > 0) {
        const successfulDecrements = decrementResults
            .filter(r => r.data === true)
            .map(r => ({
                product_id: r.item.product_id,
                variant_id: r.item.variant_id || null,
                quantity: r.item.quantity,
            }));

        if (successfulDecrements.length > 0) {
            await orderRecoveryService.restoreStockForItems(successfulDecrements);
        }

        // A race condition: stock was valid at check-time but gone by decrement-time.
        // Cancel the just-created order so it doesn't hold phantom reservations.
        logger.error('Stock decrement race condition — cancelling order', {
            orderId: order.id,
            failures: decrementFailures.map(f => ({
                productId: f.item.product_id,
                variantId: f.item.variant_id,
                qty: f.item.quantity,
                error: f.error?.message,
            })),
        });
        await supabase
            .from('orders')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', order.id);
        return res.status(409).json({
            error: 'One or more items went out of stock. Please refresh and try again.',
        });
    }

    logger.info('Order created successfully', {
        orderId: order.id,
        userId: user.id,
        totalAmount: serverTotal,
        subtotalAmount,
        shippingFee,
        itemCount: newOrderItems.length,
        orderStatus: resolvedOrderStatus,
        paymentMethod: resolvedPaymentMethod,
        deliveryMode: selectedDeliveryOption.mode
    });

    if (resolvedPaymentMethod === 'COD') {
        try {
            const fulfillment = await deliveryService.processOrderForFulfillment(order.id);
            if (!fulfillment.success) {
                logger.warn('Automatic COD fulfillment completed with warnings', {
                    orderId: order.id,
                    shipmentError: fulfillment.shipment_error,
                    pickupError: fulfillment.pickup_error
                });
            }
        } catch (deliveryError) {
            logger.error('Automatic COD fulfillment setup failed', deliveryError, {
                orderId: order.id
            });
        }
    }

    res.status(201).json({ order, newOrderItems });
}));

app.put('/api/orders/:id/release-unpaid', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: order, error } = await supabase
        .from('orders')
        .select('id, user_id, status, payment_status, payment_method')
        .eq('id', id)
        .single();

    if (error || !order) {
        return res.status(404).json({ error: 'Order not found' });
    }

    if (order.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (order.payment_method === 'COD') {
        return res.status(400).json({ error: 'COD orders cannot be released through this flow' });
    }

    if (order.payment_status === 'PAID') {
        return res.status(400).json({ error: 'Paid orders cannot be released' });
    }

    if (order.status !== 'pending' && order.status !== 'cancelled') {
        return res.status(400).json({ error: 'Only unpaid pending orders can be released' });
    }

    const result = await orderRecoveryService.cancelUnpaidOrder(order.id, {
        paymentStatus: 'FAILED',
    });

    res.json({
        success: true,
        ...result,
    });
}));

app.get('/api/orders/:user_id', authenticateToken, asyncHandler(async (req, res) => {
    const { user_id } = req.params;
    if (req.user.id !== user_id) {
        logger.warn('Unauthorized order access attempt', {
            requestedUserId: user_id,
            actualUserId: req.user.id,
            ip: req.ip
        });
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (
                *,
                products (*),
                product_variants (variant_name, size_value, size_unit)
            )
        `)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });
    
    if (error) {
        logger.error('Failed to fetch user orders', error, {
            userId: user_id
        });
        throw error;
    }
    
    logger.info('User orders retrieved successfully', {
        userId: user_id,
        orderCount: data?.length || 0
    });
    
    res.json(data);
}));

// Payment Gateway Integration (Stripe Placeholder)
app.post('/api/create-checkout-session', authenticateToken, asyncHandler(async (req, res) => {
    const { items } = req.body;

    logger.info('Checkout session requested', {
        userId: req.user.id,
        itemCount: items?.length || 0,
        totalValue: items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0
    });

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
}));

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
                SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET ? '***configured***' : 'not set',
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
// EMPLOYEE MANAGEMENT ROUTES
// ======================================

// Get all employees
app.get('/api/admin/employees', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EMPLOYEES), asyncHandler(async (req, res) => {
    const { search = '', role = '' } = req.query;
    const { page, limit, offset } = parsePageLimit(req.query, {
        defaultLimit: 25,
        minLimit: 1,
        maxLimit: 100
    });

    let query = supabase
        .from('employees')
        .select('*', { count: 'exact' })
        .eq('is_active', true);

    const normalizedSearch = typeof search === 'string' ? search.trim() : '';
    const normalizedRole = typeof role === 'string' ? role.trim() : '';

    if (normalizedSearch) {
        query = query.or(`name.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%,contact_number.ilike.%${normalizedSearch}%`);
    }

    if (normalizedRole) {
        query = query.eq('role', normalizedRole);
    }

    query = query
        .order('name')
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        logger.error('Failed to fetch employees', error, {
            adminId: req.user?.id,
            filters: {
                search: normalizedSearch,
                role: normalizedRole
            },
            page,
            limit
        });
        throw error;
    }

    const pagination = buildPagePagination({
        total: count || 0,
        page,
        limit
    });
    
    logger.info('Employees retrieved successfully', {
        adminId: req.user?.id,
        employeeCount: data?.length || 0,
        totalEmployees: pagination.total,
        page: pagination.page,
        limit: pagination.limit
    });
    
    res.json({
        employees: data || [],
        pagination,
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: pagination.totalPages
    });
}));

// Create new employee
app.post('/api/admin/employees', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_EMPLOYEES), asyncHandler(async (req, res) => {
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

    if (error) {
        logger.error('Failed to create employee', error, {
            adminId: req.user?.id,
            employeeName: name,
            employeeRole: role
        });
        throw error;
    }
    
    logger.info('Employee created successfully', {
        adminId: req.user?.id,
        employeeId: data.id,
        employeeName: name,
        employeeRole: role
    });
    
    res.status(201).json(data);
}));

// Update employee
app.put('/api/admin/employees/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_EMPLOYEES), asyncHandler(async (req, res) => {
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

    if (error) {
        logger.error('Failed to update employee', error, {
            adminId: req.user?.id,
            employeeId: id,
            employeeName: name
        });
        throw error;
    }
    
    logger.info('Employee updated successfully', {
        adminId: req.user?.id,
        employeeId: id,
        employeeName: name,
        employeeRole: role
    });
    
    res.json(data);
}));

// Delete employee (soft delete)
app.delete('/api/admin/employees/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_EMPLOYEES), asyncHandler(async (req, res) => {
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

    if (error) {
        logger.error('Failed to delete employee', error, {
            adminId: req.user?.id,
            employeeId: id
        });
        throw error;
    }
    
    logger.warn('Employee deleted (soft delete)', {
        adminId: req.user?.id,
        employeeId: id,
        employeeName: data?.name
    });
    
    res.json({ message: 'Employee deleted successfully' });
}));


// ======================================
// PARTY MANAGEMENT ROUTES (Enhanced Vendor Management)
// ======================================

// Get all parties with advanced filtering
app.get('/api/admin/parties', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_VENDORS), asyncHandler(async (req, res) => {
    const { 
        search = '', 
        category = '', 
        party_type = 'vendor',
        gst_type = '',
        state = ''
    } = req.query;
    const { page, limit, offset } = parsePageLimit(req.query, {
        defaultLimit: 10,
        minLimit: 1,
        maxLimit: 200
    });
    const normalizedSearch = typeof search === 'string' ? search.trim() : '';

    // Build query for filtering
    let query = supabase
        .from('parties')
        .select('*', { count: 'exact' });

    // Apply filters
    if (normalizedSearch) {
        query = query.or(`name.ilike.%${normalizedSearch}%,contact_person.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%,phone_number.ilike.%${normalizedSearch}%`);
    }
    
    if (category) {
        query = query.eq('category', category);
    }

    if (party_type) {
        query = query.eq('party_type', party_type);
    }

    if (gst_type) {
        query = query.eq('gst_type', gst_type);
    }

    if (state) {
        query = query.eq('state', state);
    }

    query = query.eq('is_active', true);

    // Apply pagination and ordering
    query = query
        .order('name')
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        logger.error('Failed to fetch parties', error, {
            adminId: req.user?.id,
            filters: { search: normalizedSearch, category, party_type, gst_type, state }
        });
        throw error;
    }

    const pagination = buildPagePagination({
        total: count || 0,
        page,
        limit
    });

    logger.info('Parties retrieved successfully', {
        adminId: req.user?.id,
        partyCount: data?.length || 0,
        totalCount: pagination.total,
        page: pagination.page,
        filters: { search: normalizedSearch, category, party_type, gst_type, state }
    });

    res.json({
        parties: data || [],
        pagination,
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: pagination.totalPages
    });
}));

// Get archived parties with filtering (MUST be before /:id route)
app.get('/api/admin/parties/archived', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_VENDORS), asyncHandler(async (req, res) => {
    const {
        search = '',
        category = '',
        party_type = 'vendor',
        gst_type = '',
        state = ''
    } = req.query;
    const { page, limit, offset } = parsePageLimit(req.query, {
        defaultLimit: 10,
        minLimit: 1,
        maxLimit: 200
    });
    const normalizedSearch = typeof search === 'string' ? search.trim() : '';

    // Build query for filtering archived parties
    let query = supabase
        .from('parties')
        .select('*', { count: 'exact' });

    // Apply filters
    if (normalizedSearch) {
        query = query.or(`name.ilike.%${normalizedSearch}%,contact_person.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%,phone_number.ilike.%${normalizedSearch}%`);
    }

    if (category) {
        query = query.eq('category', category);
    }

    if (party_type) {
        query = query.eq('party_type', party_type);
    }

    if (gst_type) {
        query = query.eq('gst_type', gst_type);
    }

    if (state) {
        query = query.eq('state', state);
    }

    // Only get archived parties (is_active = false)
    query = query.eq('is_active', false);

    // Apply pagination and ordering
    query = query
        .order('name')
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        logger.error('Failed to fetch archived parties', error, {
            adminId: req.user?.id,
            filters: { search: normalizedSearch, category, party_type, gst_type, state }
        });
        throw error;
    }

    const pagination = buildPagePagination({
        total: count || 0,
        page,
        limit
    });

    logger.info('Archived parties retrieved successfully', {
        adminId: req.user?.id,
        archivedPartyCount: data?.length || 0,
        totalArchivedCount: pagination.total,
        page: pagination.page,
        limit: pagination.limit
    });

    res.json({
        parties: data || [],
        pagination,
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: pagination.totalPages
    });
}));

// Get party by ID with transaction history
app.get('/api/admin/parties/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_VENDORS), asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: party, error: partyError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', id)
        .single();

    if (partyError) {
        logger.error('Failed to fetch party details', partyError, {
            adminId: req.user?.id,
            partyId: id
        });
        throw partyError;
    }

    // Get recent transactions
    const { data: transactions, error: transError } = await supabase
        .from('party_transactions')
        .select('*')
        .eq('party_id', id)
        .order('transaction_date', { ascending: false })
        .limit(10);

    // Get recent purchase orders
    const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('party_id', id)
        .order('order_date', { ascending: false })
        .limit(5);

    logger.info('Party details retrieved successfully', {
        adminId: req.user?.id,
        partyId: id,
        partyName: party?.name,
        transactionCount: transactions?.length || 0,
        purchaseOrderCount: purchaseOrders?.length || 0
    });

    res.json({
        party,
        transactions: transactions || [],
        purchaseOrders: purchaseOrders || []
    });
}));

// Create new party
app.post('/api/admin/parties', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), asyncHandler(async (req, res) => {
    const { 
        name, contact_person, phone_number, email, address, shipping_address,
        gstin, gst_type, state, party_type, category, opening_balance,
        balance_as_of_date, credit_limit, credit_limit_type, notes 
    } = req.body;

    const { data, error } = await supabase
        .from('parties')
        .insert([{
            name,
            contact_person,
            phone_number,
            email,
            address,
            shipping_address,
            gstin,
            gst_type: gst_type || 'Unregistered/Consumer',
            state,
            party_type: party_type || 'vendor',
            category,
            opening_balance: opening_balance || 0,
            balance_as_of_date,
            credit_limit,
            credit_limit_type: credit_limit_type || 'no_limit',
            current_balance: opening_balance || 0,
            notes
        }])
        .select()
        .single();

    if (error) {
        logger.error('Failed to create party', error, {
            adminId: req.user?.id,
            partyName: name,
            partyType: party_type
        });
        throw error;
    }

    // Create opening balance transaction if provided
    if (opening_balance && opening_balance !== 0) {
        const { error: transError } = await supabase
            .from('party_transactions')
            .insert([{
                party_id: data.id,
                transaction_type: 'opening_balance',
                transaction_date: balance_as_of_date || new Date().toISOString().split('T')[0],
                debit_amount: opening_balance > 0 ? opening_balance : 0,
                credit_amount: opening_balance < 0 ? Math.abs(opening_balance) : 0,
                balance: opening_balance,
                description: 'Opening Balance',
                created_by: req.user.id
            }]);
            
        if (transError) {
            logger.warn('Failed to create opening balance transaction', transError, {
                adminId: req.user?.id,
                partyId: data.id,
                openingBalance: opening_balance
            });
        }
    }

    logger.info('Party created successfully', {
        adminId: req.user?.id,
        partyId: data.id,
        partyName: name,
        partyType: party_type || 'vendor',
        hasOpeningBalance: !!(opening_balance && opening_balance !== 0)
    });

    res.status(201).json(data);
}));

// Update party
app.put('/api/admin/parties/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        name, contact_person, phone_number, email, address, shipping_address,
        gstin, gst_type, state, party_type, category, opening_balance,
        balance_as_of_date, credit_limit, credit_limit_type, notes 
    } = req.body;

    const { data, error } = await supabase
        .from('parties')
        .update({
            name,
            contact_person,
            phone_number,
            email,
            address,
            shipping_address,
            gstin,
            gst_type,
            state,
            party_type,
            category,
            opening_balance,
            balance_as_of_date,
            credit_limit,
            credit_limit_type,
            notes,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        logger.error('Failed to update party', error, {
            adminId: req.user?.id,
            partyId: id,
            partyName: name
        });
        throw error;
    }
    
    logger.info('Party updated successfully', {
        adminId: req.user?.id,
        partyId: id,
        partyName: name,
        partyType: party_type
    });
    
    res.json(data);
}));

// Delete party
app.delete('/api/admin/parties/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), asyncHandler(async (req, res) => {
    const { id } = req.params;

    // First check if party has any associated records that would prevent deletion
    const { data: relatedData, error: checkError } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('party_id', id)
        .limit(1);

    if (checkError) {
        logger.error('Failed to check party relations for deletion', checkError, {
            adminId: req.user?.id,
            partyId: id
        });
        throw checkError;
    }

    // If there are purchase orders, we should not allow deletion
    if (relatedData && relatedData.length > 0) {
        logger.warn('Party deletion blocked due to existing purchase orders', {
            adminId: req.user?.id,
            partyId: id
        });
        return res.status(400).json({
            error: 'Cannot delete party with existing purchase orders. Please archive the party instead.'
        });
    }

    // Check for any payments
    const { data: paymentsData, error: paymentsError } = await supabase
        .from('party_payments')
        .select('id')
        .eq('party_id', id)
        .limit(1);

    if (paymentsError) {
        logger.error('Failed to check party payments for deletion', paymentsError, {
            adminId: req.user?.id,
            partyId: id
        });
        throw paymentsError;
    }

    if (paymentsData && paymentsData.length > 0) {
        logger.warn('Party deletion blocked due to existing payment records', {
            adminId: req.user?.id,
            partyId: id
        });
        return res.status(400).json({
            error: 'Cannot delete party with existing payment records. Please archive the party instead.'
        });
    }

    // If no related records, proceed with deletion
    const { error } = await supabase
        .from('parties')
        .delete()
        .eq('id', id);

    if (error) {
        logger.error('Failed to delete party', error, {
            adminId: req.user?.id,
            partyId: id
        });
        throw error;
    }

    logger.warn('Party deleted permanently', {
        adminId: req.user?.id,
        partyId: id
    });

    res.json({ message: 'Party deleted successfully' });
}));

// Archive/unarchive party
app.patch('/api/admin/parties/:id/archive', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { archive = true } = req.body; // Default to archiving

    const { data, error } = await supabase
        .from('parties')
        .update({
            is_active: !archive,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        logger.error('Failed to archive/restore party', error, {
            adminId: req.user?.id,
            partyId: id,
            action: archive ? 'archive' : 'restore'
        });
        throw error;
    }

    if (!data) {
        logger.warn('Party not found for archive operation', {
            adminId: req.user?.id,
            partyId: id
        });
        return res.status(404).json({ error: 'Party not found' });
    }

    logger.info(archive ? 'Party archived successfully' : 'Party restored successfully', {
        adminId: req.user?.id,
        partyId: id,
        partyName: data?.name,
        isActive: data?.is_active
    });

    res.json({
        message: archive ? 'Party archived successfully' : 'Party restored successfully',
        party: data
    });
}));

// ======================================
// PURCHASE ORDER MANAGEMENT ROUTES
// ======================================

// Get all purchase orders with advanced filtering
app.get('/api/admin/purchase-orders', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_VENDORS), async (req, res) => {
    try {
        const { 
            search = '', 
            status = '', 
            party_id = '',
            start_date = '',
            end_date = ''
        } = req.query;
        const { page, limit, offset } = parsePageLimit(req.query, {
            defaultLimit: 10,
            minLimit: 1,
            maxLimit: 200
        });
        const normalizedSearch = typeof search === 'string' ? search.trim() : '';

        // Build query for filtering
        let query = supabase
            .from('purchase_orders')
            .select(`
                *,
                party:party_id(name, contact_person, phone_number),
                purchase_order_items(
                    id, item_name, quantity, unit, price_per_unit, total_amount, received_quantity
                )
            `, { count: 'exact' });

        // Apply filters
        if (normalizedSearch) {
            query = query.or(`po_number.ilike.%${normalizedSearch}%,notes.ilike.%${normalizedSearch}%`);
        }
        
        if (status) {
            query = query.eq('status', status);
        }

        if (party_id) {
            query = query.eq('party_id', party_id);
        }

        if (start_date) {
            query = query.gte('order_date', start_date);
        }

        if (end_date) {
            query = query.lte('order_date', end_date);
        }

        // Apply pagination and ordering
        query = query
            .order('order_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        const pagination = buildPagePagination({
            total: count || 0,
            page,
            limit
        });

        res.json({
            purchase_orders: data || [],
            pagination,
            total: pagination.total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: pagination.totalPages
        });
    } catch (error) {
        console.error('Error fetching purchase orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get purchase order by ID with items
app.get('/api/admin/purchase-orders/:id', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_VENDORS), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('purchase_orders')
            .select(`
                *,
                party:party_id(name, contact_person, phone_number, email, address),
                purchase_order_items(
                    id, product_id, item_name, description, quantity, unit, 
                    price_per_unit, discount_percentage, discount_amount, 
                    tax_percentage, tax_amount, total_amount, received_quantity, pending_quantity,
                    product:product_id(name, sku, unit)
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Error fetching purchase order:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new purchase order
app.post('/api/admin/purchase-orders', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), async (req, res) => {
    try {
        const { 
            party_id, order_date, expected_delivery_date, payment_terms, 
            delivery_address, notes, items 
        } = req.body;

        // Generate PO number
        const { data: poNumberData, error: poError } = await supabase
            .rpc('generate_po_number');
        
        if (poError) throw poError;
        const po_number = poNumberData;

        // Create purchase order
        const { data: purchaseOrder, error: poInsertError } = await supabase
            .from('purchase_orders')
            .insert([{
                po_number,
                party_id,
                order_date,
                expected_delivery_date,
                payment_terms,
                delivery_address,
                notes,
                total_amount: 0, // Will be updated by trigger
                status: 'draft',
                created_by: req.user.id
            }])
            .select()
            .single();

        if (poInsertError) throw poInsertError;

        // Create purchase order items
        if (items && items.length > 0) {
            const itemsToInsert = items.map(item => ({
                purchase_order_id: purchaseOrder.id,
                product_id: item.product_id || null,
                item_name: item.item_name,
                description: item.description || '',
                quantity: item.quantity,
                unit: item.unit || 'kg',
                price_per_unit: item.price_per_unit,
                discount_percentage: item.discount_percentage || 0,
                discount_amount: item.discount_amount || 0,
                tax_percentage: item.tax_percentage || 0,
                tax_amount: item.tax_amount || 0,
                total_amount: item.total_amount,
                pending_quantity: item.quantity
            }));

            const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;
        }

        // Fetch the complete purchase order with items
        const { data: completePO, error: fetchError } = await supabase
            .from('purchase_orders')
            .select(`
                *,
                party:party_id(name, contact_person, phone_number),
                purchase_order_items(*)
            `)
            .eq('id', purchaseOrder.id)
            .single();

        if (fetchError) throw fetchError;

        res.status(201).json(completePO);
    } catch (error) {
        console.error('Error creating purchase order:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create multiple purchase orders in bulk (one API call, optimized for multi-vendor orders)
app.post('/api/admin/purchase-orders/bulk', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), async (req, res) => {
    try {
        const { purchase_orders } = req.body;

        if (!purchase_orders || !Array.isArray(purchase_orders) || purchase_orders.length === 0) {
            return res.status(400).json({ error: 'purchase_orders array is required and must not be empty' });
        }

        const createdPOs = [];
        const errors = [];

        // Process each PO sequentially to ensure proper PO number generation
        for (let i = 0; i < purchase_orders.length; i++) {
            try {
                const poData = purchase_orders[i];
                const {
                    party_id, order_date, expected_delivery_date, payment_terms,
                    delivery_address, notes, items
                } = poData;

                // Validate required fields
                if (!party_id) {
                    throw new Error(`PO ${i + 1}: party_id is required`);
                }
                if (!items || items.length === 0) {
                    throw new Error(`PO ${i + 1}: items array is required`);
                }

                // Generate PO number
                const { data: poNumberData, error: poError } = await supabase
                    .rpc('generate_po_number');

                if (poError) throw poError;
                const po_number = poNumberData;

                // Create purchase order
                const { data: purchaseOrder, error: poInsertError } = await supabase
                    .from('purchase_orders')
                    .insert([{
                        po_number,
                        party_id,
                        order_date,
                        expected_delivery_date,
                        payment_terms,
                        delivery_address,
                        notes,
                        total_amount: 0, // Will be updated by trigger
                        status: 'draft',
                        created_by: req.user.id
                    }])
                    .select()
                    .single();

                if (poInsertError) throw poInsertError;

                // Create purchase order items
                const itemsToInsert = items.map(item => ({
                    purchase_order_id: purchaseOrder.id,
                    product_id: item.product_id || null,
                    item_name: item.item_name,
                    description: item.description || '',
                    quantity: item.quantity,
                    unit: item.unit || 'kg',
                    price_per_unit: item.price_per_unit,
                    discount_percentage: item.discount_percentage || 0,
                    discount_amount: item.discount_amount || 0,
                    tax_percentage: item.tax_percentage || 0,
                    tax_amount: item.tax_amount || 0,
                    total_amount: item.total_amount,
                    pending_quantity: item.quantity
                }));

                const { error: itemsError } = await supabase
                    .from('purchase_order_items')
                    .insert(itemsToInsert);

                if (itemsError) throw itemsError;

                // Fetch the complete purchase order with items
                const { data: completePO, error: fetchError } = await supabase
                    .from('purchase_orders')
                    .select(`
                        *,
                        party:party_id(name, contact_person, phone_number),
                        purchase_order_items(*)
                    `)
                    .eq('id', purchaseOrder.id)
                    .single();

                if (fetchError) throw fetchError;

                createdPOs.push(completePO);
            } catch (error) {
                errors.push({
                    index: i,
                    party_id: purchase_orders[i]?.party_id,
                    error: error.message
                });
                console.error(`Error creating PO ${i + 1}:`, error);
            }
        }

        // Return results
        if (createdPOs.length === 0) {
            return res.status(500).json({
                error: 'Failed to create any purchase orders',
                details: errors,
                created: [],
                failed: errors.length
            });
        }

        res.status(201).json({
            success: true,
            created: createdPOs,
            failed: errors.length,
            errors: errors.length > 0 ? errors : undefined,
            message: errors.length === 0
                ? `Successfully created ${createdPOs.length} purchase order(s)`
                : `Created ${createdPOs.length} PO(s), ${errors.length} failed`
        });
    } catch (error) {
        console.error('Error in bulk purchase order creation:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update purchase order status
app.put('/api/admin/purchase-orders/:id/status', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const validStatuses = ['draft', 'sent', 'confirmed', 'partial_received', 'received', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const { data, error } = await supabase
            .from('purchase_orders')
            .update({
                status,
                notes: notes || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating purchase order status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Receive items from purchase order (Enhanced with item-level tracking)
app.post('/api/admin/purchase-orders/:id/receive', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), async (req, res) => {
    try {
        const { id } = req.params;
        const { received_items, notes } = req.body;

        if (!received_items || !Array.isArray(received_items) || received_items.length === 0) {
            return res.status(400).json({ error: 'received_items array is required' });
        }

        const results = [];
        const errors = [];

        // Process each item with enhanced tracking
        for (const receivedItem of received_items) {
            try {
                const { item_id, receive_now } = receivedItem;
                
                if (!item_id || !receive_now || receive_now <= 0) {
                    errors.push(`Item ${item_id}: receive_now quantity must be positive`);
                    continue;
                }

                // Get current item details
                const { data: currentItem, error: fetchError } = await supabase
                    .from('purchase_order_items')
                    .select(`
                        *,
                        purchase_order:purchase_order_id(party_id),
                        product:product_id(name, unit)
                    `)
                    .eq('id', item_id)
                    .eq('purchase_order_id', id)
                    .single();

                if (fetchError) throw fetchError;

                // Check pending quantity
                const pendingQuantity = currentItem.quantity - (currentItem.received_quantity || 0);
                if (receive_now > pendingQuantity) {
                    errors.push(`${currentItem.item_name}: Cannot receive ${receive_now}, only ${pendingQuantity} pending`);
                    continue;
                }

                const newReceivedQuantity = (currentItem.received_quantity || 0) + receive_now;
                const now = new Date().toISOString();

                // Update purchase order item with enhanced tracking
                const { error: updateError } = await supabase
                    .from('purchase_order_items')
                    .update({
                        received_quantity: newReceivedQuantity,
                        last_received_at: now,
                        first_received_at: currentItem.first_received_at || now,
                        receiving_notes: notes || currentItem.receiving_notes,
                        updated_at: now
                    })
                    .eq('id', item_id);

                if (updateError) throw updateError;

                // Update inventory using enhanced function with PO tracking
                if (currentItem.product_id) {
                    const { error: stockError } = await supabase
                        .rpc('adjust_product_stock_with_po', {
                            p_product_id: currentItem.product_id,
                            p_quantity_change: receive_now,
                            p_reason: `PO ${id} Item Received - ${currentItem.item_name}`,
                            p_purchase_order_id: id,
                            p_purchase_order_item_id: item_id,
                            p_party_id: currentItem.purchase_order?.party_id,
                            p_created_by: req.user.id
                        });

                    if (stockError) {
                        logger.error('Stock update failed', stockError, {
                            product_id: currentItem.product_id,
                            quantity_change: receive_now,
                            purchase_order_id: id,
                            purchase_order_item_id: item_id,
                            admin_id: req.user.id
                        });
                        throw stockError; // Fail fast - no fallback to maintain data consistency
                    }
                }

                results.push({
                    item_id: item_id,
                    item_name: currentItem.item_name,
                    received_quantity: receive_now,
                    total_received: newReceivedQuantity,
                    pending_quantity: currentItem.quantity - newReceivedQuantity
                });

            } catch (itemError) {
                console.error(`Error processing item ${receivedItem.item_id}:`, itemError);
                errors.push(`Item ${receivedItem.item_id}: ${itemError.message}`);
            }
        }

        // Get updated purchase order with all items
        const { data: updatedPO, error: poError } = await supabase
            .from('purchase_orders')
            .select(`
                *,
                party:party_id(name),
                purchase_order_items(
                    id, item_name, quantity, received_quantity, 
                    pending_quantity, is_fully_received
                )
            `)
            .eq('id', id)
            .single();

        if (poError) throw poError;

        // Status will be automatically updated by the database trigger
        res.json({
            success: true,
            message: `Processed ${results.length} items${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
            results,
            errors,
            purchase_order: updatedPO
        });

    } catch (error) {
        console.error('Error receiving purchase order items:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get purchase order summary
app.get('/api/admin/purchase-orders/summary', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_VENDORS), async (req, res) => {
    try {
        const { party_id, start_date, end_date } = req.query;

        let query = supabase
            .from('purchase_orders')
            .select('status, final_amount, order_date');

        if (party_id) {
            query = query.eq('party_id', party_id);
        }

        if (start_date) {
            query = query.gte('order_date', start_date);
        }

        if (end_date) {
            query = query.lte('order_date', end_date);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Calculate summary statistics
        const summary = {
            total_orders: data.length,
            total_amount: data.reduce((sum, po) => sum + parseFloat(po.final_amount || 0), 0),
            status_breakdown: {},
            monthly_trend: {}
        };

        // Status breakdown
        data.forEach(po => {
            const status = po.status;
            summary.status_breakdown[status] = (summary.status_breakdown[status] || 0) + 1;
        });

        // Monthly trend
        data.forEach(po => {
            const month = new Date(po.order_date).toISOString().substring(0, 7); // YYYY-MM
            summary.monthly_trend[month] = (summary.monthly_trend[month] || 0) + parseFloat(po.final_amount || 0);
        });

        res.json(summary);
    } catch (error) {
        console.error('Error fetching purchase order summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================================

// ======================================
// PARTY PAYMENTS ROUTES
// ======================================

// Get all party payments
app.get('/api/admin/party-payments', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_VENDORS), async (req, res) => {
    try {
        const { 
            party_id = '',
            payment_type = '',
            start_date = '',
            end_date = ''
        } = req.query;
        const { page, limit, offset } = parsePageLimit(req.query, {
            defaultLimit: 10,
            minLimit: 1,
            maxLimit: 200
        });

        let query = supabase
            .from('party_payments')
            .select(`
                *,
                party:party_id(name, contact_person)
            `, { count: 'exact' });

        if (party_id) {
            query = query.eq('party_id', party_id);
        }

        if (payment_type) {
            query = query.eq('payment_type', payment_type);
        }

        if (start_date) {
            query = query.gte('payment_date', start_date);
        }

        if (end_date) {
            query = query.lte('payment_date', end_date);
        }

        query = query
            .order('payment_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        const pagination = buildPagePagination({
            total: count || 0,
            page,
            limit
        });

        res.json({
            payments: data || [],
            pagination,
            total: pagination.total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: pagination.totalPages
        });
    } catch (error) {
        console.error('Error fetching party payments:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new party payment
app.post('/api/admin/party-payments', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), async (req, res) => {
    try {
        const { 
            party_id, 
            payment_type, 
            amount, 
            payment_date, 
            reference_number, 
            notes,
            transaction_type_id,
            transaction_fields
        } = req.body;

        // Validate required fields
        if (!party_id || !payment_type || !amount || !payment_date || !transaction_type_id) {
            return res.status(400).json({ 
                error: 'Missing required fields: party_id, payment_type, amount, payment_date, transaction_type_id' 
            });
        }

        // Validate payment_type
        if (!['payment', 'adjustment'].includes(payment_type)) {
            return res.status(400).json({ 
                error: 'Invalid payment_type. Must be either "payment" or "adjustment"' 
            });
        }

        // Validate amount
        if (isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ 
                error: 'Amount must be a positive number' 
            });
        }

        // Validate transaction type exists
        if (!validateTransactionTypeId(transaction_type_id)) {
            return res.status(400).json({ error: 'Invalid transaction type' });
        }

        // Validate transaction fields
        const validation = validateTransactionFields(transaction_type_id, transaction_fields || {});
        if (!validation.isValid) {
            return res.status(400).json({ error: 'Invalid transaction fields', field_errors: validation.errors });
        }

        // Create payment record
        const { data: payment, error: paymentError } = await supabase
            .from('party_payments')
            .insert([{
                party_id,
                payment_type,
                amount: parseFloat(amount),
                payment_date,
                payment_method: transaction_type_id,
                reference_number: transaction_fields?.reference_number ||
                                 transaction_fields?.cheque_number ||
                                 reference_number || null,
                release_date: transaction_type_id === 'cheque' ?
                             (transaction_fields?.release_date || null) : null,
                notes: notes || null,
                created_by: req.user.id
            }])
            .select(`
                *,
                party:party_id(name, contact_person)
            `)
            .single();

        if (paymentError) {
            console.error('Error creating party payment:', paymentError);
            return res.status(500).json({ error: paymentError.message });
        }

        res.status(201).json({
            message: 'Party payment created successfully',
            payment
        });
    } catch (error) {
        console.error('Error creating party payment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create multiple party payments in bulk
app.post('/api/admin/party-payments/bulk', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), async (req, res) => {
    try {
        const { payments } = req.body || {};

        if (!Array.isArray(payments) || payments.length === 0) {
            return res.status(400).json({ error: 'payments array is required and must not be empty' });
        }

        const results = [];
        const errors = [];

        for (let i = 0; i < payments.length; i++) {
            const p = payments[i] || {};
            const {
                party_id,
                payment_type = 'payment',
                amount,
                payment_date,
                transaction_type_id,
                transaction_fields = {},
                reference_number = null,
                notes = null
            } = p;

            // Validate required fields per item
            if (!party_id || !payment_type || !amount || !payment_date || !transaction_type_id) {
                errors.push({ index: i, error: 'Missing required fields', fields: ['party_id', 'payment_type', 'amount', 'payment_date', 'transaction_type_id'] });
                continue;
            }

            if (!['payment', 'adjustment'].includes(payment_type)) {
                errors.push({ index: i, error: 'Invalid payment_type. Must be either "payment" or "adjustment"' });
                continue;
            }

            if (isNaN(amount) || parseFloat(amount) <= 0) {
                errors.push({ index: i, error: 'Amount must be a positive number' });
                continue;
            }

            if (!validateTransactionTypeId(transaction_type_id)) {
                errors.push({ index: i, error: 'Invalid transaction type' });
                continue;
            }

            const validation = validateTransactionFields(transaction_type_id, transaction_fields || {});
            if (!validation.isValid) {
                errors.push({ index: i, error: 'Invalid transaction fields', field_errors: validation.errors });
                continue;
            }

            // Insert payment
            const { data: payment, error: paymentError } = await supabase
                .from('party_payments')
                .insert([{
                    party_id,
                    payment_type,
                    amount: parseFloat(amount),
                    payment_date,
                    payment_method: transaction_type_id,
                    reference_number: transaction_fields?.reference_number || transaction_fields?.cheque_number || reference_number || null,
                    release_date: transaction_type_id === 'cheque' ? (transaction_fields?.release_date || null) : null,
                    notes: notes || null,
                    created_by: req.user.id
                }])
                .select(`
                    *,
                    party:party_id(name, contact_person)
                `)
                .single();

            if (paymentError) {
                errors.push({ index: i, error: paymentError.message });
                continue;
            }

            // Attempt to update party balance (best-effort)
            try {
                const { data: newBalance, error: balanceError } = await supabase
                    .rpc('calculate_party_current_balance', { party_id });

                if (!balanceError && newBalance !== null) {
                    await supabase
                        .from('parties')
                        .update({ current_balance: newBalance })
                        .eq('id', party_id);
                }
            } catch (_) {
                // best-effort, do not fail bulk on balance update issues
            }

            results.push(payment);
        }

        return res.status(201).json({
            message: `Processed ${results.length} payment(s)${errors.length ? ` with ${errors.length} error(s)` : ''}`,
            created: results,
            errors
        });
    } catch (error) {
        console.error('Error creating bulk party payments:', error);
        return res.status(500).json({ error: error.message });
    }
});

// ======================================
// TRANSACTION TYPES API ROUTES (STATIC)
// ======================================

const { 
    getTransactionTypes, 
    getTransactionTypeById, 
    getFormSchemaForType, 
    validateTransactionTypeId,
    validateTransactionFields 
} = require('./config/transactionTypes');

// Get all transaction types (static)
app.get('/api/admin/transaction-types', authenticateAdmin, asyncHandler(async (req, res) => {
    const transactionTypes = getTransactionTypes();
    
    logger.info('Transaction types retrieved successfully', {
        userId: req.user?.id,
        typeCount: transactionTypes?.length
    });
    
    res.json(transactionTypes);
}));

// Get transaction type by ID (static)
app.get('/api/admin/transaction-types/:id', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const transactionType = getTransactionTypeById(id);
    
    if (!transactionType) {
        return res.status(404).json({ error: 'Transaction type not found' });
    }

    logger.info('Transaction type retrieved successfully', {
        userId: req.user?.id,
        transactionTypeId: id
    });

    res.json({
        transaction_type: {
            id: transactionType.id,
            name: transactionType.name,
            description: transactionType.description,
            icon: transactionType.icon
        },
        fields: transactionType.fields
    });
}));

// Get form schema for a transaction type (static)
app.get('/api/admin/transaction-types/:id/form-schema', authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const schema = getFormSchemaForType(id);
    
    if (!schema) {
        return res.status(404).json({ error: 'Transaction type not found' });
    }

    logger.info('Transaction type form schema retrieved successfully', {
        userId: req.user?.id,
        transactionTypeId: id
    });

    res.json(schema);
}));

// ======================================
// ENHANCED INVENTORY MANAGEMENT ROUTES
// ======================================

// Get inventory movements/history for a product
app.get('/api/admin/inventory/movements', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_INVENTORY), async (req, res) => {
    try {
        const { product_id } = req.query;
        const { offset, limit } = parseOffsetLimit(req.query, {
            defaultLimit: 50,
            minLimit: 1,
            maxLimit: 200
        });

        if (!product_id) {
            return res.status(400).json({ error: 'product_id is required' });
        }

        const { data, error, count } = await supabase
            .from('stock_movements')
            .select(`
                *,
                product:product_id(name, sku, unit),
                variant:variant_id(variant_name, size_value, size_unit),
                party:parties!fk_stock_movements_party_id(name),
                purchase_order:purchase_orders!fk_stock_movements_purchase_order(po_number),
                purchase_order_items!fk_stock_movements_purchase_order_item_id(item_name, quantity as po_quantity)
            `, { count: 'exact' })
            .eq('product_id', product_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        const pagination = buildOffsetPagination({
            total: count || 0,
            offset,
            limit
        });

        res.json({
            movements: data || [],
            pagination
        });
    } catch (error) {
        console.error('Error fetching inventory movements:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all purchase orders containing a specific product
app.get('/api/admin/products/:productId/purchase-orders', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_INVENTORY), async (req, res) => {
    try {
        const { productId } = req.params;
        const { status = '' } = req.query;
        const { page, limit, offset } = parsePageLimit(req.query, {
            defaultLimit: 50,
            minLimit: 1,
            maxLimit: 200
        });

        const normalizedStatus = typeof status === 'string' ? status.trim() : '';

        const { data: references, error: referenceError } = await supabase
            .from('purchase_order_items')
            .select('purchase_order_id, created_at')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (referenceError) throw referenceError;

        const orderedUniqueIds = [];
        const seenIds = new Set();
        for (const row of references || []) {
            const purchaseOrderId = row.purchase_order_id;
            if (!purchaseOrderId || seenIds.has(purchaseOrderId)) {
                continue;
            }
            seenIds.add(purchaseOrderId);
            orderedUniqueIds.push(purchaseOrderId);
        }

        let filteredIds = orderedUniqueIds;
        if (normalizedStatus && orderedUniqueIds.length > 0) {
            const { data: statusRows, error: statusError } = await supabase
                .from('purchase_orders')
                .select('id')
                .in('id', orderedUniqueIds)
                .eq('status', normalizedStatus);

            if (statusError) throw statusError;

            const allowedIds = new Set((statusRows || []).map((row) => row.id));
            filteredIds = orderedUniqueIds.filter((id) => allowedIds.has(id));
        }

        const totalCount = filteredIds.length;
        const pageIds = filteredIds.slice(offset, offset + limit);
        const pagination = buildPagePagination({
            total: totalCount,
            page,
            limit
        });

        if (pageIds.length === 0) {
            return res.json({
                purchase_orders: [],
                total_pos: totalCount,
                pagination,
                total: pagination.total,
                page: pagination.page,
                limit: pagination.limit,
                totalPages: pagination.totalPages
            });
        }

        const { data: purchaseOrders, error } = await supabase
            .from('purchase_orders')
            .select(`
                id, po_number, order_date, status, final_amount,
                party:party_id(name, contact_person),
                items:purchase_order_items(
                    id, product_id, item_name, quantity, received_quantity, pending_quantity,
                    is_fully_received, price_per_unit, total_amount, unit
                )
            `)
            .in('id', pageIds);

        if (error) throw error;

        const orderIndex = new Map(pageIds.map((id, index) => [id, index]));
        const sortedOrders = (purchaseOrders || [])
            .map((purchaseOrder) => ({
                ...purchaseOrder,
                items: (purchaseOrder.items || []).filter((item) => String(item.product_id) === String(productId))
            }))
            .sort((left, right) => (orderIndex.get(left.id) || 0) - (orderIndex.get(right.id) || 0));

        res.json({ 
            purchase_orders: sortedOrders,
            total_pos: pagination.total,
            pagination,
            total: pagination.total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: pagination.totalPages
        });
    } catch (error) {
        console.error('Error fetching product purchase orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// Receive individual items directly from inventory view
app.post('/api/admin/inventory/receive-item', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_INVENTORY), async (req, res) => {
    try {
        const { purchase_order_item_id, receive_quantity, notes } = req.body;

        if (!purchase_order_item_id || !receive_quantity || receive_quantity <= 0) {
            return res.status(400).json({ error: 'purchase_order_item_id and positive receive_quantity are required' });
        }

        // Get the purchase order item details
        const { data: currentItem, error: fetchError } = await supabase
            .from('purchase_order_items')
            .select(`
                *,
                purchase_order:purchase_order_id(id, po_number, party_id),
                product:product_id(name, unit)
            `)
            .eq('id', purchase_order_item_id)
            .single();

        if (fetchError) throw fetchError;
        if (!currentItem) {
            return res.status(404).json({ error: 'Purchase order item not found' });
        }

        // Check if receive quantity doesn't exceed pending quantity
        const pendingQuantity = currentItem.quantity - (currentItem.received_quantity || 0);
        if (receive_quantity > pendingQuantity) {
            return res.status(400).json({ 
                error: `Cannot receive ${receive_quantity}. Only ${pendingQuantity} pending.` 
            });
        }

        const newReceivedQuantity = (currentItem.received_quantity || 0) + receive_quantity;
        const now = new Date().toISOString();

        // Update the purchase order item
        const { error: updateError } = await supabase
            .from('purchase_order_items')
            .update({
                received_quantity: newReceivedQuantity,
                last_received_at: now,
                first_received_at: currentItem.first_received_at || now,
                receiving_notes: notes || currentItem.receiving_notes,
                updated_at: now
            })
            .eq('id', purchase_order_item_id);

        if (updateError) throw updateError;

        // Update inventory if product is linked
        if (currentItem.product_id) {
            const { error: stockError } = await supabase
                .rpc('adjust_product_stock_with_po', {
                    p_product_id: currentItem.product_id,
                    p_quantity_change: receive_quantity,
                    p_reason: `Item Received - ${currentItem.item_name}`,
                    p_purchase_order_id: currentItem.purchase_order.id,
                    p_purchase_order_item_id: purchase_order_item_id,
                    p_party_id: currentItem.purchase_order.party_id,
                    p_created_by: req.user.id
                });

            if (stockError) throw stockError;
        }

        // Get updated purchase order details
        const { data: updatedPO, error: poError } = await supabase
            .from('purchase_orders')
            .select(`
                *,
                purchase_order_items(
                    id, item_name, quantity, received_quantity, 
                    pending_quantity, is_fully_received
                )
            `)
            .eq('id', currentItem.purchase_order.id)
            .single();

        if (poError) throw poError;

        res.json({
            success: true,
            message: `Successfully received ${receive_quantity} ${currentItem.product?.unit || currentItem.unit} of ${currentItem.item_name}`,
            received_quantity: receive_quantity,
            total_received: newReceivedQuantity,
            pending_quantity: currentItem.quantity - newReceivedQuantity,
            purchase_order: updatedPO
        });

    } catch (error) {
        console.error('Error receiving inventory item:', error);
        res.status(500).json({ error: error.message });
    }
});

// Enhanced purchase order receiving with item-level granularity
app.post('/api/admin/purchase-orders/:id/receive-items', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_VENDORS), async (req, res) => {
    try {
        const { id } = req.params;
        const { received_items, notes } = req.body;

        if (!received_items || !Array.isArray(received_items) || received_items.length === 0) {
            return res.status(400).json({ error: 'received_items array is required' });
        }

        // Validate all items before processing
        for (const item of received_items) {
            if (!item.item_id || !item.receive_now || item.receive_now <= 0) {
                return res.status(400).json({ error: 'Each item must have item_id and positive receive_now quantity' });
            }
        }

        const results = [];
        const errors = [];

        // Process each item
        for (const item of received_items) {
            try {
                // Get current item details
                const { data: currentItem, error: fetchError } = await supabase
                    .from('purchase_order_items')
                    .select('*, product:product_id(unit)')
                    .eq('id', item.item_id)
                    .eq('purchase_order_id', id)
                    .single();

                if (fetchError) throw fetchError;

                // Check pending quantity
                const pendingQuantity = currentItem.quantity - (currentItem.received_quantity || 0);
                if (item.receive_now > pendingQuantity) {
                    errors.push(`${currentItem.item_name}: Cannot receive ${item.receive_now}, only ${pendingQuantity} pending`);
                    continue;
                }

                const newReceivedQuantity = (currentItem.received_quantity || 0) + item.receive_now;
                const now = new Date().toISOString();

                // Update purchase order item
                const { error: updateError } = await supabase
                    .from('purchase_order_items')
                    .update({
                        received_quantity: newReceivedQuantity,
                        last_received_at: now,
                        first_received_at: currentItem.first_received_at || now,
                        receiving_notes: notes,
                        updated_at: now
                    })
                    .eq('id', item.item_id);

                if (updateError) throw updateError;

                // Update inventory if product is linked
                if (currentItem.product_id) {
                    const { error: stockError } = await supabase
                        .rpc('adjust_product_stock_with_po', {
                            p_product_id: currentItem.product_id,
                            p_quantity_change: item.receive_now,
                            p_reason: `PO ${id} Item Received - ${currentItem.item_name}`,
                            p_purchase_order_id: id,
                            p_purchase_order_item_id: item.item_id,
                            p_party_id: currentItem.purchase_order?.party_id,
                            p_created_by: req.user.id
                        });

                    if (stockError) throw stockError;
                }

                results.push({
                    item_id: item.item_id,
                    item_name: currentItem.item_name,
                    received_quantity: item.receive_now,
                    total_received: newReceivedQuantity,
                    pending_quantity: currentItem.quantity - newReceivedQuantity
                });

            } catch (itemError) {
                errors.push(`${item.item_id}: ${itemError.message}`);
            }
        }

        // Get updated purchase order
        const { data: updatedPO, error: poError } = await supabase
            .from('purchase_orders')
            .select(`
                *,
                party:party_id(name),
                purchase_order_items(*)
            `)
            .eq('id', id)
            .single();

        if (poError) throw poError;

        res.json({
            success: true,
            message: `Processed ${results.length} items${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
            results,
            errors,
            purchase_order: updatedPO
        });

    } catch (error) {
        console.error('Error receiving purchase order items:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get inventory summary with enhanced PO tracking
app.get('/api/admin/inventory/summary', roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_INVENTORY), async (req, res) => {
    try {
        // Get products with their stock levels and related PO information
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select(`
                id, name, sku, stock_quantity, min_stock_level, price, unit,
                category:category_id(name)
            `)
            .eq('is_active', true)
            .order('name');

        if (productsError) throw productsError;

        // Get pending PO items for each product
        const productIds = products.map(p => p.id);
        const { data: pendingItems, error: pendingError } = await supabase
            .from('purchase_order_items')
            .select(`
                product_id, quantity, received_quantity, pending_quantity,
                purchase_order:purchase_order_id(po_number, status, order_date, party:party_id(name))
            `)
            .in('product_id', productIds)
            .in('purchase_order.status', ['confirmed', 'partial_received'])
            .gt('pending_quantity', 0);

        if (pendingError) throw pendingError;

        // Group pending items by product
        const pendingByProduct = {};
        pendingItems?.forEach(item => {
            if (!pendingByProduct[item.product_id]) {
                pendingByProduct[item.product_id] = [];
            }
            pendingByProduct[item.product_id].push(item);
        });

        // Enhance products with pending PO information
        const enhancedProducts = products.map(product => ({
            ...product,
            pending_orders: pendingByProduct[product.id] || [],
            total_pending_quantity: (pendingByProduct[product.id] || []).reduce((sum, item) => sum + (item.pending_quantity || 0), 0),
            expected_stock: product.stock_quantity + (pendingByProduct[product.id] || []).reduce((sum, item) => sum + (item.pending_quantity || 0), 0)
        }));

        // Calculate summary statistics
        const summary = {
            total_products: products.length,
            low_stock_products: enhancedProducts.filter(p => p.stock_quantity <= p.min_stock_level).length,
            out_of_stock_products: enhancedProducts.filter(p => p.stock_quantity <= 0).length,
            total_inventory_value: enhancedProducts.reduce((sum, p) => sum + (p.stock_quantity * p.price), 0),
            products_with_pending_orders: enhancedProducts.filter(p => p.pending_orders.length > 0).length,
            total_pending_value: enhancedProducts.reduce((sum, p) => sum + p.total_pending_quantity * p.price, 0)
        };

        res.json({
            summary,
            products: enhancedProducts
        });

    } catch (error) {
        console.error('Error fetching inventory summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
    logger.info(`Backend server listening at http://localhost:${port}`);
}); 
