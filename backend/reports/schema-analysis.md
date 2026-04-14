# Schema Analysis Report

Generated: 2026-03-30T04:41:26.140Z

## Environment

- Env file: `backend/.env`
- Live schema mode: `loaded`
- Live schema note: Live inspection used the same Supabase URL/API-key connection path as the backend application. PostgREST OpenAPI exposed 33 table schema(s). Table probes accessible: 26/26; sampled rows: 14.
- Supabase URL present: true
- Supabase anon key present: true
- Supabase service role key present: false
- Direct database URL present: false
- PG* variables present: false
- Live schema connection path: `supabase-js`

## Coverage

- Schema snapshot files parsed: 1
- Migration files parsed: 13
- Repo schema tables detected: 24
- Code files scanned: 131
- Supabase tables referenced in code: 26
- RPC functions referenced in code: 8
- Live table candidates probed: 26
- Live accessible tables: 26
- Live sampled tables: 14
- Live empty but accessible tables: 10
- Live OpenAPI tables: 33

## High-Signal Findings

None

## Repo Schema Gaps

### Tables Referenced In Code But Not Defined In Repo Schema

- `admin_logs`
- `transaction_attachments`

### Tables Still Missing From Repo Migrations

- `admin_logs`
- `categories`
- `category_images`
- `employees`
- `parties`
- `party_transactions`
- `product_images`
- `purchase_order_items`
- `purchase_orders`
- `reviews`
- `transaction_attachments`
- `users`

### Code Columns Missing From Known Schema Snapshot

- `access_token` (29 references): `backend/middleware/authMiddleware.js`, `backend/server.js`, `backend/services/payment/PhonePeGateway.js`, `frontend/src/components/auth/AuthFlow.jsx`
- `unit_price` (28 references): `backend/routes/expenseRoutes.js`, `frontend/src/pages/admin/ExpenseManagement.jsx`, `frontend/src/pages/admin/components/ItemManager.jsx`, `frontend/src/pages/admin/components/MultiVendorItemManager.jsx`
- `end_date` (27 references): `frontend/src/pages/admin/ExpenseManagement.jsx`, `frontend/src/pages/admin/PurchaseOrderManagement.jsx`, `frontend/src/pages/admin/components/ExpensesCalendar.jsx`
- `entity_type` (22 references): `backend/server.js`
- `entity_id` (21 references): `backend/server.js`
- `refresh_token` (20 references): `backend/server.js`, `frontend/src/components/auth/AuthFlow.jsx`, `frontend/src/services/api.js`, `frontend/src/utils/authRecovery.js`
- `purchase_order` (16 references): `backend/routes/expenseRoutes.js`, `backend/server.js`
- `field_name` (14 references): `backend/config/transactionTypes.js`, `frontend/src/components/StaticTransactionTypeSelector.jsx`
- `receive_now` (14 references): `backend/server.js`, `frontend/src/pages/admin/PurchaseOrderManagement.jsx`
- `category_name` (12 references): `backend/server.js`, `frontend/src/components/ProductCard.jsx`, `frontend/src/pages/ProductDetail.jsx`, `frontend/src/pages/admin/InventoryManagement.jsx`
- `expires_at` (12 references): `backend/services/payment/PhonePeGateway.js`, `frontend/src/components/auth/AuthFlow.jsx`, `frontend/src/utils/authRecovery.js`, `frontend/src/utils/authRecovery.test.js`
- `file_size` (11 references): `backend/routes/expenseRoutes.js`, `backend/server.js`, `backend/services/ImageProcessingWrapper.js`
- `is_required` (11 references): `backend/config/transactionTypes.js`, `frontend/src/components/StaticTransactionTypeSelector.jsx`
- `serviceability_checked` (11 references): `backend/server.js`, `backend/services/delivery/DeliveryService.js`, `frontend/src/pages/Checkout.jsx`, `frontend/src/pages/ProductDetail.jsx`
- `expires_in` (10 references): `frontend/src/components/auth/AuthFlow.jsx`, `frontend/src/utils/authRecovery.js`, `frontend/src/utils/authRecovery.test.js`, `frontend/src/utils/authUtils.js`
- `received_items` (10 references): `frontend/src/pages/admin/PurchaseOrderManagement.jsx`
- `field_label` (9 references): `backend/config/transactionTypes.js`, `frontend/src/components/StaticTransactionTypeSelector.jsx`
- `po_created` (9 references): `frontend/src/pages/admin/PartyManagement.jsx`, `frontend/src/utils/financeColors.js`
- `receive_quantity` (9 references): `frontend/src/pages/admin/InventoryManagement.jsx`
- `estimated_delivery_end` (8 references): `backend/services/delivery/DeliveryService.js`, `frontend/src/pages/Checkout.jsx`, `frontend/src/pages/Orders.jsx`, `frontend/src/pages/ProductDetail.jsx`
- `estimated_delivery_start` (8 references): `backend/services/delivery/DeliveryService.js`, `frontend/src/pages/Checkout.jsx`, `frontend/src/pages/Orders.jsx`, `frontend/src/pages/ProductDetail.jsx`
- `expires_at_ms` (8 references): `frontend/src/utils/authRecovery.js`, `frontend/src/utils/authRecovery.test.js`
- `partial_received` (8 references): `backend/server.js`, `frontend/src/pages/admin/InventoryManagement.jsx`, `frontend/src/pages/admin/PurchaseOrderManagement.jsx`
- `primary_image` (8 references): `backend/server.js`, `frontend/src/hooks/useCategoryImage.js`, `frontend/src/pages/Home.jsx`, `frontend/src/pages/admin/CategoryManagement.jsx`
- `processing_settings` (8 references): `backend/server.js`, `frontend/src/components/EnhancedImageGalleryManager.jsx`, `frontend/src/pages/admin/CategoryManagement.jsx`
- `token_hash` (8 references): `backend/server.js`, `frontend/src/components/auth/AuthFlow.jsx`, `frontend/src/pages/Auth.jsx`
- `field_type` (7 references): `backend/config/transactionTypes.js`, `frontend/src/components/StaticTransactionTypeSelector.jsx`
- `shipment_error` (7 references): `backend/server.js`, `backend/services/delivery/DeliveryService.js`, `frontend/src/pages/admin/OrderManagement.jsx`
- `user_metadata` (7 references): `backend/server.js`, `frontend/src/components/Header.jsx`, `frontend/src/context/AuthContext.js`, `frontend/src/pages/admin/AdminDashboard.jsx`
- `default_mode` (6 references): `backend/services/delivery/DeliveryService.js`, `frontend/src/pages/Checkout.jsx`, `frontend/src/pages/ProductDetail.jsx`
- ... 204 more

