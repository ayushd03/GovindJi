-- Migration 012: Add pickup recovery metadata for manifested shipments
-- Created: 2026-03-28
-- Description: Tracks pickup retry state and links shipments to pickup requests

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS pickup_request_id UUID
    REFERENCES pickup_requests(id) ON DELETE SET NULL;

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS pickup_last_attempt_at TIMESTAMP;

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS pickup_error TEXT;

CREATE INDEX IF NOT EXISTS idx_shipments_pickup_request_id
  ON shipments(pickup_request_id);

CREATE INDEX IF NOT EXISTS idx_shipments_pickup_pending
  ON shipments(status, pickup_scheduled_date, pickup_request_id);

COMMENT ON COLUMN shipments.pickup_request_id IS
  'The pickup request that this shipment has been attached to.';

COMMENT ON COLUMN shipments.pickup_last_attempt_at IS
  'When the system last tried to schedule a pickup for this shipment.';

COMMENT ON COLUMN shipments.pickup_error IS
  'Last pickup scheduling error recorded for this shipment.';
