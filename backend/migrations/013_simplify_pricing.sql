-- Migration 013: Simplify pricing model for products and variants
-- Created: 2026-03-29
-- Description:
--   1. Add explicit MRP support to products and product_variants
--   2. Add cached discount_percent to product_variants
--   3. Add optional variant_id to wholesale_prices for per-variant tiers
--   4. Backfill MRP from legacy percentage discounts where possible

BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS mrp DECIMAL(10,2);

COMMENT ON COLUMN products.mrp IS
  'Explicit original price / MRP for non-variant products. NULL means no MRP display.';

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS mrp DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN product_variants.mrp IS
  'Explicit original price / MRP for this variant. NULL means no MRP display.';

COMMENT ON COLUMN product_variants.discount_percent IS
  'Cached percentage discount derived from mrp and price for storefront display.';

ALTER TABLE wholesale_prices
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;

COMMENT ON COLUMN wholesale_prices.variant_id IS
  'Optional variant scope for wholesale tiers. NULL means the tier applies at product level.';

CREATE INDEX IF NOT EXISTS idx_product_variants_mrp
  ON product_variants(mrp);

CREATE INDEX IF NOT EXISTS idx_wholesale_prices_variant_id
  ON wholesale_prices(variant_id);

-- Backfill non-variant product MRP from the legacy product-level percentage discount.
UPDATE products
SET mrp = ROUND(
  price / NULLIF(1 - (discount_on_sale_price / 100.0), 0),
  2
)
WHERE mrp IS NULL
  AND COALESCE(discount_type, 'percentage') = 'percentage'
  AND COALESCE(discount_on_sale_price, 0) > 0
  AND COALESCE(discount_on_sale_price, 0) < 100
  AND NOT EXISTS (
    SELECT 1
    FROM product_variants
    WHERE product_variants.product_id = products.id
  );

-- Backfill the default variant MRP from the legacy product-level percentage discount.
UPDATE product_variants AS pv
SET mrp = ROUND(
  pv.price / NULLIF(1 - (p.discount_on_sale_price / 100.0), 0),
  2
)
FROM products AS p
WHERE pv.product_id = p.id
  AND pv.id = (
    SELECT pv2.id
    FROM product_variants AS pv2
    WHERE pv2.product_id = p.id
    ORDER BY pv2.is_default DESC, pv2.display_order ASC
    LIMIT 1
  )
  AND pv.mrp IS NULL
  AND COALESCE(p.discount_type, 'percentage') = 'percentage'
  AND COALESCE(p.discount_on_sale_price, 0) > 0
  AND COALESCE(p.discount_on_sale_price, 0) < 100;

-- Sync product MRP from the default variant when variants exist.
WITH default_variant_mrp AS (
  SELECT DISTINCT ON (product_id)
    product_id,
    mrp
  FROM product_variants
  WHERE mrp IS NOT NULL
  ORDER BY product_id, is_default DESC, display_order ASC
)
UPDATE products AS p
SET mrp = default_variant_mrp.mrp
FROM default_variant_mrp
WHERE p.id = default_variant_mrp.product_id
  AND p.mrp IS NULL;

-- Recompute cached variant discount percentages.
UPDATE product_variants
SET discount_percent = CASE
  WHEN mrp IS NOT NULL AND mrp > price
    THEN ROUND(((mrp - price) / mrp) * 100, 1)
  ELSE 0
END;

-- Align product legacy discount cache with explicit MRP where available.
UPDATE products
SET
  discount_on_sale_price = CASE
    WHEN mrp IS NOT NULL AND mrp > price
      THEN ROUND(((mrp - price) / mrp) * 100, 1)
    ELSE COALESCE(discount_on_sale_price, 0)
  END,
  discount_type = 'percentage'
WHERE mrp IS NOT NULL;

COMMIT;
