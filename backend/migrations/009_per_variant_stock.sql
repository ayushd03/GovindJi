-- Migration 009: Per-variant stock tracking + atomic stock functions
-- Created: 2026-03-26
-- Description:
--   1. Adds stock_quantity to product_variants so each size tracks its own inventory
--   2. Backfills existing product stock into the default (or first) variant
--   3. Adds a trigger to keep products.stock_quantity in sync as the sum of active variants
--   4. Replaces decrement_stock / restore_stock with variant-aware, boolean-returning versions
--   5. Adds variant_id to stock_movements for a full audit trail

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add stock_quantity to product_variants
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN product_variants.stock_quantity IS
  'Units of this specific variant currently in stock. '
  'For variant products, products.stock_quantity is kept in sync via trigger.';

CREATE INDEX IF NOT EXISTS idx_product_variants_stock
  ON product_variants(stock_quantity);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill: move existing product-level stock into the default/first variant
--    Only runs for products that already have variants (otherwise stock stays
--    on the product row untouched, which is correct for non-variant products).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE product_variants AS pv
SET stock_quantity = p.stock_quantity
FROM products p
WHERE pv.product_id = p.id
  AND p.stock_quantity > 0
  AND pv.id = (
      SELECT id
      FROM product_variants pv2
      WHERE pv2.product_id = p.id
      ORDER BY pv2.is_default DESC, pv2.display_order ASC
      LIMIT 1
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Sync trigger: keep products.stock_quantity = SUM(active variant stocks)
--    Fires after any INSERT, UPDATE (to stock_quantity or is_active), or DELETE
--    on product_variants. Only applies to products that have at least one
--    variant row — products without variants are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_product_stock_from_variants()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_product_id UUID;
  v_has_variants BOOLEAN;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  -- Only sync if this product actually has variants (guards non-variant products)
  SELECT EXISTS (
    SELECT 1 FROM product_variants WHERE product_id = v_product_id
  ) INTO v_has_variants;

  IF v_has_variants THEN
    UPDATE products
    SET
      stock_quantity = COALESCE((
        SELECT SUM(stock_quantity)
        FROM product_variants
        WHERE product_id = v_product_id
          AND is_active = true
      ), 0),
      updated_at = NOW()
    WHERE id = v_product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_product_stock ON product_variants;

CREATE TRIGGER trigger_sync_product_stock
  AFTER INSERT OR UPDATE OF stock_quantity, is_active OR DELETE
  ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_stock_from_variants();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4a. Replace decrement_stock with variant-aware, race-condition-safe version
--
--   Returns TRUE  → stock decremented successfully
--   Returns FALSE → insufficient stock (caller should treat order as failed)
--
--   With p_variant_id:   decrements product_variants.stock_quantity atomically
--                        using WHERE stock_quantity >= p_quantity — no silent
--                        clipping to 0. The sync trigger updates the product total.
--   Without p_variant_id: decrements products.stock_quantity directly
--                         (non-variant products).
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS decrement_stock(UUID, INTEGER);

CREATE OR REPLACE FUNCTION decrement_stock(
  p_product_id UUID,
  p_quantity   INTEGER,
  p_variant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants
    SET stock_quantity = stock_quantity - p_quantity
    WHERE id            = p_variant_id
      AND product_id    = p_product_id
      AND stock_quantity >= p_quantity;
    -- Trigger fires automatically to sync products.stock_quantity
  ELSE
    UPDATE products
    SET stock_quantity = stock_quantity - p_quantity,
        updated_at     = NOW()
    WHERE id            = p_product_id
      AND stock_quantity >= p_quantity;
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4b. Replace restore_stock with variant-aware version
--
--   Returns TRUE  → stock restored
--   Returns FALSE → row not found (should not happen in normal operation)
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS restore_stock(UUID, INTEGER);

CREATE OR REPLACE FUNCTION restore_stock(
  p_product_id UUID,
  p_quantity   INTEGER,
  p_variant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants
    SET stock_quantity = stock_quantity + p_quantity
    WHERE id         = p_variant_id
      AND product_id = p_product_id;
    -- Trigger fires automatically to sync products.stock_quantity
  ELSE
    UPDATE products
    SET stock_quantity = stock_quantity + p_quantity,
        updated_at     = NOW()
    WHERE id = p_product_id;
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Add variant_id to stock_movements for full per-variant audit trail
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS variant_id UUID
    REFERENCES product_variants(id) ON DELETE SET NULL;

COMMENT ON COLUMN stock_movements.variant_id IS
  'Which variant this movement applies to. NULL for non-variant products.';

COMMIT;
