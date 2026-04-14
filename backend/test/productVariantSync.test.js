const test = require('node:test');
const assert = require('node:assert/strict');

const { buildVariantMutationPlan } = require('../services/productVariantSync');

test('preserves existing ids when variants are edited and reordered', () => {
  const plan = buildVariantMutationPlan(
    [{ id: 'variant-a' }, { id: 'variant-b' }],
    [
      { id: 'variant-b', variant_name: '1kg', display_order: 0, is_default: true },
      { id: 'variant-a', variant_name: '500g', display_order: 1, is_default: false },
    ]
  );

  assert.deepEqual(plan.updates.map((variant) => variant.id), ['variant-b', 'variant-a']);
  assert.deepEqual(plan.inserts, []);
  assert.deepEqual(plan.deleteIds, []);
});

test('only deletes removed variants while keeping retained ids stable', () => {
  const plan = buildVariantMutationPlan(
    [{ id: 'variant-a' }, { id: 'variant-b' }, { id: 'variant-c' }],
    [
      { id: 'variant-b', variant_name: '1kg', display_order: 0, is_default: true },
      { variant_name: '2kg', display_order: 1, is_default: false },
    ]
  );

  assert.deepEqual(plan.updates.map((variant) => variant.id), ['variant-b']);
  assert.equal(plan.inserts.length, 1);
  assert.deepEqual(plan.deleteIds, ['variant-a', 'variant-c']);
});

test('rejects duplicate or unknown incoming ids', () => {
  assert.throws(
    () => buildVariantMutationPlan([{ id: 'variant-a' }], [{ id: 'variant-a' }, { id: 'variant-a' }]),
    /submitted more than once/
  );

  assert.throws(
    () => buildVariantMutationPlan([{ id: 'variant-a' }], [{ id: 'variant-missing' }]),
    /unknown variant id/
  );
});
