-- Migration 010: Add configurable Delhivery settings for store operations
-- Created: 2026-03-26
-- Description: Stores Delhivery automation, pickup-slot, and package defaults

CREATE TABLE IF NOT EXISTS delivery_settings (
  provider VARCHAR(50) PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_move_orders_to_processing BOOLEAN NOT NULL DEFAULT TRUE,
  auto_create_shipment BOOLEAN NOT NULL DEFAULT TRUE,
  auto_schedule_pickup BOOLEAN NOT NULL DEFAULT TRUE,
  pickup_location VARCHAR(255) NOT NULL DEFAULT 'Main Warehouse',
  pickup_time TIME NOT NULL DEFAULT '10:00:00',
  pickup_cutoff_time TIME NOT NULL DEFAULT '14:00:00',
  pickup_buffer_days INTEGER NOT NULL DEFAULT 0 CHECK (pickup_buffer_days >= 0 AND pickup_buffer_days <= 14),
  allow_same_day_pickup BOOLEAN NOT NULL DEFAULT TRUE,
  operating_days JSONB NOT NULL DEFAULT '["MON","TUE","WED","THU","FRI","SAT"]'::jsonb,
  shipping_mode VARCHAR(20) NOT NULL DEFAULT 'Surface',
  default_package_length DECIMAL(10,2) NOT NULL DEFAULT 20,
  default_package_width DECIMAL(10,2) NOT NULL DEFAULT 15,
  default_package_height DECIMAL(10,2) NOT NULL DEFAULT 15,
  updated_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO delivery_settings (
  provider,
  pickup_location
)
VALUES (
  'DELHIVERY',
  'Main Warehouse'
)
ON CONFLICT (provider) DO NOTHING;

COMMENT ON TABLE delivery_settings IS 'Operational defaults for courier integrations such as Delhivery';