## Cleanup Candidates

### Commented Drop Candidates Already Present In Migrations

- `expenses.transaction_fields` from `backend/migrations/002_cleanup_payment_structure.sql:81` is still referenced in code (`frontend/src/pages/admin/components/UnifiedVendorPaymentForm.jsx`)
- `expenses.transaction_type_id` from `backend/migrations/002_cleanup_payment_structure.sql:80` is still referenced in code (`backend/server.js`, `frontend/src/components/StaticTransactionTypeSelector.jsx`, `frontend/src/pages/admin/components/UnifiedVendorPaymentForm.jsx`)
- `party_payments.bank_name` from `backend/migrations/002_cleanup_payment_structure.sql:60` is not referenced in scanned code
- `party_payments.cheque_number` from `backend/migrations/002_cleanup_payment_structure.sql:58` is still referenced in code (`backend/config/transactionTypes.js`, `backend/routes/expenseRoutes.js`, `backend/server.js`)
- `party_payments.purchase_bill_id` from `backend/migrations/002_cleanup_payment_structure.sql:61` is not referenced in scanned code
- `party_payments.transaction_fields` from `backend/migrations/002_cleanup_payment_structure.sql:57` is still referenced in code (`frontend/src/pages/admin/components/UnifiedVendorPaymentForm.jsx`)
- `party_payments.transaction_type_id` from `backend/migrations/002_cleanup_payment_structure.sql:56` is still referenced in code (`backend/server.js`, `frontend/src/components/StaticTransactionTypeSelector.jsx`, `frontend/src/pages/admin/components/UnifiedVendorPaymentForm.jsx`)
- `party_payments.upi_transaction_id` from `backend/migrations/002_cleanup_payment_structure.sql:59` is not referenced in scanned code
- `unified_transactions.payment_method` from `backend/migrations/002_cleanup_payment_structure.sql:97` is still referenced in code (`backend/routes/adminPaymentRoutes.js`, `backend/routes/expenseRoutes.js`, `backend/routes/paymentRoutes.js`)

### Columns In The Known Schema Snapshot With No Direct Code Usage

- `employees.notes` (unknown)
- `employees.salary` (integer)
- `expenses.notes` (text)
- `expenses.receipt_url` (unknown)
- `parties.gstin` (unknown)
- `parties.notes` (text)
- `party_payments.cheque_date` (unknown)
- `party_payments.notes` (unknown)
- `party_transactions.balance` (number:numeric)
- `party_transactions.reference_id` (string:uuid)
- `payment_transactions.currency` (string:character varying)
- `payment_transactions.phonepe_merchant_id` (string:character varying)
- `purchase_orders.notes` (text)
- `purchase_orders.priority` (text)
- `purchase_orders.subtotal` (integer)
- `reviews.comment` (string:text)
- `reviews.rating` (integer:integer)
- `shipment_tracking_events.instructions` (string:text)
- `shipment_tracking_events.location` (string:character varying)
- `shipment_tracking_events.remarks` (string:text)
- `shipments.freight_charges` (number:numeric)
- `stock_movements.notes` (string:text)
- `stock_movements.purchase_bill_id` (string:uuid)
- `stock_movements.reference_id` (string:uuid)
- `stock_movements.unit_cost` (number:numeric)
- `unified_transactions.notes` (text)
- `unified_transactions.priority` (text)
- `users.is_admin` (boolean)
- `users.password` (text)
- `upcoming_cheque_clearances.days_until_clearance` (integer:integer)
- `upcoming_cheque_clearances.notes` (string:text)
- `upcoming_cheque_clearances.urgency` (string:text)
- `vendors.notes` (string:text)
- `v_product_weight_audit.display_weight` (number:numeric)
- `v_product_weight_audit.variants_missing_weight` (integer:bigint)
- `v_product_weight_audit.variants_with_default_weight` (integer:bigint)
- `v_product_weight_audit.weight_status` (string:text)
- `purchase_bill_items.bill_id` (string:uuid)
- `purchase_bills.bill_date` (string:date)
- `purchase_bills.bill_file_url` (string:text)
- ... 40 more

## Suggested Next Steps

- Keep using the shared Supabase client path for app-level validation; add a direct Postgres connection string only if you need authoritative full-schema introspection.
- Resolve high-severity code/data consistency issues before dropping or renaming any columns.
- Version the missing base schema tables in migrations or a schema snapshot so schema drift can be audited accurately.
- Re-run this analyzer after every cleanup migration and before removing any legacy columns.

