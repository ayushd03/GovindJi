function buildVariantMutationPlan(existingVariants = [], incomingVariants = []) {
  const existingById = new Map(
    existingVariants
      .filter((variant) => Boolean(variant?.id))
      .map((variant) => [variant.id, variant])
  );
  const seenIncomingIds = new Set();
  const updates = [];
  const inserts = [];

  incomingVariants.forEach((variant, index) => {
    if (!variant?.id) {
      inserts.push(variant);
      return;
    }

    if (seenIncomingIds.has(variant.id)) {
      throw new Error(`Variant ${index + 1} was submitted more than once.`);
    }

    if (!existingById.has(variant.id)) {
      throw new Error(`Variant ${index + 1} references an unknown variant id.`);
    }

    seenIncomingIds.add(variant.id);
    updates.push(variant);
  });

  const deleteIds = existingVariants
    .filter((variant) => Boolean(variant?.id) && !seenIncomingIds.has(variant.id))
    .map((variant) => variant.id);

  return {
    updates,
    inserts,
    deleteIds,
  };
}

module.exports = {
  buildVariantMutationPlan,
};
