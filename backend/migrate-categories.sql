-- Migration script to add new columns to existing categories table
-- Run this if you have an existing categories table

-- Add new columns to categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gradient_colors VARCHAR(255) DEFAULT 'from-gray-400 to-gray-600',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create category_images table if it doesn't exist
CREATE TABLE IF NOT EXISTS category_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type VARCHAR(10) DEFAULT 'url',
    sort_order INTEGER NOT NULL DEFAULT 0,
    alt_text VARCHAR(255),
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_category_images_category_sort ON category_images(category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_category_images_category_primary ON category_images(category_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order, is_active);

-- Update existing categories with default values
UPDATE categories 
SET 
    gradient_colors = CASE 
        WHEN name = 'Nuts' THEN 'from-amber-400 to-orange-500'
        WHEN name = 'Dried Fruits' THEN 'from-red-400 to-pink-500'
        WHEN name = 'Seeds' THEN 'from-green-400 to-emerald-500'
        WHEN name = 'Spices' THEN 'from-yellow-400 to-amber-500'
        WHEN name = 'Traditional Sweets' THEN 'from-purple-400 to-indigo-500'
        ELSE 'from-gray-400 to-gray-600'
    END,
    display_order = CASE 
        WHEN name = 'Nuts' THEN 1
        WHEN name = 'Dried Fruits' THEN 2
        WHEN name = 'Seeds' THEN 3
        WHEN name = 'Spices' THEN 4
        WHEN name = 'Traditional Sweets' THEN 5
        ELSE 999
    END,
    description = CASE 
        WHEN name = 'Nuts' THEN 'Premium quality nuts including almonds, cashews, and walnuts'
        WHEN name = 'Dried Fruits' THEN 'Natural dried fruits with no added preservatives'
        WHEN name = 'Seeds' THEN 'Nutritious seeds and kernels for healthy snacking'
        WHEN name = 'Spices' THEN 'Aromatic spices to enhance your culinary experience'
        WHEN name = 'Traditional Sweets' THEN 'Authentic traditional sweets and confections'
        ELSE 'Quality products for your needs'
    END,
    is_active = TRUE,
    updated_at = NOW()
WHERE gradient_colors IS NULL OR gradient_colors = '';