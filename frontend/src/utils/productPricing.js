const parseFloatValue = (value, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseIntegerValue = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
};

const getDefaultVariantFromList = (variants, { preferInStock = true } = {}) => {
  if (variants.length === 0) {
    return null;
  }

  if (preferInStock) {
    const defaultInStockVariant = variants.find(
      (variant) => variant.is_default && parseIntegerValue(variant.stock_quantity, 0) > 0
    );
    if (defaultInStockVariant) {
      return defaultInStockVariant;
    }

    const firstInStockVariant = variants.find(
      (variant) => parseIntegerValue(variant.stock_quantity, 0) > 0
    );
    if (firstInStockVariant) {
      return firstInStockVariant;
    }
  }

  return variants.find((variant) => variant.is_default) || variants[0];
};

export const getProductVariants = (product) => {
  if (!Array.isArray(product?.variants)) {
    return [];
  }

  return [...product.variants]
    .filter(Boolean)
    .filter((variant) => variant.is_active !== false)
    .sort((left, right) => (
      parseIntegerValue(left.display_order, 0) - parseIntegerValue(right.display_order, 0)
    ));
};

export const getSelectedVariant = (product, variantId, options = {}) => {
  const variants = getProductVariants(product);

  if (variants.length === 0) {
    return null;
  }

  if (variantId) {
    const matchingVariant = variants.find((variant) => variant.id === variantId);
    if (matchingVariant) {
      return matchingVariant;
    }
  }

  return getDefaultVariantFromList(variants, options);
};

export const getProductPricing = (product, variantId) => {
  const variants = getProductVariants(product);
  const hasVariants = variants.length > 0;
  const basePrice = parseFloatValue(product?.price, 0);

  if (!hasVariants) {
    const availableStock = parseIntegerValue(product?.stock_quantity, 0);

    return {
      hasVariants: false,
      variants: [],
      inStockVariants: [],
      selectedVariant: null,
      selectedPrice: basePrice,
      minPrice: basePrice,
      maxPrice: basePrice,
      hasPriceRange: false,
      availableStock,
      totalStock: availableStock,
      isPurchasable: availableStock > 0,
    };
  }

  const inStockVariants = variants.filter(
    (variant) => parseIntegerValue(variant.stock_quantity, 0) > 0
  );
  const priceSourceVariants = inStockVariants.length > 0 ? inStockVariants : variants;
  const selectedVariant = variantId
    ? (
        getSelectedVariant(product, variantId, { preferInStock: false }) ||
        getSelectedVariant(product, null, { preferInStock: true })
      )
    : getSelectedVariant(product, null, { preferInStock: true });
  const selectedPrice = parseFloatValue(selectedVariant?.price, basePrice);
  const minPrice = Math.min(...priceSourceVariants.map((variant) => parseFloatValue(variant.price, 0)));
  const maxPrice = Math.max(...priceSourceVariants.map((variant) => parseFloatValue(variant.price, 0)));
  const availableStock = parseIntegerValue(selectedVariant?.stock_quantity, 0);
  const totalStock = variants.reduce(
    (runningTotal, variant) => runningTotal + parseIntegerValue(variant.stock_quantity, 0),
    0
  );

  return {
    hasVariants: true,
    variants,
    inStockVariants,
    selectedVariant,
    selectedPrice,
    minPrice,
    maxPrice,
    hasPriceRange: minPrice !== maxPrice,
    availableStock,
    totalStock,
    isPurchasable: inStockVariants.length > 0,
  };
};

export const getComparableProductPrice = (product) => {
  const pricing = getProductPricing(product);
  return pricing.hasVariants ? pricing.minPrice : pricing.selectedPrice;
};

export const clampQuantityToStock = (quantity, stockQuantity) => {
  const normalizedQuantity = Math.max(1, parseIntegerValue(quantity, 1));

  if (stockQuantity === null || stockQuantity === undefined) {
    return normalizedQuantity;
  }

  const normalizedStock = parseIntegerValue(stockQuantity, 0);
  if (normalizedStock <= 0) {
    return 1;
  }

  return Math.min(normalizedQuantity, normalizedStock);
};

export const getStockLevel = (stockQuantity, lowStockThreshold = 5) => {
  const normalizedStock = parseIntegerValue(stockQuantity, 0);

  if (normalizedStock <= 0) {
    return 'out';
  }

  if (normalizedStock <= parseIntegerValue(lowStockThreshold, 5)) {
    return 'low';
  }

  return 'in';
};

export const formatCompactStockLabel = (stockQuantity, lowStockThreshold = 5) => {
  const normalizedStock = parseIntegerValue(stockQuantity, 0);
  const stockLevel = getStockLevel(normalizedStock, lowStockThreshold);

  if (stockLevel === 'out') {
    return 'Out of stock';
  }

  if (stockLevel === 'low') {
    return `${normalizedStock} left`;
  }

  return `${normalizedStock} in stock`;
};

export const buildCartItem = (product, variantId) => {
  const baseProductId = product?.originalId || product?.id;
  const selectedVariant = variantId
    ? getSelectedVariant(product, variantId, { preferInStock: false })
    : null;

  if (variantId && !selectedVariant) {
    return null;
  }

  const baseItem = {
    id: baseProductId,
    originalId: baseProductId,
    name: product?.name,
    image_url: product?.image_url,
    price: parseFloatValue(product?.price, 0),
    stock_quantity: parseIntegerValue(product?.stock_quantity, null),
  };

  if (!selectedVariant) {
    return baseItem;
  }

  return {
    ...baseItem,
    id: `${baseProductId}-${selectedVariant.id}`,
    variant_id: selectedVariant.id,
    size: selectedVariant.variant_name,
    size_value: selectedVariant.size_value,
    size_unit: selectedVariant.size_unit,
    price: parseFloatValue(selectedVariant.price, 0),
    stock_quantity: parseIntegerValue(selectedVariant.stock_quantity, null),
  };
};

export const getCartItemStock = (item) => parseIntegerValue(item?.stock_quantity, null);
