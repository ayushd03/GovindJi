import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import { productsAPI } from '../../../services/api';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogDescription,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogIconButton,
  AdminDialogTitle,
} from '../../../components/AdminDialog';

const ProductVariantManager = ({ isOpen, onClose, product, onSave }) => {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const sizeUnits = [
    { value: 'GRAMS', label: 'Grams (g)' },
    { value: 'KILOGRAMS', label: 'Kilograms (kg)' },
    { value: 'PIECES', label: 'Pieces' },
    { value: 'LITERS', label: 'Liters (L)' },
    { value: 'MILLILITERS', label: 'Milliliters (ml)' }
  ];

  const fetchVariants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await productsAPI.getVariants(product.id);
      setVariants(response.data.length > 0 ? response.data : getDefaultVariants());
    } catch (err) {
      console.error('Error fetching variants:', err);
      setVariants(getDefaultVariants());
    } finally {
      setLoading(false);
    }
  }, [product?.id]);

  useEffect(() => {
    if (isOpen && product?.id) {
      fetchVariants();
    }
  }, [fetchVariants, isOpen, product?.id]);

  const getDefaultVariants = () => [
    {
      variant_name: '',
      size_value: '',
      size_unit: 'GRAMS',
      price: '',
      stock_quantity: '',
      weight_grams: '',  // Weight for shipping
      is_default: true, // First variant should be default
      is_active: true,
      display_order: 0
    }
  ];

  const addVariant = () => {
    const newVariant = {
      variant_name: '',
      size_value: '',
      size_unit: 'GRAMS',
      price: '',
      stock_quantity: '',
      weight_grams: '',  // Weight for shipping
      is_default: variants.length === 0,
      is_active: true,
      display_order: variants.length
    };
    setVariants([...variants, newVariant]);
  };

  // Auto-calculate weight_grams based on size_unit and size_value
  const calculateWeight = (sizeValue, sizeUnit) => {
    const value = parseFloat(sizeValue);
    if (!value || value <= 0) return '';

    switch (sizeUnit) {
      case 'GRAMS':
        return Math.round(value);
      case 'KILOGRAMS':
        return Math.round(value * 1000);
      default:
        // For non-weight units, return empty (user must enter manually)
        return '';
    }
  };

  const removeVariant = (index) => {
    const newVariants = variants.filter((_, i) => i !== index);
    // If we removed the default, make the first one default
    if (newVariants.length > 0 && !newVariants.some(v => v.is_default)) {
      newVariants[0].is_default = true;
    }
    setVariants(newVariants);
  };

  const updateVariant = (index, field, value) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;

    // If marking as default, unmark others
    if (field === 'is_default' && value === true) {
      newVariants.forEach((v, i) => {
        if (i !== index) v.is_default = false;
      });
    }

    // Auto-calculate weight when size_value or size_unit changes
    if (field === 'size_value' || field === 'size_unit') {
      const sizeValue = field === 'size_value' ? value : newVariants[index].size_value;
      const sizeUnit = field === 'size_unit' ? value : newVariants[index].size_unit;
      const calculatedWeight = calculateWeight(sizeValue, sizeUnit);

      // Only auto-update if it's a weight unit (GRAMS/KILOGRAMS)
      if (calculatedWeight !== '') {
        newVariants[index].weight_grams = calculatedWeight;
      } else if (field === 'size_unit') {
        // Clear weight when switching to non-weight unit
        newVariants[index].weight_grams = '';
      }
    }

    setVariants(newVariants);
  };

  const moveVariant = (index, direction) => {
    const newVariants = [...variants];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= newVariants.length) return;

    [newVariants[index], newVariants[newIndex]] = [newVariants[newIndex], newVariants[index]];

    // Update display_order
    newVariants.forEach((v, i) => {
      v.display_order = i;
    });

    setVariants(newVariants);
  };

  const validateVariants = () => {
    if (variants.length === 0) {
      setError('Please add at least one variant');
      return false;
    }

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      if (!variant.variant_name || !variant.variant_name.trim()) {
        setError(`Variant ${i + 1}: Name is required`);
        return false;
      }
      if (!variant.size_value || parseFloat(variant.size_value) <= 0) {
        setError(`Variant ${i + 1}: Size value must be greater than 0`);
        return false;
      }
      if (!variant.price || parseFloat(variant.price) <= 0) {
        setError(`Variant ${i + 1}: Price must be greater than 0`);
        return false;
      }
      if (variant.stock_quantity === '' || variant.stock_quantity === undefined || parseInt(variant.stock_quantity) < 0) {
        setError(`Variant ${i + 1}: Stock quantity must be 0 or more`);
        return false;
      }

      // Validate weight_grams for shipping
      if (!variant.weight_grams || parseFloat(variant.weight_grams) <= 0) {
        const nonWeightUnits = ['PIECES', 'LITERS', 'MILLILITERS'];
        if (nonWeightUnits.includes(variant.size_unit)) {
          setError(`Variant ${i + 1}: Shipping weight (grams) is required for ${variant.size_unit}`);
        } else {
          setError(`Variant ${i + 1}: Shipping weight is required`);
        }
        return false;
      }
    }

    setError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateVariants()) return;

    setSaving(true);
    setError(null);

    try {
      await productsAPI.saveVariants(product.id, variants);
      onSave?.();
      onClose();
    } catch (err) {
      console.error('Error saving variants:', err);
      setError(err.response?.data?.error || 'Failed to save variants');
    } finally {
      setSaving(false);
    }
  };

  const generateVariantName = (index) => {
    const variant = variants[index];
    if (variant.size_value && variant.size_unit) {
      const unit = variant.size_unit === 'KILOGRAMS' ? 'kg' :
                    variant.size_unit === 'GRAMS' ? 'g' :
                    variant.size_unit === 'LITERS' ? 'L' :
                    variant.size_unit === 'MILLILITERS' ? 'ml' :
                    variant.size_unit === 'PIECES' ? 'pcs' : '';
      updateVariant(index, 'variant_name', `${variant.size_value}${unit}`);
    }
  };

  if (!isOpen) return null;

  return (
    <AdminDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AdminDialogContent size="lg">
        <AdminDialogHeader sticky>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <CubeIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <AdminDialogTitle>Manage Product Variants</AdminDialogTitle>
                <AdminDialogDescription>
                  Configure pack sizes, pricing, and shipping weight for {product?.name || 'this product'}.
                </AdminDialogDescription>
              </div>
            </div>
            <AdminDialogIconButton onClick={onClose} />
          </div>
        </AdminDialogHeader>

        <AdminDialogBody className="admin-dialog-stack">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading variants...</span>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="admin-dialog-section-muted text-sm text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Configure customer-facing size variants</p>
                  <p>Add different sizes (e.g., 250g, 500g, 1kg) with individual prices. Customers will see these options when adding to cart.</p>
                  <p className="mt-2 text-xs"><strong>Shipping weight:</strong> For `GRAMS` and `KILOGRAMS`, weight is auto-calculated. For other units, enter the actual weight used for shipping.</p>
                </div>

                <div className="space-y-3">
                  {variants.map((variant, index) => {
                    const isWeightUnit = ['GRAMS', 'KILOGRAMS'].includes(variant.size_unit);
                    return (
                    <div
                      key={index}
                      className="admin-dialog-section"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                        {/* Variant Name */}
                        <div className="md:col-span-2">
                          <label className="admin-dialog-label">
                            Variant Name *
                          </label>
                          <input
                            type="text"
                            value={variant.variant_name}
                            onChange={(e) => updateVariant(index, 'variant_name', e.target.value)}
                            placeholder="e.g., 500g Packet"
                            className="input-field text-sm"
                          />
                        </div>

                        {/* Size Value */}
                        <div className="md:col-span-1">
                          <label className="admin-dialog-label">
                            Size *
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={variant.size_value}
                            onChange={(e) => updateVariant(index, 'size_value', e.target.value)}
                            onBlur={() => generateVariantName(index)}
                            placeholder="500"
                            className="input-field text-sm"
                          />
                        </div>

                        {/* Size Unit */}
                        <div className="md:col-span-2">
                          <label className="admin-dialog-label">
                            Unit *
                          </label>
                          <select
                            value={variant.size_unit}
                            onChange={(e) => updateVariant(index, 'size_unit', e.target.value)}
                            onBlur={() => generateVariantName(index)}
                            className="input-field text-sm"
                          >
                            {sizeUnits.map(unit => (
                              <option key={unit.value} value={unit.value}>
                                {unit.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Price */}
                        <div className="md:col-span-2">
                          <label className="admin-dialog-label">
                            Price (₹) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={variant.price}
                            onChange={(e) => updateVariant(index, 'price', e.target.value)}
                            placeholder="499.00"
                            className="input-field text-sm"
                          />
                        </div>

                        {/* Stock Quantity */}
                        <div className="md:col-span-2">
                          <label className="admin-dialog-label">
                            Stock *
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={variant.stock_quantity}
                            onChange={(e) => updateVariant(index, 'stock_quantity', e.target.value)}
                            placeholder="0"
                            className="input-field text-sm"
                          />
                        </div>

                        {/* Weight for shipping */}
                        <div className="md:col-span-1">
                          <label className="admin-dialog-label">
                            Wt (g) *
                            {isWeightUnit && <span className="ml-1 text-emerald-600">Auto</span>}
                          </label>
                          <input
                            type="number"
                            step="1"
                            value={variant.weight_grams}
                            onChange={(e) => updateVariant(index, 'weight_grams', e.target.value)}
                            placeholder={isWeightUnit ? "Auto" : "grams"}
                            disabled={isWeightUnit}
                            className={`input-field text-sm ${
                              isWeightUnit ? 'cursor-not-allowed bg-emerald-50 text-emerald-700' : ''
                            }`}
                            title={isWeightUnit ? "Auto-calculated from size" : "Enter actual weight for shipping"}
                          />
                        </div>

                        {/* Checkboxes */}
                        <div className="md:col-span-1 flex flex-col gap-2 rounded-xl bg-muted/30 p-3">
                          <label className="flex items-center text-xs font-medium text-foreground">
                            <input
                              type="checkbox"
                              checked={variant.is_default}
                              onChange={(e) => updateVariant(index, 'is_default', e.target.checked)}
                              className="rounded border-gray-300 text-primary mr-2"
                            />
                            Default
                          </label>
                          <label className="flex items-center text-xs font-medium text-foreground">
                            <input
                              type="checkbox"
                              checked={variant.is_active}
                              onChange={(e) => updateVariant(index, 'is_active', e.target.checked)}
                              className="rounded border-gray-300 text-primary mr-2"
                            />
                            Active
                          </label>
                        </div>

                        {/* Actions */}
                        <div className="md:col-span-1 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => moveVariant(index, 'up')}
                            disabled={index === 0}
                            className="rounded-lg border border-border/70 bg-muted/30 px-2 py-1 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-30"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveVariant(index, 'down')}
                            disabled={index === variants.length - 1}
                            className="rounded-lg border border-border/70 bg-muted/30 px-2 py-1 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-30"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="rounded-lg border border-destructive/20 bg-destructive/10 px-2 py-1 text-destructive transition hover:bg-destructive/15"
                            title="Remove"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addVariant}
                  className="mt-4 inline-flex items-center rounded-xl border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted/30"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Another Variant
                </button>
              </>
            )}
        </AdminDialogBody>

          <AdminDialogFooter sticky className="justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted/30"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-xl"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  Save Variants
                </>
              )}
            </button>
          </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  );
};

export default ProductVariantManager;
