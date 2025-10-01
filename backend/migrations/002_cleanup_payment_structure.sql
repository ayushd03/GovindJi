-- Migration: Cleanup and consolidate payment structure
-- Description: Remove JSONB columns, consolidate payment columns, make party_payments the single source of truth

-- =====================================================
-- STEP 1: Update party_payments table structure
-- =====================================================

-- Add new consolidated columns
ALTER TABLE party_payments
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20), -- 'cash', 'upi', 'cheque'
ADD COLUMN IF NOT EXISTS release_date DATE; -- For cheques, when it should be cleared

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_party_payments_payment_method ON party_payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_party_payments_release_date ON party_payments(release_date) WHERE payment_method = 'cheque';
CREATE INDEX IF NOT EXISTS idx_party_payments_payment_date ON party_payments(payment_date);

-- Migrate existing data from transaction_fields JSONB to proper columns
-- This will populate payment_method from transaction_type_id and extract details from transaction_fields
UPDATE party_payments
SET
  payment_method = transaction_type_id,
  release_date = CASE
    WHEN transaction_type_id = 'cheque' AND transaction_fields ? 'release_date'
    THEN (transaction_fields->>'release_date')::DATE
    ELSE NULL
  END,
  reference_number = CASE
    -- If reference_number already exists, keep it
    WHEN reference_number IS NOT NULL AND reference_number != '' THEN reference_number
    -- For UPI, try to extract from transaction_fields
    WHEN transaction_type_id = 'upi' AND transaction_fields ? 'reference_number'
    THEN transaction_fields->>'reference_number'
    -- For cheques with cheque_number in transaction_fields
    WHEN transaction_type_id = 'cheque' AND transaction_fields ? 'cheque_number'
    THEN transaction_fields->>'cheque_number'
    -- Otherwise use existing cheque_number or upi_transaction_id
    WHEN cheque_number IS NOT NULL THEN cheque_number
    WHEN upi_transaction_id IS NOT NULL THEN upi_transaction_id
    ELSE NULL
  END,
  cheque_date = CASE
    WHEN transaction_type_id = 'cheque' AND transaction_fields ? 'release_date'
    THEN (transaction_fields->>'release_date')::DATE
    ELSE cheque_date
  END
WHERE payment_method IS NULL OR release_date IS NULL;

-- Make payment_method NOT NULL after data migration
ALTER TABLE party_payments
ALTER COLUMN payment_method SET NOT NULL;

-- Drop redundant columns after data migration
-- IMPORTANT: Only run this after verifying data migration is successful
-- Uncomment the following lines when ready:
-- ALTER TABLE party_payments DROP COLUMN IF EXISTS transaction_type_id;
-- ALTER TABLE party_payments DROP COLUMN IF EXISTS transaction_fields;
-- ALTER TABLE party_payments DROP COLUMN IF EXISTS cheque_number;
-- ALTER TABLE party_payments DROP COLUMN IF EXISTS upi_transaction_id;
-- ALTER TABLE party_payments DROP COLUMN IF EXISTS bank_name;
-- ALTER TABLE party_payments DROP COLUMN IF EXISTS purchase_bill_id;

-- =====================================================
-- STEP 2: Update expenses table to reference party_payments
-- =====================================================

-- Add foreign key to party_payments for payment tracking
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS party_payment_id UUID REFERENCES party_payments(id) ON DELETE SET NULL;

-- Create index for the foreign key
CREATE INDEX IF NOT EXISTS idx_expenses_party_payment_id ON expenses(party_payment_id);

-- For existing expenses with payment info, we'll need to create corresponding party_payment records
-- This will be done in the application code when an expense is created

-- Drop redundant columns from expenses (after migration)
-- IMPORTANT: Only run this after verifying all expenses have corresponding party_payment records
-- Uncomment the following lines when ready:
-- ALTER TABLE expenses DROP COLUMN IF EXISTS transaction_type_id;
-- ALTER TABLE expenses DROP COLUMN IF EXISTS transaction_fields;

-- =====================================================
-- STEP 3: Update unified_transactions table
-- =====================================================

-- Add reference to party_payments for tracking payment details
ALTER TABLE unified_transactions
ADD COLUMN IF NOT EXISTS party_payment_id UUID REFERENCES party_payments(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_unified_transactions_party_payment_id ON unified_transactions(party_payment_id);

-- Drop redundant payment_method JSONB column (after migration)
-- IMPORTANT: Only run this after verifying data migration
-- Uncomment when ready:
-- ALTER TABLE unified_transactions DROP COLUMN IF EXISTS payment_method;

-- =====================================================
-- STEP 4: Add comments for documentation
-- =====================================================

COMMENT ON COLUMN party_payments.payment_method IS 'Payment method: cash, upi, or cheque';
COMMENT ON COLUMN party_payments.reference_number IS 'Universal reference number - UPI transaction ID for UPI payments, cheque number for cheques, receipt number for cash';
COMMENT ON COLUMN party_payments.release_date IS 'For cheques only - the date when the cheque should be cleared/released';
COMMENT ON COLUMN expenses.party_payment_id IS 'References the party_payments table for payment tracking';
COMMENT ON COLUMN unified_transactions.party_payment_id IS 'References the party_payments table for payment tracking';

-- =====================================================
-- STEP 5: Create view for upcoming cheque clearances
-- =====================================================

CREATE OR REPLACE VIEW upcoming_cheque_clearances AS
SELECT
  pp.id,
  pp.party_id,
  p.name as party_name,
  pp.amount,
  pp.reference_number as cheque_number,
  pp.release_date,
  pp.payment_date,
  pp.notes,
  CASE
    WHEN pp.release_date = CURRENT_DATE THEN 'Due Today'
    WHEN pp.release_date = CURRENT_DATE + INTERVAL '1 day' THEN 'Due Tomorrow'
    WHEN pp.release_date <= CURRENT_DATE + INTERVAL '3 days' THEN 'Due in 3 days'
    ELSE 'Future'
  END as urgency,
  pp.release_date - CURRENT_DATE as days_until_clearance
FROM party_payments pp
JOIN parties p ON pp.party_id = p.id
WHERE pp.payment_method = 'cheque'
  AND pp.release_date >= CURRENT_DATE
ORDER BY pp.release_date ASC;

COMMENT ON VIEW upcoming_cheque_clearances IS 'Shows all upcoming cheque clearances with urgency indicators';

-- =====================================================
-- STEP 6: Create function to get cheques due in N days
-- =====================================================

CREATE OR REPLACE FUNCTION get_cheques_due_in_days(days_ahead INTEGER DEFAULT 3)
RETURNS TABLE (
  id UUID,
  party_id UUID,
  party_name VARCHAR,
  amount DECIMAL,
  cheque_number VARCHAR,
  release_date DATE,
  payment_date DATE,
  notes TEXT,
  days_until_clearance INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id,
    pp.party_id,
    p.name as party_name,
    pp.amount,
    pp.reference_number as cheque_number,
    pp.release_date,
    pp.payment_date,
    pp.notes,
    (pp.release_date - CURRENT_DATE)::INTEGER as days_until_clearance
  FROM party_payments pp
  JOIN parties p ON pp.party_id = p.id
  WHERE pp.payment_method = 'cheque'
    AND pp.release_date BETWEEN CURRENT_DATE AND CURRENT_DATE + days_ahead
  ORDER BY pp.release_date ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_cheques_due_in_days IS 'Returns all cheques that need to be cleared within the specified number of days';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
