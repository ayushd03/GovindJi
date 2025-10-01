-- Migration: Create product_variants table
-- Description: Store different size/weight variants for products with individual pricing

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name VARCHAR(100) NOT NULL, -- e.g., "500g Packet", "1kg Pack"
  size_value DECIMAL(10,3) NOT NULL, -- e.g., 500, 1, 2
  size_unit VARCHAR(20) NOT NULL, -- e.g., "GRAMS", "KILOGRAMS", "PIECES"
  price DECIMAL(10,2) NOT NULL, -- Selling price for this variant
  sku VARCHAR(100), -- Optional variant-specific SKU
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Mark one variant as default
  display_order INTEGER DEFAULT 0, -- For sorting variants in display
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_variants_display_order ON product_variants(display_order);

-- Create composite index for efficient querying
CREATE INDEX IF NOT EXISTS idx_product_variants_product_active
  ON product_variants(product_id, is_active, display_order);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_product_variants_updated_at();

-- Add constraint to ensure at least one variant per product
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_per_product
  ON product_variants(product_id)
  WHERE is_default = true;

-- Comments for documentation
COMMENT ON TABLE product_variants IS 'Stores different size/weight variants for products with individual pricing';
COMMENT ON COLUMN product_variants.variant_name IS 'Display name for the variant (e.g., "500g Packet")';
COMMENT ON COLUMN product_variants.size_value IS 'Numeric value of the size (e.g., 500 for 500g)';
COMMENT ON COLUMN product_variants.size_unit IS 'Unit of measurement (GRAMS, KILOGRAMS, PIECES, etc.)';
COMMENT ON COLUMN product_variants.price IS 'Selling price for this specific variant';
COMMENT ON COLUMN product_variants.is_default IS 'Whether this variant should be selected by default';
COMMENT ON COLUMN product_variants.display_order IS 'Order in which variants should be displayed (lower numbers first)';
