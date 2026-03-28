-- Migration 008: Stock management RPC functions
-- Created: 2026-03-25
-- Description: Adds atomic stock decrement/restore functions used by order creation and cancellation

-- Decrement stock atomically, refusing to go below 0
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE products
    SET stock_quantity = GREATEST(stock_quantity - p_quantity, 0),
        updated_at = NOW()
    WHERE id = p_product_id;
END;
$$;

-- Restore stock atomically (used on order cancellation)
CREATE OR REPLACE FUNCTION restore_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE products
    SET stock_quantity = stock_quantity + p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;
END;
$$;
