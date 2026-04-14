# Updated Fix Plan

Generated: 2026-03-29

## Goal

Bring the current branch to a safe merge state by fixing the confirmed diff regressions first, then reconciling the live database schema with the codebase, and only then removing legacy or unused columns.

Manager-role permission changes are treated as intentional and are not part of this fix plan.

## Evidence Base

This plan is based on:

- the current git diff
- code review of pricing, variants, admin product flows, expense flows, and admin navigation
- the live schema analyzer at `backend/scripts/analyzeSchema.js`
- the latest live report at `backend/reports/schema-analysis.md`

Current live schema coverage:

- the analyzer now uses the same Supabase connection path as the backend app via `backend/config/supabaseClient.js`
- PostgREST OpenAPI exposed 33 live table schemas
- live probes succeeded for 26/26 candidate app tables
- 14 tables returned sample rows and 10 additional tables were reachable but empty during probing

## Current Status

The branch is not safe to merge yet.

Known blockers:

1. Variant-linked wholesale tiers can be lost during variant resave.
2. Fixed-amount discount is still exposed in the UI but is no longer persisted as a real mode.
3. `ItemManager` still reads `selling_price` while current product APIs use `price`.
4. The Customers page is still routed and permissioned, but the admin tab is gone.
5. `git diff --check` still fails because of trailing whitespace in `frontend/src/pages/admin/components/AddProductModal.jsx`.

## Workstream 1: Merge Blockers

### 1. Variant and wholesale tier integrity

Files:

- `backend/server.js`
- `frontend/src/pages/admin/components/AddProductModal.jsx`
- `backend/migrations/013_simplify_pricing.sql`

Problem:

- `wholesale_prices.variant_id` now exists with `ON DELETE CASCADE`
- variant save still deletes all old variants and recreates them
- the modal sends wholesale tiers independently from variant recreation
- variant-linked wholesale tiers can be deleted, orphaned, or left mapped to stale IDs

Fix:

1. Replace the delete-and-reinsert strategy with an ID-preserving update path where possible.
2. If variant recreation is unavoidable, save product, variants, and wholesale tiers in one coordinated flow.
3. Build an explicit old-to-new variant ID remap and rewrite `wholesale_prices.variant_id` before completion.
4. Add a regression test case for:
   - existing product with variants
   - variant-linked wholesale tiers
   - variant edit + reorder + save

Priority: `P1`

### 2. Discount mode consistency

Files:

- `frontend/src/pages/admin/components/AddProductModal.jsx`
- `backend/server.js`
- `frontend/src/utils/productPricing.js`
- `backend/middleware/validateProduct.js`

Problem:

- the UI still allows `discount_type = amount`
- backend create/update now always persists `discount_type = percentage`
- a rupee discount can be saved and later interpreted as a percentage

Fix:

1. Decide on one pricing model and enforce it everywhere.
2. Recommended: remove true amount-based product discounts from this flow and keep MRP-driven percentage only.
3. Remove or disable the `amount` option in the modal.
4. Align validation so the accepted payload matches what the backend really stores.
5. Add tests for:
   - product with MRP and derived percentage
   - product without MRP
   - rejection or removal of fixed-amount mode

Priority: `P1`

### 3. Admin item pricing field mismatch

Files:

- `frontend/src/pages/admin/components/ItemManager.jsx`
- `backend/routes/expenseRoutes.js`

Problem:

- item selection still reads `product.selling_price`
- current product queries return `price`
- admin expense or item-picker flows can show zero or blank price values

Fix:

1. Update `ItemManager` to use `product.price`.
2. For temporary backward compatibility, use `product.price ?? product.selling_price ?? 0`.
3. Check any other admin components for stale `selling_price` usage.

Priority: `P2`

### 4. Customers navigation consistency

Files:

- `frontend/src/enums/roles.js`
- `frontend/src/App.jsx`
- `frontend/src/pages/admin/CustomerManagement.jsx`

Problem:

- route and permission guard still exist
- admin tab entry is missing

Fix:

1. Decide whether Customers should remain available in admin navigation.
2. If yes, restore the tab.
3. If no, remove or document the route-only state and confirm no navigation/test expectations depend on it.

Priority: `P3`

### 5. Diff hygiene

Problem:

- `git diff --check` still fails
- current failure is trailing whitespace in `frontend/src/pages/admin/components/AddProductModal.jsx`
- there are also CRLF to LF normalization warnings in a few files

Fix:

1. Remove trailing whitespace.
2. Avoid broad line-ending churn unless that normalization is intended for this branch.
3. Re-run `git diff --check` and keep it clean before merge.

Priority: `P3`

## Workstream 2: Schema Source Of Truth

The live analyzer is now good enough to validate app-visible schema, but the repo still does not contain a complete schema history.

Problem:

