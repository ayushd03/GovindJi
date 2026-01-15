-- Migration: Add payment support for PhonePe integration
-- Created: 2025-01-30
-- Description: Adds payment_transactions table and updates orders table with payment fields

BEGIN;

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_transaction_id VARCHAR(100) UNIQUE NOT NULL,  -- Our internal transaction ID

  -- Relationships
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) NOT NULL,

  -- Payment Details
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  payment_method VARCHAR(50) DEFAULT 'PHONEPE',  -- 'PHONEPE', 'RAZORPAY', 'COD', etc.

  -- Status Tracking
  status VARCHAR(20) DEFAULT 'INITIATED',  -- INITIATED, PENDING, COMPLETED, FAILED, CANCELLED, EXPIRED

  -- PhonePe Specific Fields
  phonepe_transaction_id VARCHAR(100),  -- PhonePe's transaction ID (from callback)
  phonepe_merchant_id VARCHAR(100),     -- PhonePe merchant ID used

  -- URLs
  redirect_url TEXT,
  callback_url TEXT,

  -- Metadata
  payment_response JSONB,  -- Full PhonePe response for debugging
  callback_response JSONB, -- Full callback payload
  error_details JSONB,     -- Error information if failed

  -- Timestamps
  initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for performance
  CONSTRAINT valid_status CHECK (status IN ('INITIATED', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'))
);

-- Modify orders table - add payment-related columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'COD';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;  -- Store complete shipping info
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);

-- Add constraint for payment_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_payment_status'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT valid_payment_status
      CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED'));
  END IF;
END$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_merchant_tx_id ON payment_transactions(merchant_transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);

COMMIT;
