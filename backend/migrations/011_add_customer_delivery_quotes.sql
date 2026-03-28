-- Migration 011: Add customer-facing delivery quotes and order delivery snapshots
-- Created: 2026-03-28
-- Description: Stores delivery pricing / ETA defaults and persists the customer-selected delivery mode on orders

BEGIN;

ALTER TABLE delivery_settings
  ADD COLUMN IF NOT EXISTS free_shipping_threshold DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surface_delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS express_delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS surface_min_delivery_days INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS surface_max_delivery_days INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS express_min_delivery_days INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS express_max_delivery_days INTEGER NOT NULL DEFAULT 2;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(20) NOT NULL DEFAULT 'Surface',
  ADD COLUMN IF NOT EXISTS delivery_quote JSONB;

UPDATE orders
SET
  subtotal_amount = COALESCE(subtotal_amount, total_amount),
  shipping_fee = COALESCE(shipping_fee, 0),
  delivery_mode = COALESCE(NULLIF(delivery_mode, ''), 'Surface')
WHERE subtotal_amount IS NULL
   OR shipping_fee IS NULL
   OR delivery_mode IS NULL
   OR delivery_mode = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_order_delivery_mode'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT valid_order_delivery_mode
      CHECK (delivery_mode IN ('Surface', 'Express'));
  END IF;
END $$;

COMMENT ON COLUMN delivery_settings.free_shipping_threshold IS 'Surface delivery becomes free when the order subtotal reaches this amount.';
COMMENT ON COLUMN delivery_settings.surface_delivery_fee IS 'Base delivery fee for normal / surface shipping.';
COMMENT ON COLUMN delivery_settings.express_delivery_fee IS 'Base delivery fee for express shipping.';
COMMENT ON COLUMN orders.delivery_quote IS 'Snapshot of the customer-visible delivery quote that was selected at checkout.';

COMMIT;
