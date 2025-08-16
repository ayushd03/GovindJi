// Frontend product validation utilities

export const validateProductForm = (formData) => {
  const errors = {};

  // Required fields
  if (!formData.name?.trim()) {
    errors.name = 'Product name is required';
  }

  if (!formData.price || parseFloat(formData.price) <= 0) {
    errors.price = 'Valid price is required';
  }

  // Unit validation
  if (formData.base_unit && formData.secondary_unit) {
    if (!formData.unit_conversion_value || parseFloat(formData.unit_conversion_value) <= 0) {
      errors.unit_conversion_value = 'Valid conversion value is required';
    }
  }

  // Discount validation
  if (formData.discount_on_sale_price) {
    const discount = parseFloat(formData.discount_on_sale_price);
    if (discount < 0) {
      errors.discount_on_sale_price = 'Discount cannot be negative';
    }
    
    if (formData.discount_type === 'percentage' && discount > 100) {
      errors.discount_on_sale_price = 'Percentage discount cannot exceed 100%';
    }
  }

  // Wholesale prices validation
  if (formData.wholesale_prices?.length > 0) {
    const wholesaleErrors = [];
    const quantities = [];

    formData.wholesale_prices.forEach((wp, index) => {
      const tierErrors = {};

      if (!wp.quantity || parseFloat(wp.quantity) <= 0) {
        tierErrors.quantity = 'Quantity must be greater than 0';
      } else {
        const qty = parseFloat(wp.quantity);
        if (quantities.includes(qty)) {
          tierErrors.quantity = 'Duplicate quantity not allowed';
        }
        quantities.push(qty);
      }

      if (wp.price === '' || parseFloat(wp.price) < 0) {
        tierErrors.price = 'Price must be 0 or greater';
      }

      if (Object.keys(tierErrors).length > 0) {
        wholesaleErrors[index] = tierErrors;
      }
    });

    if (wholesaleErrors.length > 0) {
      errors.wholesale_prices = wholesaleErrors;
    }
  }

  // Stock validation
  if (formData.stock_quantity && parseFloat(formData.stock_quantity) < 0) {
    errors.stock_quantity = 'Stock quantity cannot be negative';
  }

  if (formData.min_stock_level && parseFloat(formData.min_stock_level) < 0) {
    errors.min_stock_level = 'Minimum stock level cannot be negative';
  }

  if (formData.weight && parseFloat(formData.weight) < 0) {
    errors.weight = 'Weight cannot be negative';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateWholesalePrice = (quantity, price) => {
  const errors = {};

  if (!quantity || parseFloat(quantity) <= 0) {
    errors.quantity = 'Quantity must be greater than 0';
  }

  if (price === '' || parseFloat(price) < 0) {
    errors.price = 'Price must be 0 or greater';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatNumber = (number, decimals = 2) => {
  return parseFloat(number).toFixed(decimals);
};