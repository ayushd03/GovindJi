const { logger, sendError } = require('./errorHandler');
const { createBackendSupabaseClient } = require('../config/supabaseClient');

const supabase = createBackendSupabaseClient();

// Helper function to validate and sanitize date fields
const sanitizeDateField = (value, fieldName) => {
    if (value === null || value === undefined) {
        return null;
    }
    
    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }
    
    if (typeof value === 'string' && value.trim() !== '') {
        // Basic date format validation
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value.trim())) {
            throw new Error(`Invalid date format for ${fieldName}. Expected YYYY-MM-DD format.`);
        }
        
        // Validate that it's a valid date
        const date = new Date(value.trim());
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date value for ${fieldName}.`);
        }
        
        return value.trim();
    }
    
    return null;
};

// Helper function to validate and sanitize numeric fields
const sanitizeNumericField = (value, fieldName, options = {}) => {
    const { allowZero = true, allowNegative = false, defaultValue = null } = options;
    
    if (value === null || value === undefined) {
        return defaultValue;
    }
    
    if (typeof value === 'string' && value.trim() === '') {
        return defaultValue;
    }
    
    let numericValue;
    if (typeof value === 'string') {
        numericValue = parseFloat(value.trim());
    } else if (typeof value === 'number') {
        numericValue = value;
    } else {
        throw new Error(`Invalid data type for ${fieldName}. Expected number or numeric string.`);
    }
    
    if (isNaN(numericValue)) {
        throw new Error(`Invalid numeric value for ${fieldName}.`);
    }
    
    if (!allowZero && numericValue === 0) {
        throw new Error(`${fieldName} cannot be zero.`);
    }
    
    if (!allowNegative && numericValue < 0) {
        throw new Error(`${fieldName} cannot be negative.`);
    }
    
    return numericValue;
};

// Product validation middleware
const validateProduct = async (req, res, next) => {
    const { 
        name, 
        price,
        category_id,
        sku,
        mrp,
        base_unit,
        secondary_unit,
        unit_conversion_value,
        discount_type,
        wholesale_prices,
        opening_quantity_as_of_date,
        variants
    } = req.body;

    // Basic required field validation
    if (!name || !name.trim()) {
        logger.warn('Product validation failed: missing name', {
            userId: req.user?.id,
            requestData: req.body
        });
        return sendError(res, 'Product name is required', 400, { field: 'name' });
    }

    if (!category_id || (typeof category_id === 'string' && !category_id.trim())) {
        logger.warn('Product validation failed: missing category', {
            userId: req.user?.id,
            requestData: req.body
        });
        return sendError(res, 'Category is required', 400, { field: 'category_id' });
    }

    if (!sku || (typeof sku === 'string' && !sku.trim())) {
        logger.warn('Product validation failed: missing sku', {
            userId: req.user?.id,
            requestData: req.body
        });
        return sendError(res, 'SKU code is required', 400, { field: 'sku' });
    }

    if (typeof req.body.name === 'string') {
        req.body.name = req.body.name.trim();
    }

    if (typeof req.body.category_id === 'string') {
        req.body.category_id = req.body.category_id.trim();
    }

    if (typeof req.body.sku === 'string') {
        req.body.sku = req.body.sku.trim();
    }

    const parsedPrice = typeof price === 'string' ? Number.parseFloat(price) : price;
    const hasInlineVariants = Array.isArray(variants) && variants.length > 0;
    let hasExistingVariants = false;

    if (req.params?.id && (price === undefined || price === null || price === '' || !(parsedPrice > 0))) {
        try {
            const { count, error } = await supabase
                .from('product_variants')
                .select('id', { count: 'exact', head: true })
                .eq('product_id', req.params.id);

            if (error) {
                logger.warn('Product validation variant lookup failed', {
                    userId: req.user?.id,
                    productId: req.params.id,
                    error: error.message
                });
            } else {
                hasExistingVariants = (count || 0) > 0;
            }
        } catch (error) {
            logger.warn('Product validation variant lookup threw', {
                userId: req.user?.id,
                productId: req.params.id,
                error: error.message
            });
        }
    }

    if (!(parsedPrice > 0) && !req.body.is_service && !hasInlineVariants && !hasExistingVariants) {
        logger.warn('Product validation failed: invalid price', {
            userId: req.user?.id,
            price: price,
            requestData: req.body
        });
        return sendError(res, 'Valid price is required', 400, { field: 'price' });
    }

    // Unit validation
    if (base_unit && secondary_unit) {
        if (!unit_conversion_value || unit_conversion_value <= 0) {
            logger.warn('Product validation failed: invalid unit conversion', {
                userId: req.user?.id,
                base_unit,
                secondary_unit,
                unit_conversion_value
            });
            return sendError(res, 'Valid unit conversion value is required when using unit system', 400, { field: 'unit_conversion_value' });
        }
    }

    // Discount type validation
    if (discount_type && discount_type !== 'percentage') {
        logger.warn('Product validation failed: invalid discount type', {
            userId: req.user?.id,
            discount_type,
            validTypes: ['percentage']
        });
        return sendError(res, 'Only percentage discounts are supported for products', 400, { field: 'discount_type' });
    }

    // Wholesale prices validation
    if (wholesale_prices && Array.isArray(wholesale_prices)) {
        for (let i = 0; i < wholesale_prices.length; i++) {
            const wp = wholesale_prices[i];
            
            if (!wp.quantity || wp.quantity <= 0) {
                logger.warn('Product validation failed: invalid wholesale quantity', {
                    userId: req.user?.id,
                    tier: i + 1,
                    quantity: wp.quantity
                });
                return sendError(res, `Wholesale price tier ${i + 1}: quantity must be greater than 0`, 400, { field: `wholesale_prices[${i}].quantity` });
            }

            if (!wp.price || wp.price < 0) {
                logger.warn('Product validation failed: invalid wholesale price', {
                    userId: req.user?.id,
                    tier: i + 1,
                    price: wp.price
                });
                return sendError(res, `Wholesale price tier ${i + 1}: price must be 0 or greater`, 400, { field: `wholesale_prices[${i}].price` });
            }
        }

        // Check for duplicate quantities
        const quantities = wholesale_prices.map(wp => parseFloat(wp.quantity));
        const uniqueQuantities = [...new Set(quantities)];
        if (quantities.length !== uniqueQuantities.length) {
            logger.warn('Product validation failed: duplicate wholesale quantities', {
                userId: req.user?.id,
                quantities,
                duplicates: quantities.filter((item, index) => quantities.indexOf(item) !== index)
            });
            return sendError(res, 'Wholesale price quantities must be unique', 400, { field: 'wholesale_prices' });
        }
    }

    // Date field validation and sanitization
    try {
        if ('opening_quantity_as_of_date' in req.body) {
            req.body.opening_quantity_as_of_date = sanitizeDateField(
                req.body.opening_quantity_as_of_date, 
                'opening_quantity_as_of_date'
            );
        }
    } catch (error) {
        logger.warn('Product validation failed: date validation error', {
            userId: req.user?.id,
            error: error.message,
            field: 'opening_quantity_as_of_date',
            value: req.body.opening_quantity_as_of_date
        });
        return sendError(res, error.message, 400, { field: 'opening_quantity_as_of_date' });
    }

    // Numeric field validation and sanitization
    try {
        // Required numeric fields
        if ('price' in req.body && req.body.price !== '' && req.body.price !== null && req.body.price !== undefined) {
            req.body.price = sanitizeNumericField(req.body.price, 'price', {
                allowZero: Boolean(req.body.is_service),
                allowNegative: false
            });
        }
        
        // Optional numeric fields with defaults
        if ('stock_quantity' in req.body) {
            req.body.stock_quantity = sanitizeNumericField(req.body.stock_quantity, 'stock_quantity', { allowZero: true, allowNegative: false, defaultValue: 0 });
        }
        
        if ('min_stock_level' in req.body) {
            req.body.min_stock_level = sanitizeNumericField(req.body.min_stock_level, 'min_stock_level', { allowZero: true, allowNegative: false, defaultValue: 10 });
        }
        
        if ('weight' in req.body) {
            req.body.weight = sanitizeNumericField(req.body.weight, 'weight', { allowZero: false, allowNegative: false, defaultValue: null });
        }
        
        if ('unit_conversion_value' in req.body) {
            req.body.unit_conversion_value = sanitizeNumericField(req.body.unit_conversion_value, 'unit_conversion_value', { allowZero: false, allowNegative: false, defaultValue: 1000 });
        }
        
        if ('discount_on_sale_price' in req.body) {
            req.body.discount_on_sale_price = sanitizeNumericField(req.body.discount_on_sale_price, 'discount_on_sale_price', { allowZero: true, allowNegative: false, defaultValue: 0 });
        }

        if ('mrp' in req.body) {
            req.body.mrp = sanitizeNumericField(req.body.mrp, 'mrp', { allowZero: false, allowNegative: false, defaultValue: null });
        }

        if ('weight_grams' in req.body) {
            req.body.weight_grams = sanitizeNumericField(req.body.weight_grams, 'weight_grams', { allowZero: true, allowNegative: false, defaultValue: null });
        }
        
        if ('opening_quantity_at_price' in req.body) {
            req.body.opening_quantity_at_price = sanitizeNumericField(req.body.opening_quantity_at_price, 'opening_quantity_at_price', { allowZero: true, allowNegative: false, defaultValue: null });
        }
        
    } catch (error) {
        logger.warn('Product validation failed: numeric validation error', {
            userId: req.user?.id,
            error: error.message,
            requestData: req.body
        });
        return sendError(res, error.message, 400);
    }

    if (req.body.mrp !== null && req.body.mrp !== undefined && req.body.price !== undefined) {
        if (req.body.mrp < req.body.price) {
            logger.warn('Product validation failed: mrp below price', {
                userId: req.user?.id,
                mrp: req.body.mrp,
                price: req.body.price
            });
            return sendError(res, 'MRP must be greater than or equal to the selling price', 400, { field: 'mrp' });
        }
    }

    const hasMrp = req.body.mrp !== undefined && req.body.mrp !== null;

    if (
        req.body.discount_on_sale_price !== undefined &&
        req.body.discount_on_sale_price !== null &&
        !hasMrp &&
        req.body.discount_on_sale_price > 100
    ) {
        logger.warn('Product validation failed: discount percentage above 100', {
            userId: req.user?.id,
            discount_on_sale_price: req.body.discount_on_sale_price
        });
        return sendError(res, 'Percentage discount cannot exceed 100', 400, { field: 'discount_on_sale_price' });
    }

    req.body.discount_type = 'percentage';

    next();
};

// Validate wholesale prices specifically
const validateWholesalePrices = (req, res, next) => {
    const { wholesale_prices } = req.body;

    if (!wholesale_prices || !Array.isArray(wholesale_prices)) {
        logger.warn('Wholesale price validation failed: not an array', {
            userId: req.user?.id,
            provided: typeof wholesale_prices
        });
        return sendError(res, 'Wholesale prices must be an array', 400, { field: 'wholesale_prices' });
    }

    for (let i = 0; i < wholesale_prices.length; i++) {
        const wp = wholesale_prices[i];
        
        if (!wp.quantity || wp.quantity <= 0) {
            logger.warn('Wholesale price validation failed: invalid quantity', {
                userId: req.user?.id,
                tier: i + 1,
                quantity: wp.quantity
            });
            return sendError(res, `Wholesale price tier ${i + 1}: quantity must be greater than 0`, 400, { field: `wholesale_prices[${i}].quantity` });
        }

        if (wp.price === undefined || wp.price < 0) {
            logger.warn('Wholesale price validation failed: invalid price', {
                userId: req.user?.id,
                tier: i + 1,
                price: wp.price
            });
            return sendError(res, `Wholesale price tier ${i + 1}: price must be 0 or greater`, 400, { field: `wholesale_prices[${i}].price` });
        }
    }

    // Sort by quantity for consistency
    req.body.wholesale_prices = wholesale_prices.sort((a, b) => 
        parseFloat(a.quantity) - parseFloat(b.quantity)
    );

    next();
};

module.exports = {
    validateProduct,
    validateWholesalePrices
};
