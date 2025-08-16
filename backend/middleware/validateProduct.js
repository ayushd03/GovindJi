// Product validation middleware
const validateProduct = (req, res, next) => {
    const { 
        name, 
        price,
        base_unit,
        secondary_unit,
        unit_conversion_value,
        discount_type,
        wholesale_prices 
    } = req.body;

    // Basic required field validation
    if (!name || !name.trim()) {
        return res.status(400).json({ 
            error: 'Product name is required',
            field: 'name'
        });
    }

    if (!price || price <= 0) {
        return res.status(400).json({ 
            error: 'Valid price is required',
            field: 'price'
        });
    }

    // Unit validation
    if (base_unit && secondary_unit) {
        if (!unit_conversion_value || unit_conversion_value <= 0) {
            return res.status(400).json({ 
                error: 'Valid unit conversion value is required when using unit system',
                field: 'unit_conversion_value'
            });
        }
    }

    // Discount type validation
    if (discount_type && !['percentage', 'amount'].includes(discount_type)) {
        return res.status(400).json({ 
            error: 'Discount type must be either "percentage" or "amount"',
            field: 'discount_type'
        });
    }

    // Wholesale prices validation
    if (wholesale_prices && Array.isArray(wholesale_prices)) {
        for (let i = 0; i < wholesale_prices.length; i++) {
            const wp = wholesale_prices[i];
            
            if (!wp.quantity || wp.quantity <= 0) {
                return res.status(400).json({ 
                    error: `Wholesale price tier ${i + 1}: quantity must be greater than 0`,
                    field: `wholesale_prices[${i}].quantity`
                });
            }

            if (!wp.price || wp.price < 0) {
                return res.status(400).json({ 
                    error: `Wholesale price tier ${i + 1}: price must be 0 or greater`,
                    field: `wholesale_prices[${i}].price`
                });
            }
        }

        // Check for duplicate quantities
        const quantities = wholesale_prices.map(wp => parseFloat(wp.quantity));
        const uniqueQuantities = [...new Set(quantities)];
        if (quantities.length !== uniqueQuantities.length) {
            return res.status(400).json({ 
                error: 'Wholesale price quantities must be unique',
                field: 'wholesale_prices'
            });
        }
    }

    next();
};

// Validate wholesale prices specifically
const validateWholesalePrices = (req, res, next) => {
    const { wholesale_prices } = req.body;

    if (!wholesale_prices || !Array.isArray(wholesale_prices)) {
        return res.status(400).json({ 
            error: 'Wholesale prices must be an array',
            field: 'wholesale_prices'
        });
    }

    for (let i = 0; i < wholesale_prices.length; i++) {
        const wp = wholesale_prices[i];
        
        if (!wp.quantity || wp.quantity <= 0) {
            return res.status(400).json({ 
                error: `Wholesale price tier ${i + 1}: quantity must be greater than 0`,
                field: `wholesale_prices[${i}].quantity`
            });
        }

        if (wp.price === undefined || wp.price < 0) {
            return res.status(400).json({ 
                error: `Wholesale price tier ${i + 1}: price must be 0 or greater`,
                field: `wholesale_prices[${i}].price`
            });
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