-- Migration 003: Add Missing Foreign Key Constraints
-- This fixes the relationship errors between tables

-- =====================================================
-- Add foreign key constraint for unified_transactions
-- =====================================================

-- Drop existing constraint if it exists (in case it was created incorrectly)
ALTER TABLE unified_transactions
DROP CONSTRAINT IF EXISTS unified_transactions_party_payment_id_fkey;

-- Add proper foreign key constraint
ALTER TABLE unified_transactions
ADD CONSTRAINT unified_transactions_party_payment_id_fkey
FOREIGN KEY (party_payment_id)
REFERENCES party_payments(id)
ON DELETE SET NULL;

-- =====================================================
-- Add foreign key constraint for expenses
-- =====================================================

-- Drop existing constraint if it exists
ALTER TABLE expenses
DROP CONSTRAINT IF EXISTS expenses_party_payment_id_fkey;

-- Add proper foreign key constraint
ALTER TABLE expenses
ADD CONSTRAINT expenses_party_payment_id_fkey
FOREIGN KEY (party_payment_id)
REFERENCES party_payments(id)
ON DELETE SET NULL;

-- =====================================================
-- Verify constraints were created
-- =====================================================

-- This query should return the foreign key constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('unified_transactions', 'expenses')
  AND kcu.column_name LIKE '%party_payment_id%';

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON CONSTRAINT unified_transactions_party_payment_id_fkey ON unified_transactions
IS 'Links unified transaction to its payment record in party_payments';

COMMENT ON CONSTRAINT expenses_party_payment_id_fkey ON expenses
IS 'Links expense to its payment record in party_payments';
