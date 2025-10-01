import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowsUpDownIcon
} from '@heroicons/react/24/outline';
import { productsAPI } from '../../../services/api';

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

  useEffect(() => {
    if (isOpen && product?.id) {
      fetchVariants();
    }
  }, [isOpen, product]);

  const fetchVariants = async () => {
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
  };

  const getDefaultVariants = () => [
    {
      variant_name: '',
      size_value: '',
      size_unit: 'GRAMS',
      price: '',
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
      is_default: variants.length === 0,
      is_active: true,
      display_order: variants.length
    };
    setVariants([...variants, newVariant]);
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Manage Product Variants
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {product?.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-gray-600">Loading variants...</span>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
                  <p className="font-medium mb-1">💡 Configure size variants for this product</p>
                  <p>Add different sizes (e.g., 250g, 500g, 1kg) with individual prices. Customers will see these options when adding to cart.</p>
                </div>

                <div className="space-y-3">
                  {variants.map((variant, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                        {/* Variant Name */}
                        <div className="md:col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Variant Name *
                          </label>
                          <input
                            type="text"
                            value={variant.variant_name}
                            onChange={(e) => updateVariant(index, 'variant_name', e.target.value)}
                            placeholder="e.g., 500g Packet"
                            className="input-field w-full px-3 py-2 border rounded-md text-sm"
                          />
                        </div>

                        {/* Size Value */}
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Size Value *
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={variant.size_value}
                            onChange={(e) => updateVariant(index, 'size_value', e.target.value)}
                            onBlur={() => generateVariantName(index)}
                            placeholder="500"
                            className="input-field w-full px-3 py-2 border rounded-md text-sm"
                          />
                        </div>

                        {/* Size Unit */}
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Unit *
                          </label>
                          <select
                            value={variant.size_unit}
                            onChange={(e) => updateVariant(index, 'size_unit', e.target.value)}
                            onBlur={() => generateVariantName(index)}
                            className="input-field w-full px-3 py-2 border rounded-md text-sm"
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
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Price (₹) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={variant.price}
                            onChange={(e) => updateVariant(index, 'price', e.target.value)}
                            placeholder="499.00"
                            className="input-field w-full px-3 py-2 border rounded-md text-sm"
                          />
                        </div>

                        {/* Checkboxes */}
                        <div className="md:col-span-2 flex flex-col gap-2">
                          <label className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              checked={variant.is_default}
                              onChange={(e) => updateVariant(index, 'is_default', e.target.checked)}
                              className="rounded border-gray-300 text-primary mr-2"
                            />
                            Default
                          </label>
                          <label className="flex items-center text-xs">
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
                        <div className="md:col-span-1 flex flex-col gap-1">
                          <button
                            onClick={() => moveVariant(index, 'up')}
                            disabled={index === 0}
                            className="btn-secondary p-1 disabled:opacity-30"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveVariant(index, 'down')}
                            disabled={index === variants.length - 1}
                            className="btn-secondary p-1 disabled:opacity-30"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removeVariant(index)}
                            className="btn-destructive p-1"
                            title="Remove"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addVariant}
                  className="btn-outline mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Another Variant
                </button>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="btn-secondary px-4 py-2 text-sm font-medium rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg"
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductVariantManager;
