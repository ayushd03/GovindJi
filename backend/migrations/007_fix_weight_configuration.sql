-- Migration 007: Fix Weight Configuration for Delhivery Integration
-- Purpose: Add missing weight fields and populate existing data to fix "weight NA" issue
-- Date: 2026-01-17

BEGIN;

-- ============================================================================
-- 1. ADD MISSING COLUMNS
-- ============================================================================

-- Add weight_grams to product_variants table
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS weight_grams INTEGER;

COMMENT ON COLUMN product_variants.weight_grams IS
'Weight in grams for shipping purposes. Auto-calculated for GRAMS/KILOGRAMS units, manually entered for others.';

-- Add variant_id to order_items table to track which variant was ordered
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS variant_id UUID;

COMMENT ON COLUMN order_items.variant_id IS
'References the specific product variant that was ordered. NULL if base product was ordered.';

-- ============================================================================
-- 2. ADD CONSTRAINTS AND INDEXES
-- ============================================================================

-- Add foreign key constraint for variant_id
ALTER TABLE order_items
DROP CONSTRAINT IF EXISTS fk_order_items_variant;

ALTER TABLE order_items
ADD CONSTRAINT fk_order_items_variant
FOREIGN KEY (variant_id)
REFERENCES product_variants(id)
ON DELETE SET NULL;

-- Add index for performance on variant_id lookups
CREATE INDEX IF NOT EXISTS idx_order_items_variant
ON order_items(variant_id);

-- Add index on product_variants.weight_grams for filtering
CREATE INDEX IF NOT EXISTS idx_product_variants_weight
ON product_variants(weight_grams);

-- Add index on products.weight_grams for filtering
CREATE INDEX IF NOT EXISTS idx_products_weight
ON products(weight_grams);

-- ============================================================================
-- 3. POPULATE EXISTING PRODUCT WEIGHTS
-- ============================================================================

-- Update existing products: convert weight to weight_grams based on unit
-- This handles products that were created before weight_grams was enforced
UPDATE products
SET weight_grams = CASE
  -- Kilogram units (various formats)
  WHEN LOWER(unit) IN ('kg', 'kilograms', 'kilogram') THEN
    ROUND(COALESCE(weight, 0) * 1000)::INTEGER

  -- Gram units (various formats)
  WHEN LOWER(unit) IN ('g', 'grams', 'gram') THEN
    ROUND(COALESCE(weight, 0))::INTEGER

  -- Heuristic: if weight is small (< 100), likely in kg; if large, likely in grams
  WHEN weight > 0 AND weight < 100 THEN
    ROUND(weight * 1000)::INTEGER

  WHEN weight >= 100 THEN
    ROUND(weight)::INTEGER

  -- Default fallback for products with no weight specified
  ELSE 250
END
WHERE weight_grams IS NULL OR weight_grams = 0;

-- ============================================================================
-- 4. POPULATE EXISTING VARIANT WEIGHTS
-- ============================================================================

-- Update existing variants: auto-calculate weight from size_value and size_unit
UPDATE product_variants
SET weight_grams = CASE
  -- Direct weight units - use size_value as weight
  WHEN size_unit = 'GRAMS' THEN
    ROUND(size_value)::INTEGER

  WHEN size_unit = 'KILOGRAMS' THEN
    ROUND(size_value * 1000)::INTEGER

  -- For non-weight units (PIECES, LITERS, etc.), inherit from parent product
  -- This is a temporary fallback - admin should configure proper weights
  ELSE (
    SELECT COALESCE(p.weight_grams, 250)
    FROM products p
    WHERE p.id = product_variants.product_id
  )
END
WHERE weight_grams IS NULL OR weight_grams = 0;

-- ============================================================================
-- 5. CREATE AUDIT VIEWS FOR MONITORING
-- ============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS v_product_weight_audit;

