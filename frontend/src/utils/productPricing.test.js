import {
  buildCartItem,
  clampQuantityToStock,
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
        stock_quantity: 0,
        is_default: true,
        display_order: 0,
      },
      {
        id: 'variant-in-stock',
        variant_name: '250g',
        price: '900',
        stock_quantity: 4,
        is_default: false,
        display_order: 1,
      },
      {
        id: 'variant-premium',
        variant_name: '1kg',
        price: '1800',
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
    expect(pricing.minPrice).toBe(900);
    expect(pricing.maxPrice).toBe(1800);
    expect(pricing.hasPriceRange).toBe(true);
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
        stock_quantity: 2,
      })
    );
  });

  it('clamps quantities to known stock and leaves unknown stock untouched', () => {
    expect(clampQuantityToStock(5, 2)).toBe(2);
    expect(clampQuantityToStock(0, 2)).toBe(1);
    expect(clampQuantityToStock(5, null)).toBe(5);
  });
});
