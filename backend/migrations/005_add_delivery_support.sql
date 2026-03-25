-- Migration 005: Add Delivery/Shipment Support for Delhivery Integration
-- Created: 2026-01-17
-- Description: Adds tables for shipment tracking, delivery status, and pickup scheduling

-- Table 1: Shipments
-- Stores shipment information created via Delhivery API
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Delhivery identifiers
  awb_number VARCHAR(50) UNIQUE NOT NULL,
  upload_wbn VARCHAR(50),              -- Bulk upload reference from Delhivery

  -- Shipment details
  courier_provider VARCHAR(50) DEFAULT 'DELHIVERY',
  shipping_mode VARCHAR(20),            -- Surface/Express
  payment_mode VARCHAR(20),             -- Prepaid/COD

  -- Status tracking
  status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PICKUP_SCHEDULED, MANIFESTED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RTO, CANCELLED
  current_location VARCHAR(255),
  last_scan_status VARCHAR(100),
  last_scan_datetime TIMESTAMP,

  -- Delivery information
  pickup_scheduled_date DATE,
  pickup_scheduled_time TIME,
  estimated_delivery_date DATE,
  actual_delivery_date TIMESTAMP,

  -- Physical details
  weight_grams INTEGER,
  dimensions_length DECIMAL(10,2),
  dimensions_width DECIMAL(10,2),
  dimensions_height DECIMAL(10,2),

  -- Financial
  freight_charges DECIMAL(10,2),
  cod_amount DECIMAL(10,2),

  -- API responses (for debugging/audit)
  delhivery_response JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for shipments table
CREATE INDEX idx_shipments_order_id ON shipments(order_id);
CREATE INDEX idx_shipments_awb ON shipments(awb_number);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_created_at ON shipments(created_at);

-- Table 2: Shipment Tracking Events
-- Stores all status updates received from Delhivery webhooks
CREATE TABLE IF NOT EXISTS shipment_tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,

  -- Event details
  status VARCHAR(100) NOT NULL,
  status_type VARCHAR(10),              -- UD, OFD, DL, RTO, etc.
  location VARCHAR(255),
  scan_datetime TIMESTAMP NOT NULL,

  -- Additional info
  instructions TEXT,
  remarks TEXT,

  -- Webhook payload (full data for debugging)
  webhook_payload JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for tracking events table
CREATE INDEX idx_tracking_shipment_id ON shipment_tracking_events(shipment_id);
CREATE INDEX idx_tracking_scan_datetime ON shipment_tracking_events(scan_datetime);

-- Table 3: Pickup Requests
-- Stores scheduled pickup requests to Delhivery
CREATE TABLE IF NOT EXISTS pickup_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Pickup details
  pickup_location VARCHAR(255) NOT NULL,
  pickup_date DATE NOT NULL,
  pickup_time TIME NOT NULL,
  expected_package_count INTEGER NOT NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'SCHEDULED',  -- SCHEDULED, PICKED_UP, FAILED, CANCELLED
  delhivery_pickup_id VARCHAR(100),

  -- Response data
  delhivery_response JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for pickup requests
CREATE INDEX idx_pickup_requests_date ON pickup_requests(pickup_date);
CREATE INDEX idx_pickup_requests_status ON pickup_requests(status);

-- Update orders table to track shipment association
ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_shipment BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- Add weight column to products table (required for shipment creation)
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_grams INTEGER;

-- Set default weight for existing products (250g as example - should be updated by admin)
UPDATE products SET weight_grams = 250 WHERE weight_grams IS NULL;

-- Add comment to document the migration
COMMENT ON TABLE shipments IS 'Stores shipment information for orders created via Delhivery API';
COMMENT ON TABLE shipment_tracking_events IS 'Stores all delivery status updates received from Delhivery webhooks';
COMMENT ON TABLE pickup_requests IS 'Stores scheduled pickup requests sent to Delhivery';