-- Create view to audit product weight configuration
CREATE VIEW v_product_weight_audit AS
SELECT
  p.id,
  p.name,
  p.unit,
  p.weight as display_weight,
  p.weight_grams,
  CASE
    WHEN p.weight_grams IS NULL OR p.weight_grams = 0 THEN 'MISSING'
    WHEN p.weight_grams = 250 THEN 'DEFAULT'
    WHEN p.weight_grams < 50 THEN 'SUSPICIOUS_LOW'
    WHEN p.weight_grams > 50000 THEN 'SUSPICIOUS_HIGH'
    ELSE 'CONFIGURED'
  END as weight_status,
  COUNT(pv.id) as variant_count,
  COUNT(CASE WHEN pv.weight_grams IS NULL OR pv.weight_grams = 0 THEN 1 END) as variants_missing_weight,
  COUNT(CASE WHEN pv.weight_grams = 250 THEN 1 END) as variants_with_default_weight,
  p.created_at,
  p.updated_at
FROM products p
LEFT JOIN product_variants pv ON pv.product_id = p.id
GROUP BY p.id, p.name, p.unit, p.weight, p.weight_grams, p.created_at, p.updated_at;

COMMENT ON VIEW v_product_weight_audit IS
'Audit view to identify products with missing, default, or suspicious weight values';

-- Create view to audit variant weight configuration
DROP VIEW IF EXISTS v_variant_weight_audit;

CREATE VIEW v_variant_weight_audit AS
SELECT
  pv.id,
  pv.variant_name,
  pv.size_value,
  pv.size_unit,
  pv.weight_grams,
  p.name as product_name,
  p.weight_grams as product_weight_grams,
  CASE
    WHEN pv.weight_grams IS NULL OR pv.weight_grams = 0 THEN 'MISSING'
    WHEN pv.weight_grams = 250 THEN 'DEFAULT'
    WHEN pv.size_unit IN ('GRAMS', 'KILOGRAMS') AND pv.weight_grams != ROUND(
      CASE
        WHEN pv.size_unit = 'GRAMS' THEN pv.size_value
        WHEN pv.size_unit = 'KILOGRAMS' THEN pv.size_value * 1000
      END
    ) THEN 'MISMATCH'
    WHEN pv.weight_grams < 50 THEN 'SUSPICIOUS_LOW'
    WHEN pv.weight_grams > 50000 THEN 'SUSPICIOUS_HIGH'
    ELSE 'CONFIGURED'
  END as weight_status,
  pv.is_active,
  pv.created_at
FROM product_variants pv
JOIN products p ON p.id = pv.product_id;

COMMENT ON VIEW v_variant_weight_audit IS
'Audit view to identify variants with missing, mismatched, or suspicious weight values';

-- Create view for shipment weight analysis
DROP VIEW IF EXISTS v_shipment_weight_analysis;

CREATE VIEW v_shipment_weight_analysis AS
SELECT
  o.id as order_id,
  o.created_at as order_date,
  o.status as order_status,
  s.id as shipment_id,
  s.awb_number,
  s.weight_grams as recorded_weight_grams,
  -- Calculate actual weight from order items
  (
    SELECT COALESCE(SUM(
      COALESCE(
        pv.weight_grams,  -- Try variant weight first
        p.weight_grams,   -- Fall back to product weight
        250               -- Last resort default
      ) * oi.quantity
    ), 0)
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN product_variants pv ON pv.id = oi.variant_id
    WHERE oi.order_id = o.id
  ) as calculated_weight_grams,
  -- Weight status
  CASE
    WHEN s.weight_grams IS NULL THEN 'NO_SHIPMENT'
    WHEN s.weight_grams = 0 THEN 'ZERO_WEIGHT'
    WHEN s.weight_grams = 250 THEN 'DEFAULT_WEIGHT'
    ELSE 'HAS_WEIGHT'
  END as weight_status,
  s.created_at as shipment_date
FROM orders o
LEFT JOIN shipments s ON s.order_id = o.id;

COMMENT ON VIEW v_shipment_weight_analysis IS
'Analysis view to compare recorded shipment weights vs calculated weights from order items';

-- ============================================================================
-- 6. LOG MIGRATION RESULTS
-- ============================================================================

DO $$
DECLARE
  zero_weight_products INTEGER;
  zero_weight_variants INTEGER;
  default_weight_products INTEGER;
  default_weight_variants INTEGER;
  total_products INTEGER;
  total_variants INTEGER;
