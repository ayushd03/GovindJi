-- Migration 006: Add updated_at column to orders table
-- Created: 2026-01-17
-- Description: Adds updated_at timestamp column to track order modifications

-- Add updated_at column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create or replace trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists to avoid conflicts
DROP TRIGGER IF EXISTS trigger_update_orders_updated_at ON orders;

-- Create trigger to automatically update updated_at on any UPDATE
CREATE TRIGGER trigger_update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- Create index on updated_at for query performance
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at);

-- Add comment for documentation
COMMENT ON COLUMN orders.updated_at IS 'Timestamp of the last update to this order';