- many live tables exist that are not represented in repo migrations
- the branch currently relies on live DB reality plus a partial migration set
- that makes future cleanup risky because repo-only review cannot fully detect schema drift

Tables visible live but not defined in repo migrations include:

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

Fix:

1. Export or reconstruct a baseline schema snapshot for the live `public` schema.
2. Commit that baseline in a controlled way.
3. Keep later migrations incremental from that point forward.
4. Re-run the analyzer after the baseline is added so repo drift warnings shrink.

Priority: `P1` for maintainability, but after merge blockers

## Workstream 3: Database Cleanup

Only start this after Workstream 1 is complete.

### A. High-confidence removal candidates

These are the best initial candidates because they are already marked as removable in migration comments and the current repo scan found no direct code references:

- `party_payments.bank_name`
- `party_payments.purchase_bill_id`
- `party_payments.upi_transaction_id`

Required before dropping:

1. Confirm they are not used by dashboards, reports, manual SQL, or external automations.
2. Confirm historical rows do not need them for audit.
3. Add one cleanup migration for these drops only.

### B. Columns not safe to remove yet

These are still referenced in code and must stay for now:

- `party_payments.transaction_type_id`
- `party_payments.transaction_fields`
- `party_payments.cheque_number`
- `expenses.transaction_type_id`
- `expenses.transaction_fields`
- `unified_transactions.payment_method`

Action:

1. Leave them in place for the current branch.
2. Remove their reads and writes in application code first.
3. Drop them only in a later cleanup migration after the code is fully migrated.

### C. Audit queue from live schema

The analyzer also found live columns with no direct code references. These are not automatic drop candidates, but they should be reviewed in batches.

Priority audit groups:

1. Auth and role legacy fields
   - `users.password`
   - `users.is_admin`

2. Notes and optional metadata columns
   - `employees.notes`
   - `expenses.notes`
   - `parties.notes`
   - `vendors.notes`
   - `purchase_orders.notes`
   - `unified_transactions.notes`

3. Optional commerce and inventory metadata
   - `parties.gstin`
   - `purchase_orders.priority`
   - `purchase_orders.subtotal`
   - `stock_movements.unit_cost`
   - `stock_movements.purchase_bill_id`
   - `stock_movements.reference_id`

4. Payment and tracking metadata
   - `party_payments.cheque_date`
   - `party_payments.notes`
   - `payment_transactions.currency`
   - `payment_transactions.phonepe_merchant_id`
   - `shipment_tracking_events.instructions`
   - `shipment_tracking_events.location`
   - `shipment_tracking_events.remarks`
   - `shipments.freight_charges`

Action:

1. Review each group with product and operations context.
2. Classify every column as one of:
   - keep
   - deprecate
   - drop after backfill
3. Do not drop view columns or reporting-only columns without checking downstream usage.

## Workstream 4: Code And DB Alignment

After Workstreams 1 through 3 are stable:

1. Update backend validation and frontend forms so each persisted column has one clear source of truth.
2. Remove stale field aliases where they are no longer needed.
3. Add a small compatibility map only where the migration needs a short transitional window.
4. Re-run the schema analyzer and reduce the remaining "missing column" and "unused column" lists.

## Execution Order

### Phase 1

Fix the merge blockers:

1. Variant and wholesale tier integrity
2. Discount mode consistency
3. `ItemManager` price field mismatch
4. Customers navigation decision
5. Diff whitespace cleanup

### Phase 2

Lock the schema source of truth:

1. keep using the shared Supabase connection path in the analyzer
2. add a repo baseline schema snapshot
3. compare baseline, live schema, and code usage

### Phase 3

Perform the first DB cleanup:

1. remove only the three high-confidence `party_payments` legacy columns
2. leave the still-referenced payment structure columns in place
3. rerun analyzer and smoke-test payment flows

### Phase 4

Run the audit queue:

1. auth and role legacy fields
2. notes and metadata columns
3. inventory and reporting fields
4. optional logistics fields

## Verification Checklist

Before merge:

1. `git diff --check`
2. `npm run analyze:schema`
3. admin product create test
4. admin product edit test
5. product with variants test
6. product with variant-linked wholesale tiers test
7. expense item picker test
8. customer admin navigation decision validated

Before DB cleanup migration:

1. verify each candidate column against live schema
2. verify no code references remain
3. verify no report/export/manual workflow still depends on it
4. run analyzer again after the migration

## Deliverables

Current deliverables already created:

- `backend/scripts/analyzeSchema.js`
- `backend/reports/schema-analysis.json`
- `backend/reports/schema-analysis.md`
- `backend/reports/schema-cleanup-plan.md`

Recommended next implementation batch:

1. fix the three confirmed functional regressions
2. clean the whitespace issue
3. rerun analyzer
4. then start the first DB cleanup migration
