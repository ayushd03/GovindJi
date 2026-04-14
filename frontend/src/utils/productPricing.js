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

const roundToPrecision = (value, precision = 1) => {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
};

const computeDiscountPercent = (mrp, price) => {
  const normalizedMrp = parseFloatValue(mrp, 0);
  const normalizedPrice = parseFloatValue(price, 0);

  if (normalizedMrp <= 0 || normalizedPrice <= 0 || normalizedMrp <= normalizedPrice) {
    return 0;
  }

  return roundToPrecision(((normalizedMrp - normalizedPrice) / normalizedMrp) * 100, 1);
};

const normalizeBasePricing = (product) => {
  const selectedPrice = parseFloatValue(product?.price, 0);
  const mrp = parseFloatValue(product?.mrp, 0);
  const fallbackDiscount = Math.max(
    parseFloatValue(
      product?.discount_percent ??
      product?.discount ??
      (product?.discount_type === 'percentage' ? product?.discount_on_sale_price : 0),
      0
    ),
    0
  );
  const derivedDiscount = computeDiscountPercent(mrp, selectedPrice);

  return {
    selectedPrice,
    mrp: mrp > 0 ? mrp : 0,
    discountPercent: derivedDiscount || fallbackDiscount,
    hasMrp: mrp > selectedPrice && selectedPrice > 0,
  };
};

const normalizeVariant = (variant) => {
  const price = parseFloatValue(variant?.price, 0);
  const mrp = parseFloatValue(variant?.mrp, 0);
  const fallbackDiscount = Math.max(
    parseFloatValue(variant?.discount_percent ?? variant?.discount ?? 0, 0),
    0
  );
  const derivedDiscount = computeDiscountPercent(mrp, price);

  return {
    ...variant,
    price,
    mrp: mrp > 0 ? mrp : 0,
    discountPercent: derivedDiscount || fallbackDiscount,
    hasMrp: mrp > price && price > 0,
  };
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
    ))
    .map(normalizeVariant);
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
  const basePricing = normalizeBasePricing(product);

  if (!hasVariants) {
    const availableStock = parseIntegerValue(product?.stock_quantity, 0);

    return {
      hasVariants: false,
      variants: [],
      inStockVariants: [],
      selectedVariant: null,
      selectedPrice: basePricing.selectedPrice,
      selectedMrp: basePricing.hasMrp ? basePricing.mrp : 0,
      discountPercent: basePricing.discountPercent,
      hasMrp: basePricing.hasMrp,
      displayPrice: basePricing.selectedPrice,
      displayMrp: basePricing.hasMrp ? basePricing.mrp : 0,
      displayDiscountPercent: basePricing.discountPercent,
      displayHasMrp: basePricing.hasMrp,
      minPrice: basePricing.selectedPrice,
      maxPrice: basePricing.selectedPrice,
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
  const selectedPrice = parseFloatValue(selectedVariant?.price, basePricing.selectedPrice);
  const minPrice = Math.min(...priceSourceVariants.map((variant) => parseFloatValue(variant.price, 0)));
  const maxPrice = Math.max(...priceSourceVariants.map((variant) => parseFloatValue(variant.price, 0)));
  const displayVariant = priceSourceVariants.find((variant) => variant.price === minPrice) || selectedVariant;
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
    selectedMrp: selectedVariant?.hasMrp ? selectedVariant.mrp : 0,
    discountPercent: selectedVariant?.discountPercent || 0,
    hasMrp: Boolean(selectedVariant?.hasMrp),
    displayPrice: minPrice,
    displayMrp: displayVariant?.hasMrp ? displayVariant.mrp : 0,
    displayDiscountPercent: displayVariant?.discountPercent || 0,
    displayHasMrp: Boolean(displayVariant?.hasMrp),
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

export const formatDiscountPercent = (discountPercent) => {
  const normalizedDiscount = Math.max(parseFloatValue(discountPercent, 0), 0);
  if (normalizedDiscount === 0) {
    return '0';
  }

  return Number.isInteger(normalizedDiscount)
    ? normalizedDiscount.toFixed(0)
    : normalizedDiscount.toFixed(1);
};

export const buildCartItem = (product, variantId) => {
  const baseProductId = product?.originalId || product?.id;
  const selectedVariant = variantId
    ? getSelectedVariant(product, variantId, { preferInStock: false })
    : null;
  const basePricing = normalizeBasePricing(product);

  if (variantId && !selectedVariant) {
    return null;
  }

  const baseItem = {
    id: baseProductId,
    originalId: baseProductId,
    name: product?.name,
    image_url: product?.image_url,
    price: basePricing.selectedPrice,
    mrp: basePricing.hasMrp ? basePricing.mrp : null,
    discount_percent: basePricing.discountPercent,
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
    mrp: selectedVariant.hasMrp ? selectedVariant.mrp : null,
    discount_percent: selectedVariant.discountPercent,
    stock_quantity: parseIntegerValue(selectedVariant.stock_quantity, null),
  };
};

export const getCartItemStock = (item) => parseIntegerValue(item?.stock_quantity, null);