BEGIN
  -- Count products with issues
  SELECT COUNT(*) INTO total_products FROM products;
  SELECT COUNT(*) INTO zero_weight_products FROM products WHERE weight_grams = 0 OR weight_grams IS NULL;
  SELECT COUNT(*) INTO default_weight_products FROM products WHERE weight_grams = 250;

  -- Count variants with issues
  SELECT COUNT(*) INTO total_variants FROM product_variants;
  SELECT COUNT(*) INTO zero_weight_variants FROM product_variants WHERE weight_grams = 0 OR weight_grams IS NULL;
  SELECT COUNT(*) INTO default_weight_variants FROM product_variants WHERE weight_grams = 250;

  -- Log summary
  RAISE NOTICE '=== MIGRATION 007 COMPLETED ===';
  RAISE NOTICE 'Products: % total', total_products;
  RAISE NOTICE '  - % with zero/null weight (%.1f%%)', zero_weight_products, (zero_weight_products::FLOAT / NULLIF(total_products, 0) * 100);
  RAISE NOTICE '  - % with default 250g weight (%.1f%%)', default_weight_products, (default_weight_products::FLOAT / NULLIF(total_products, 0) * 100);

  RAISE NOTICE 'Variants: % total', total_variants;
  RAISE NOTICE '  - % with zero/null weight (%.1f%%)', zero_weight_variants, (zero_weight_variants::FLOAT / NULLIF(total_variants, 0) * 100);
  RAISE NOTICE '  - % with default 250g weight (%.1f%%)', default_weight_variants, (default_weight_variants::FLOAT / NULLIF(total_variants, 0) * 100);

  -- Warnings
  IF zero_weight_products > 0 THEN
    RAISE WARNING '⚠️  % products have zero or null weight_grams. Admin action required!', zero_weight_products;
  END IF;

  IF zero_weight_variants > 0 THEN
    RAISE WARNING '⚠️  % variants have zero or null weight_grams. Admin action required!', zero_weight_variants;
  END IF;

  IF default_weight_products > 0 THEN
    RAISE NOTICE 'ℹ️  % products using default 250g weight. Consider configuring actual weights.', default_weight_products;
  END IF;

  RAISE NOTICE '=== Use v_product_weight_audit and v_variant_weight_audit views to review weights ===';
END $$;

COMMIT;

-- ============================================================================
-- 7. HELPFUL QUERIES FOR POST-MIGRATION REVIEW
-- ============================================================================

-- Query to find products needing weight configuration
-- Uncomment to run after migration:
/*
SELECT * FROM v_product_weight_audit
WHERE weight_status IN ('MISSING', 'DEFAULT', 'SUSPICIOUS_LOW', 'SUSPICIOUS_HIGH')
ORDER BY
  CASE weight_status
    WHEN 'MISSING' THEN 1
    WHEN 'SUSPICIOUS_LOW' THEN 2
    WHEN 'DEFAULT' THEN 3
    WHEN 'SUSPICIOUS_HIGH' THEN 4
  END,
  name;
*/

-- Query to find variants needing weight configuration
/*
SELECT * FROM v_variant_weight_audit
WHERE weight_status IN ('MISSING', 'DEFAULT', 'MISMATCH', 'SUSPICIOUS_LOW', 'SUSPICIOUS_HIGH')
ORDER BY
  CASE weight_status
    WHEN 'MISSING' THEN 1
    WHEN 'MISMATCH' THEN 2
    WHEN 'SUSPICIOUS_LOW' THEN 3
    WHEN 'DEFAULT' THEN 4
    WHEN 'SUSPICIOUS_HIGH' THEN 5
  END,
  product_name, variant_name;
*/

-- Query to analyze shipment weights
/*
SELECT
  order_id,
  awb_number,
  recorded_weight_grams,
  calculated_weight_grams,
  (recorded_weight_grams - calculated_weight_grams) as weight_difference,
  weight_status
FROM v_shipment_weight_analysis
WHERE weight_status IN ('ZERO_WEIGHT', 'DEFAULT_WEIGHT')
   OR ABS(recorded_weight_grams - calculated_weight_grams) > 100
ORDER BY shipment_date DESC;
*/
