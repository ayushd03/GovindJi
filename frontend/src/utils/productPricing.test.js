import {
  buildCartItem,
  clampQuantityToStock,
  formatDiscountPercent,
  getComparableProductPrice,
  getProductPricing,
  getSelectedVariant,
} from './productPricing';

describe('productPricing', () => {
  const product = {
    id: 'product-1',
    price: '900',
    stock_quantity: 9,
    variants: [
      {
        id: 'variant-default-out-of-stock',
        variant_name: '500g',
        price: '1000',
        mrp: '1250',
        stock_quantity: 0,
        is_default: true,
        display_order: 0,
      },
      {
        id: 'variant-in-stock',
        variant_name: '250g',
        price: '900',
        mrp: '1000',
        stock_quantity: 4,
        is_default: false,
        display_order: 1,
      },
      {
        id: 'variant-premium',
        variant_name: '1kg',
        price: '1800',
        mrp: '2200',
        stock_quantity: 2,
        is_default: false,
        display_order: 2,
      },
    ],
  };

  it('prefers an in-stock variant over an out-of-stock default for customer display', () => {
    expect(getSelectedVariant(product)?.id).toBe('variant-in-stock');
  });

  it('derives price ranges from variant prices for listing and filtering', () => {
    const pricing = getProductPricing(product);

    expect(pricing.hasVariants).toBe(true);
    expect(pricing.selectedVariant?.id).toBe('variant-in-stock');
    expect(pricing.selectedPrice).toBe(900);
    expect(pricing.selectedMrp).toBe(1000);
    expect(pricing.discountPercent).toBe(10);
    expect(pricing.minPrice).toBe(900);
    expect(pricing.maxPrice).toBe(1800);
    expect(pricing.hasPriceRange).toBe(true);
    expect(pricing.displayMrp).toBe(1000);
    expect(pricing.displayDiscountPercent).toBe(10);
    expect(getComparableProductPrice(product)).toBe(900);
  });

  it('builds cart items from the chosen variant price and stock', () => {
    expect(buildCartItem(product, 'variant-premium')).toEqual(
      expect.objectContaining({
        id: 'product-1-variant-premium',
        originalId: 'product-1',
        variant_id: 'variant-premium',
        size: '1kg',
        price: 1800,
        mrp: 2200,
        discount_percent: 18.2,
        stock_quantity: 2,
      })
    );
  });

  it('keeps product-level MRP and discount metadata for non-variant products', () => {
    const nonVariantPricing = getProductPricing({
      id: 'product-2',
      price: '450',
      mrp: '500',
      discount: 10,
      stock_quantity: 3,
    });

    expect(nonVariantPricing.hasVariants).toBe(false);
    expect(nonVariantPricing.selectedPrice).toBe(450);
    expect(nonVariantPricing.selectedMrp).toBe(500);
    expect(nonVariantPricing.discountPercent).toBe(10);
    expect(nonVariantPricing.hasMrp).toBe(true);
  });

  it('falls back to an explicit percentage discount when mrp is absent', () => {
    const nonVariantPricing = getProductPricing({
      id: 'product-3',
      price: '450',
      discount_type: 'percentage',
      discount_on_sale_price: 12.5,
      stock_quantity: 3,
    });

    expect(nonVariantPricing.hasVariants).toBe(false);
    expect(nonVariantPricing.selectedPrice).toBe(450);
    expect(nonVariantPricing.selectedMrp).toBe(0);
    expect(nonVariantPricing.discountPercent).toBe(12.5);
    expect(nonVariantPricing.hasMrp).toBe(false);
  });

  it('does not reinterpret fixed-amount discounts as percentages', () => {
    const nonVariantPricing = getProductPricing({
      id: 'product-4',
      price: '450',
      discount_type: 'amount',
      discount_on_sale_price: 50,
      stock_quantity: 3,
    });

    expect(nonVariantPricing.discountPercent).toBe(0);
    expect(nonVariantPricing.hasMrp).toBe(false);
  });

  it('clamps quantities to known stock and leaves unknown stock untouched', () => {
    expect(clampQuantityToStock(5, 2)).toBe(2);
    expect(clampQuantityToStock(0, 2)).toBe(1);
    expect(clampQuantityToStock(5, null)).toBe(5);
  });

  it('formats discount percentages without unnecessary decimals', () => {
    expect(formatDiscountPercent(10)).toBe('10');
    expect(formatDiscountPercent(18.2)).toBe('18.2');
  });
});
