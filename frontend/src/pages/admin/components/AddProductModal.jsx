import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  Cog6ToothIcon,
  CubeIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../../../hooks/useToast';
import UnitSelectionDialog from '../../../components/UnitSelectionDialog';
import {
  AdminDialog,
  AdminDialogContent,
  AdminDialogHeader,
  AdminDialogIconButton,
  AdminDialogTitle,
} from '../../../components/AdminDialog';
import { API_BASE_URL } from '../../../config/apiBaseUrl';
import ProductVariantManager, { createEmptyVariant } from './ProductVariantManager';

/* ─── Constants ─── */

const PRODUCT_UNITS = [
  { value: 'kg', label: 'Kilograms (kg)', shortLabel: 'kg', variantUnit: 'KILOGRAMS', isWeightBased: true },
  { value: 'g', label: 'Grams (g)', shortLabel: 'g', variantUnit: 'GRAMS', isWeightBased: true },
  { value: 'lb', label: 'Pounds (lb)', shortLabel: 'lb', variantUnit: 'POUNDS', isWeightBased: true },
  { value: 'oz', label: 'Ounces (oz)', shortLabel: 'oz', variantUnit: 'OUNCES', isWeightBased: true },
  { value: 'pieces', label: 'Pieces', shortLabel: 'pcs', variantUnit: 'PIECES', isWeightBased: false },
  { value: 'liters', label: 'Liters (L)', shortLabel: 'L', variantUnit: 'LITERS', isWeightBased: false },
  { value: 'milliliters', label: 'Milliliters (ml)', shortLabel: 'ml', variantUnit: 'MILLILITERS', isWeightBased: false },
  { value: 'packets', label: 'Packets', shortLabel: 'pkt', variantUnit: 'PACKETS', isWeightBased: false },
  { value: 'boxes', label: 'Boxes', shortLabel: 'box', variantUnit: 'BOXES', isWeightBased: false },
  { value: 'bags', label: 'Bags', shortLabel: 'bag', variantUnit: 'BAGS', isWeightBased: false },
  { value: 'dozens', label: 'Dozens', shortLabel: 'doz', variantUnit: 'DOZENS', isWeightBased: false },
  { value: 'sets', label: 'Sets', shortLabel: 'set', variantUnit: 'SETS', isWeightBased: false },
  { value: 'pairs', label: 'Pairs', shortLabel: 'pair', variantUnit: 'PAIRS', isWeightBased: false },
];

/* ─── Helpers ─── */

const getProductUnitMeta = (unitValue) =>
  PRODUCT_UNITS.find((u) => u.value === unitValue) || PRODUCT_UNITS[0];

const mapVariantUnitToProductUnit = (variantUnit) =>
  PRODUCT_UNITS.find((u) => u.variantUnit === variantUnit)?.value || 'kg';

const isWeightBasedProductUnit = (unitValue) => getProductUnitMeta(unitValue).isWeightBased;

const calculateSingleOptionWeightGrams = (weight, unitValue) => {
  const w = Number.parseFloat(weight);
  if (!Number.isFinite(w) || w <= 0) return '';
  switch (unitValue) {
    case 'kg': return Math.round(w * 1000);
    case 'g': return Math.round(w);
    case 'lb': return Math.round(w * 453.592);
    case 'oz': return Math.round(w * 28.3495);
    default: return '';
  }
};

const formatUnitConfiguration = (baseUnit, secondaryUnit, unitConversionValue) => {
  if (!baseUnit || !secondaryUnit || !unitConversionValue) return 'Not configured';
  return `1 ${baseUnit} = ${unitConversionValue} ${secondaryUnit}`;
};

const formatSingleOptionSize = (weight, unitValue, fallback = 'Not set') => {
  const w = Number.parseFloat(weight);
  if (!Number.isFinite(w) || w <= 0) return fallback;
  return `${w} ${getProductUnitMeta(unitValue).shortLabel}`;
};

const buildVariantNameFromSingleOption = (weight, unitValue) =>
  formatSingleOptionSize(weight, unitValue, '');

const createVariantFromSingleOption = (formData) => {
  const unitMeta = getProductUnitMeta(formData.unit);
  const autoWeight = calculateSingleOptionWeightGrams(formData.weight, formData.unit);
  return {
    ...createEmptyVariant(true, 0),
    variant_name: buildVariantNameFromSingleOption(formData.weight, formData.unit),
    size_value: formData.weight ?? '',
    size_unit: unitMeta.variantUnit,
    price: formData.price ?? '',
    mrp: formData.mrp ?? '',
    stock_quantity: formData.stock_quantity ?? '',
    weight_grams: formData.weight_grams || autoWeight || '',
  };
};

const createInitialFormData = ({ defaultName = '', editingProduct = null } = {}) => ({
  name: editingProduct?.name ?? defaultName,
  description: editingProduct?.description ?? '',
  category_id: editingProduct?.category_id ?? '',
  sku: editingProduct?.sku ?? '',
  weight: editingProduct?.weight ?? '',
  unit: editingProduct?.unit ?? 'kg',
  item_hsn: editingProduct?.item_hsn ?? '',
  is_service: editingProduct?.is_service ?? false,
  price: editingProduct?.price ?? '',
  mrp: editingProduct?.mrp ?? '',
  stock_quantity: editingProduct?.stock_quantity ?? '',
  min_stock_level: editingProduct?.min_stock_level ?? '',
  weight_grams: editingProduct?.weight_grams ?? '',
  sale_price_without_tax: editingProduct?.sale_price_without_tax ?? false,
  discount_on_sale_price: editingProduct?.discount_on_sale_price ?? '',
  discount_type: 'percentage',
  wholesale_prices: editingProduct?.wholesale_prices ?? [],
  base_unit: editingProduct?.base_unit ?? 'KILOGRAMS',
  secondary_unit: editingProduct?.secondary_unit ?? 'GRAMS',
  unit_conversion_value: editingProduct?.unit_conversion_value ?? 1000,
  opening_quantity_at_price: editingProduct?.opening_quantity_at_price ?? '',
  opening_quantity_as_of_date: editingProduct?.opening_quantity_as_of_date ?? '',
  stock_location: editingProduct?.stock_location ?? '',
});

const createInitialVariants = (editingProduct = null) =>
  Array.isArray(editingProduct?.variants)
    ? editingProduct.variants.map((v, i) => ({
        ...v,
        mrp: v?.mrp ?? '',
        weight_grams: v?.weight_grams ?? '',
        stock_quantity: v?.stock_quantity ?? '',
        is_active: v?.is_active !== false,
        is_default: v?.is_default === true,
        display_order: v?.display_order ?? i,
      }))
    : [];

const normalizeWholesaleTiers = (tiers = []) =>
  tiers.map((t) => ({ ...t, quantity: t?.quantity ?? '', price: t?.price ?? '' }));

const formatPriceRange = (range) => {
  if (!range) return 'Set prices';
  if (range.min === range.max) return `₹${range.min.toFixed(2)}`;
  return `₹${range.min.toFixed(2)} – ₹${range.max.toFixed(2)}`;
};

const formatInventorySummary = (formData) => {
  const parts = [
    formData.stock_location?.trim() || null,
    formData.opening_quantity_at_price !== '' && formData.opening_quantity_at_price !== null
      ? `Opening ₹${Number.parseFloat(formData.opening_quantity_at_price).toFixed(2)}`
      : null,
    formData.opening_quantity_as_of_date || null,
  ].filter(Boolean);
  return parts.join(' · ') || 'Location and opening stock';
};

const formatPricingExtrasSummary = (formData) => {
  const parts = [
    formData.sale_price_without_tax ? 'Entered without tax' : null,
    formData.discount_on_sale_price
      ? `${formData.discount_on_sale_price}% manual discount`
      : null,
  ].filter(Boolean);
  return parts.join(' · ') || 'Tax flag and manual discount';
};

/* ─── Shared UI pieces ─── */

const FieldBlock = ({
  label,
  error,
  hint,
  required = false,
  className = '',
  children,
}) => (
  <div className={className}>
    <div className="mb-1.5 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <label className="text-[13px] font-medium text-foreground">
          {label}
          {required ? <span className="text-destructive ml-0.5">*</span> : null}
        </label>
      </div>
      {hint && !error ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
    </div>
    {children}
    {error && <p className="mt-1.5 text-[11px] font-medium text-destructive">{error}</p>}
  </div>
);



/* ─── Main component ─── */

const AddProductModal = ({
  isOpen,
  onClose,
  onProductAdded,
  defaultName = '',
  editingProduct = null,
  mode = 'add',
  apiBaseUrl = API_BASE_URL,
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRemoveOptions, setPendingRemoveOptions] = useState(false);
  const [pendingServiceChange, setPendingServiceChange] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [variantError, setVariantError] = useState('');
  const [showUnitSelectionDialog, setShowUnitSelectionDialog] = useState(false);
  const [formData, setFormData] = useState(createInitialFormData({ defaultName, editingProduct }));
  const [variants, setVariants] = useState(createInitialVariants(editingProduct));

  const hasVariants = variants.length > 0;
  const isEditing = mode === 'edit' && editingProduct;

  const normalizedWholesalePrices = useMemo(
    () => normalizeWholesaleTiers(formData.wholesale_prices),
    [formData.wholesale_prices],
  );

  const defaultVariant = useMemo(() => {
    if (!hasVariants) return null;
    return variants.find((v) => v.is_default) || variants[0] || null;
  }, [hasVariants, variants]);

  const variantPriceRange = useMemo(() => {
    if (!hasVariants) return null;
    const prices = variants
      .map((v) => Number.parseFloat(v.price))
      .filter((p) => Number.isFinite(p) && p > 0);
    if (prices.length === 0) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [hasVariants, variants]);

  const activeVariantCount = useMemo(
    () => variants.filter((v) => v.is_active !== false).length,
    [variants],
  );

  const totalVariantStock = useMemo(
    () => hasVariants ? variants.reduce((sum, v) => sum + (Number.parseInt(v.stock_quantity, 10) || 0), 0) : 0,
    [hasVariants, variants],
  );

  const autoSingleOptionWeightGrams = useMemo(
    () => calculateSingleOptionWeightGrams(formData.weight, formData.unit),
    [formData.unit, formData.weight],
  );

  const singleOptionNeedsManualWeight = !isWeightBasedProductUnit(formData.unit);
  const catalogTypeLabel = formData.is_service ? 'Service' : 'Product';
  const modalTitle = isEditing ? `Edit ${catalogTypeLabel}` : `Add New ${catalogTypeLabel}`;
  const modalDescription = formData.is_service
    ? 'Fill in the details below to complete your service catalog.'
    : 'Fill in the details below to complete your product catalog.';
  const submitLabel = isEditing ? 'Save Changes' : `Create ${catalogTypeLabel}`;

  /* ─── Effects ─── */

  useEffect(() => {
    setFormData(createInitialFormData({ defaultName, editingProduct }));
    setVariants(createInitialVariants(editingProduct));
    setFormErrors({});
    setVariantError('');
    setPendingRemoveOptions(false);
    setPendingServiceChange(false);
    setShowUnitSelectionDialog(false);
  }, [defaultName, editingProduct, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCategories = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const res = await fetch(`${apiBaseUrl}/api/admin/categories`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) throw new Error('Failed to load categories');
        const data = await res.json();
        if (!Array.isArray(data)) {
          throw new Error('Invalid categories response format');
        }
        setCategories(data);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, [apiBaseUrl, isOpen]);

  /* ─── Handlers ─── */

  const resetState = () => {
    setFormData(createInitialFormData({ defaultName, editingProduct }));
    setVariants(createInitialVariants(editingProduct));
    setFormErrors({});
    setVariantError('');
    setPendingRemoveOptions(false);
    setPendingServiceChange(false);
    setShowUnitSelectionDialog(false);
  };

  const handleClose = () => { resetState(); onClose(); };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      if (field === 'mrp') {
        const sellingPriceIsEmpty = prev.price === '' || prev.price === null || prev.price === undefined;
        return {
          ...prev,
          mrp: value,
          price: sellingPriceIsEmpty ? value : prev.price,
        };
      }

      return { ...prev, [field]: value };
    });
    setFormErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'mrp' || field === 'price' ? { mrp: undefined, price: undefined } : {}),
    }));
  };

  const handleUnitSave = (unitData) => {
    setFormData((prev) => ({
      ...prev,
      base_unit: unitData.base_unit,
      secondary_unit: unitData.secondary_unit,
      unit_conversion_value: unitData.unit_conversion_value,
    }));
    setFormErrors((prev) => ({ ...prev, unit_conversion_value: undefined }));
  };

  const generateSKU = () => {
    const ts = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    handleInputChange('sku', `SKU${ts}${rand}`);
  };

  const handleVariantsChange = (next) => { setVariants(next); setVariantError(''); };

  const addWholesaleTier = () => {
    setFormData((prev) => ({
      ...prev,
      wholesale_prices: [...normalizeWholesaleTiers(prev.wholesale_prices), { quantity: '', price: '' }],
    }));
  };

  const updateWholesaleTier = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      wholesale_prices: normalizeWholesaleTiers(prev.wholesale_prices).map((t, i) =>
        i === index ? { ...t, [field]: value } : t,
      ),
    }));
  };

  const removeWholesaleTier = (index) => {
    setFormData((prev) => ({
      ...prev,
      wholesale_prices: normalizeWholesaleTiers(prev.wholesale_prices).filter((_, i) => i !== index),
    }));
  };

  const getDefaultVariantPayload = () => {
    const normalized = variants.map((v, i) => ({ ...v, is_default: v.is_default === true, display_order: v.display_order ?? i }));
    return normalized.find((v) => v.is_default) || normalized[0] || createEmptyVariant(true, 0);
  };

  const syncDefaultVariantToSingleOption = () => {
    if (!hasVariants) return true;

    const dv = getDefaultVariantPayload();
    setFormData((prev) => ({
      ...prev,
      price: dv?.price ?? prev.price,
      mrp: dv?.mrp ?? prev.mrp,
      stock_quantity: String(totalVariantStock),
      weight: dv?.size_value ?? prev.weight,
      unit: mapVariantUnitToProductUnit(dv?.size_unit),
      weight_grams: dv?.weight_grams ?? prev.weight_grams,
    }));
    setVariants([]);
    setVariantError('');
    setFormErrors((prev) => ({
      ...prev,
      price: undefined, mrp: undefined, stock_quantity: undefined,
      weight: undefined, weight_grams: undefined, wholesale_prices: undefined,
    }));
    setPendingRemoveOptions(false);
    setPendingServiceChange(false);
    return true;
  };

  const enablePackSizes = () => {
    if (formData.is_service) return;
    setVariants([createVariantFromSingleOption(formData)]);
    setVariantError('');
    setFormErrors((prev) => ({
      ...prev,
      price: undefined, mrp: undefined, stock_quantity: undefined,
      weight: undefined, weight_grams: undefined, wholesale_prices: undefined,
    }));
  };

  const disablePackSizes = () => {
    if (variants.length <= 1) {
      syncDefaultVariantToSingleOption();
    } else {
      setPendingRemoveOptions(true);
    }
  };

  const handleCatalogTypeChange = (nextIsService) => {
    if (nextIsService && hasVariants) {
      if (variants.length <= 1) {
         syncDefaultVariantToSingleOption();
         handleInputChange('is_service', true);
      } else {
         setPendingServiceChange(true);
      }
      return;
    }
    handleInputChange('is_service', nextIsService);
  };

  /* ─── Validation ─── */



  const validateVariantList = () => {
    if (!hasVariants) return true;
    for (let i = 0; i < variants.length; i += 1) {
      const v = variants[i];
      const price = Number.parseFloat(v.price);
      const mrp = Number.parseFloat(v.mrp);
      const stock = Number.parseInt(v.stock_quantity, 10);
      const size = Number.parseFloat(v.size_value);
      const wg = Number.parseFloat(v.weight_grams);
      const needsManualWeight = !['GRAMS', 'KILOGRAMS', 'POUNDS', 'OUNCES'].includes(v.size_unit);

      if (!v.variant_name?.trim()) { setVariantError(`Option ${i + 1}: enter a name.`); return false; }
      if (!Number.isFinite(size) || size <= 0) { setVariantError(`Option ${i + 1}: size must be greater than 0.`); return false; }
      if (!Number.isFinite(price) || price <= 0) { setVariantError(`Option ${i + 1}: price must be greater than 0.`); return false; }
      if (Number.isFinite(mrp) && mrp > 0 && mrp < price) { setVariantError(`Option ${i + 1}: MRP must be ≥ price.`); return false; }
      if (!Number.isFinite(stock) || stock < 0) { setVariantError(`Option ${i + 1}: stock must be 0 or more.`); return false; }
      if (needsManualWeight && (!Number.isFinite(wg) || wg <= 0)) {
        setVariantError(`Option ${i + 1}: shipping weight required for ${v.size_unit?.toLowerCase() || 'this unit'}.`);
        return false;
      }
    }
    setVariantError('');
    return true;
  };

  const validateForm = () => {
    const errors = {};
    const price = Number.parseFloat(formData.price);
    const mrp = Number.parseFloat(formData.mrp);
    const stock = Number.parseInt(formData.stock_quantity, 10);
    const minStock = Number.parseInt(formData.min_stock_level, 10);
    const weight = Number.parseFloat(formData.weight);
    const manualWg = Number.parseFloat(formData.weight_grams);
    const openQty = Number.parseFloat(formData.opening_quantity_at_price);
    const manualDisc = Number.parseFloat(formData.discount_on_sale_price);

    if (!formData.name?.trim()) errors.name = 'Product name is required.';
    if (!formData.category_id) errors.category_id = 'Category is required.';
    if (!formData.sku?.trim()) errors.sku = 'SKU code is required.';

    if (formData.base_unit && formData.secondary_unit) {
      const conv = Number.parseFloat(formData.unit_conversion_value);
      if (!Number.isFinite(conv) || conv <= 0) errors.unit_conversion_value = 'Unit conversion must be > 0.';
    }

    if (!hasVariants && !formData.is_service) {
      if (!Number.isFinite(mrp) || mrp <= 0) errors.mrp = 'Original MRP is required and must be > 0.';
      if (!Number.isFinite(price) || price <= 0) errors.price = 'Selling price must be > 0.';
      if (Number.isFinite(mrp) && mrp > 0 && Number.isFinite(price) && price > mrp) {
        errors.price = 'Selling price cannot be greater than MRP.';
      }
      if (!Number.isFinite(weight) || weight <= 0) errors.weight = 'Pack size must be > 0.';
      if (singleOptionNeedsManualWeight && (!Number.isFinite(manualWg) || manualWg <= 0))
        errors.weight_grams = 'Shipping weight required for this unit.';
    }

    if (!hasVariants && formData.stock_quantity !== '' && (!Number.isFinite(stock) || stock < 0))
      errors.stock_quantity = 'Stock must be 0 or more.';
    if (formData.min_stock_level !== '' && (!Number.isFinite(minStock) || minStock < 0))
      errors.min_stock_level = 'Minimum stock must be 0 or more.';
    if (formData.opening_quantity_at_price !== '' && (!Number.isFinite(openQty) || openQty < 0))
      errors.opening_quantity_at_price = 'Opening value must be 0 or more.';

    if (formData.discount_on_sale_price !== '') {
      if (!Number.isFinite(manualDisc) || manualDisc < 0) errors.discount_on_sale_price = 'Discount must be 0 or more.';
      else if (manualDisc > 100) errors.discount_on_sale_price = 'Percentage cannot exceed 100.';
    }

    normalizeWholesaleTiers(formData.wholesale_prices).forEach((t, i) => {
      const q = Number.parseFloat(t.quantity);
      const p = Number.parseFloat(t.price);
      if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p < 0)
        errors.wholesale_prices = `Bulk tier ${i + 1} needs valid quantity and price.`;
    });

    const variantsOk = validateVariantList();
    setFormErrors(errors);
    return variantsOk && Object.keys(errors).length === 0;
  };

  /* ─── Submission ─── */

  const normalizeWholesalePayload = () =>
    normalizeWholesaleTiers(formData.wholesale_prices)
      .filter((t) => t.quantity !== '' && t.price !== '')
      .map((t) => ({
        quantity: Number.parseFloat(t.quantity),
        price: Number.parseFloat(t.price),
        ...(t.variant_id ? { variant_id: t.variant_id } : {}),
      }));

  const buildProductPayload = () => {
    if (hasVariants) {
      const dv = getDefaultVariantPayload();
      return {
        ...formData,
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        discount_type: 'percentage',
        price: Number.parseFloat(dv.price) || 0,
        mrp: dv.mrp ? Number.parseFloat(dv.mrp) : null,
        stock_quantity: totalVariantStock,
        min_stock_level: Number.parseInt(formData.min_stock_level, 10) || 0,
        weight: dv.size_value ? Number.parseFloat(dv.size_value) : null,
        unit: mapVariantUnitToProductUnit(dv.size_unit),
        weight_grams: dv.weight_grams ? Number.parseFloat(dv.weight_grams) : null,
        sale_price_without_tax: Boolean(formData.sale_price_without_tax),
        discount_on_sale_price: formData.discount_on_sale_price !== '' ? Number.parseFloat(formData.discount_on_sale_price) : 0,
        unit_conversion_value: formData.unit_conversion_value ? Number.parseFloat(formData.unit_conversion_value) : null,
        opening_quantity_at_price: formData.opening_quantity_at_price !== '' ? Number.parseFloat(formData.opening_quantity_at_price) : null,
        opening_quantity_as_of_date: formData.opening_quantity_as_of_date || null,
        stock_location: formData.stock_location?.trim() || null,
        wholesale_prices: normalizeWholesalePayload(),
      };
    }

    const wg = singleOptionNeedsManualWeight
      ? (Number.parseFloat(formData.weight_grams) || null)
      : autoSingleOptionWeightGrams || null;

    return {
      ...formData,
      name: formData.name.trim(),
      sku: formData.sku.trim(),
      discount_type: 'percentage',
      price: formData.is_service ? 0 : (Number.parseFloat(formData.price) || 0),
      mrp: formData.mrp ? Number.parseFloat(formData.mrp) : null,
      stock_quantity: Number.parseInt(formData.stock_quantity, 10) || 0,
      min_stock_level: Number.parseInt(formData.min_stock_level, 10) || 0,
      weight: formData.is_service ? null : (Number.parseFloat(formData.weight) || null),
      unit: formData.unit,
      weight_grams: formData.is_service ? 0 : wg,
      sale_price_without_tax: Boolean(formData.sale_price_without_tax),
      discount_on_sale_price: formData.discount_on_sale_price !== '' ? Number.parseFloat(formData.discount_on_sale_price) : 0,
      unit_conversion_value: formData.unit_conversion_value ? Number.parseFloat(formData.unit_conversion_value) : null,
      opening_quantity_at_price: formData.opening_quantity_at_price !== '' ? Number.parseFloat(formData.opening_quantity_at_price) : null,
      opening_quantity_as_of_date: formData.opening_quantity_as_of_date || null,
      stock_location: formData.stock_location?.trim() || null,
      wholesale_prices: normalizeWholesalePayload(),
    };
  };

  const saveVariants = async (productId) => {
    const authToken = localStorage.getItem('authToken');
    const res = await fetch(`${apiBaseUrl}/api/admin/products/${productId}/variants`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variants: variants.map((v, i) => ({ ...v, display_order: v.display_order ?? i })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to save size options');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('authToken');
      const url = isEditing
        ? `${apiBaseUrl}/api/admin/products/${editingProduct.id}`
        : `${apiBaseUrl}/api/admin/products`;
      const payload = buildProductPayload();

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `Failed to ${isEditing ? 'update' : 'add'} product`);
      }

      const result = await res.json();
      const saved = result.data || result;

      if (hasVariants || (editingProduct?.variants?.length > 0 && variants.length === 0)) {
        await saveVariants(saved.id);
      }

      toast({
        title: 'Success',
        description: isEditing ? 'Product updated successfully' : 'Product added successfully',
        variant: 'success',
        duration: 3000,
      });
      onProductAdded?.(saved);
      handleClose();
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'adding'} product:`, error);
      toast({
        title: 'Error',
        description: error.message || `Failed to ${isEditing ? 'update' : 'add'} product`,
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass = (name) =>
    `input-field ${formErrors[name] ? 'border-destructive focus-visible:ring-destructive' : ''}`;

  if (!isOpen) return null;

  /* ─── Render ─── */

  return (
    <AdminDialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <AdminDialogContent size="4xl" className="max-w-5xl p-0 overflow-hidden bg-[#fbfbfb] dark:bg-black/40">

        {/* Header */}
        <AdminDialogHeader className="border-b border-border/40 bg-card px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CubeIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <AdminDialogTitle className="whitespace-nowrap text-lg font-semibold">{modalTitle}</AdminDialogTitle>
                  <div className="inline-flex w-fit rounded-lg border border-border/40 bg-muted/40 p-1">
                    <button
                      type="button"
                      onClick={() => handleCatalogTypeChange(false)}
                      className={`text-[11px] px-2.5 py-1 font-medium rounded transition-colors ${
                        !formData.is_service
                          ? 'bg-background shadow-xs text-foreground border border-border/60'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Product
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCatalogTypeChange(true)}
                      className={`text-[11px] px-2.5 py-1 font-medium rounded transition-colors ${
                        formData.is_service
                          ? 'bg-background shadow-xs text-foreground border border-border/60'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Service
                    </button>
                  </div>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {modalDescription}
                </div>
              </div>
            </div>
            <AdminDialogIconButton onClick={handleClose} className="h-8 w-8 rounded-lg" />
          </div>
        </AdminDialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col max-h-[80vh]">
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 custom-scrollbar bg-muted/10">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              {pendingServiceChange && (
                <div className="col-span-full rounded-lg border border-amber-200/60 bg-amber-50 p-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                  <span className="text-[11px] font-medium text-amber-800 leading-tight">Switching will remove all variant options. Sure?</span>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => setPendingServiceChange(false)} className="px-2 py-1 text-[11px] font-medium text-amber-900 border border-amber-300 rounded hover:bg-amber-100 transition-colors">Cancel</button>
                    <button type="button" onClick={() => { syncDefaultVariantToSingleOption(); handleInputChange('is_service', true); }} className="px-2 py-1 text-[11px] font-semibold text-white bg-amber-600 rounded hover:bg-amber-700 transition-colors">Confirm</button>
                  </div>
                </div>
              )}

              {/* LEFT COLUMN */}
              <div className="min-w-0 flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm">

                {/* Basic Details */}
                <div className="p-4 sm:p-5">
                  <h3 className="text-sm font-semibold mb-4 text-foreground">Basic Information</h3>
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-12">
                     <div className="sm:col-span-5">
                       <FieldBlock label={`${catalogTypeLabel} Name`} required error={formErrors.name}>
                         <input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder={formData.is_service ? 'e.g. Dry Fruit Gift Packing' : 'e.g. Premium Almonds'} className={fieldClass('name')}/>
                       </FieldBlock>
                     </div>
                     <div className="sm:col-span-4 lg:col-span-3">
                       <FieldBlock label="Category" required error={formErrors.category_id}>
                         <select value={formData.category_id} onChange={(e) => handleInputChange('category_id', e.target.value)} className={`${fieldClass('category_id')} text-[13px]`}>
                           <option value="">Select category</option>
                           {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>
                       </FieldBlock>
                     </div>
                     <div className="sm:col-span-3 lg:col-span-2">
                       <FieldBlock label="SKU" required error={formErrors.sku}>
                         <div className="relative">
                           <input type="text" value={formData.sku} onChange={(e) => handleInputChange('sku', e.target.value)} className={`${fieldClass('sku')} pr-9 text-[13px]`} placeholder="e.g. ALM-500" />
                           <button type="button" onClick={generateSKU} className="absolute right-1 top-1/2 -translate-y-1/2 text-primary/80 hover:text-primary p-1 rounded-md hover:bg-primary/10 transition-colors" title="Generate SKU">
                             <ArrowPathIcon className="h-3.5 w-3.5" />
                           </button>
                         </div>
                       </FieldBlock>
                     </div>
                     <div className="sm:col-span-12 lg:col-span-2 hidden lg:block">
                       <FieldBlock label="HSN Code">
                          <input type="text" value={formData.item_hsn} onChange={(e) => handleInputChange('item_hsn', e.target.value)} className={`${fieldClass('item_hsn')} text-[13px]`} placeholder="Optional" />
                       </FieldBlock>
                     </div>
                  </div>
                  <div className="mt-4">
                    <FieldBlock label="Description">
                      <textarea rows={2} value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="Brief description of the product..." className="input-field resize-y text-[13px]" />
                    </FieldBlock>
                  </div>
                </div>

                <hr className="border-border/40 m-0" />

                {/* Pricing & Formats */}
                <div className="p-4 sm:p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      {hasVariants ? 'Variant Pricing Summary' : 'Pricing & Stock Basics'}
                    </h3>
                  </div>

                  {hasVariants ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Price range</div>
                        <div className="mt-1 text-base font-semibold text-foreground">{formatPriceRange(variantPriceRange)}</div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Default option</div>
                        <div className="mt-1 text-base font-semibold text-foreground">{defaultVariant?.variant_name?.trim() || 'Not set'}</div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Inventory</div>
                        <div className="mt-1 text-base font-semibold text-foreground">{totalVariantStock} in stock</div>
                        <div className="text-[11px] text-muted-foreground">{activeVariantCount} active option{activeVariantCount === 1 ? '' : 's'}</div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        <FieldBlock label="Original MRP" required={!formData.is_service} error={formErrors.mrp}>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                            <input type="number" step="0.01" min="0" value={formData.mrp} onChange={(e) => handleInputChange('mrp', e.target.value)} placeholder="0.00" className={`${fieldClass('mrp')} pl-6 text-[13px]`} />
                          </div>
                        </FieldBlock>
                        <FieldBlock label="Selling Price" required={!formData.is_service} error={formErrors.price}>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">₹</span>
                            <input type="number" step="0.01" min="0" value={formData.price} onChange={(e) => handleInputChange('price', e.target.value)} placeholder="0.00" className={`${fieldClass('price')} pl-6 font-medium text-[13px]`} />
                          </div>
                        </FieldBlock>
                        <FieldBlock label="Stock Qty" error={formErrors.stock_quantity}>
                           <input type="number" min="0" value={formData.stock_quantity} onChange={(e) => handleInputChange('stock_quantity', e.target.value)} placeholder="0" className={fieldClass('stock_quantity')} />
                        </FieldBlock>
                        <FieldBlock label="Low Stock Alert" error={formErrors.min_stock_level}>
                           <input type="number" min="0" value={formData.min_stock_level} onChange={(e) => handleInputChange('min_stock_level', e.target.value)} placeholder="0" className={fieldClass('min_stock_level')} />
                        </FieldBlock>
                      </div>
                    </div>
                  )}
                </div>

                <hr className="border-border/40 m-0" />

                {/* Taxes & Discounts */}
                <div className="p-4 sm:p-5">
                  <div className="mb-3">
                    <h3 className="text-[13px] font-semibold text-foreground">Taxes & Discounts</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatPricingExtrasSummary(formData)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <FieldBlock label="Manual Discount (%)" error={formErrors.discount_on_sale_price}>
                      <input type="number" step="0.01" min="0" value={formData.discount_on_sale_price} onChange={(e) => handleInputChange('discount_on_sale_price', e.target.value)} className={`${fieldClass('discount_on_sale_price')} text-[13px]`} placeholder="0" />
                    </FieldBlock>
                    <FieldBlock label="Mode">
                       <div className="input-field flex items-center bg-muted/30 text-[12px] font-medium text-muted-foreground">
                         Percentage only
                       </div>
                    </FieldBlock>
                  </div>
                  <p className="mb-3 text-[10px] leading-4 text-muted-foreground">
                    If MRP is set, the saved discount is derived from MRP minus selling price.
                  </p>
                  <div>
                    <div className="mb-1.5">
                      <span className="text-[13px] font-medium text-foreground">Tax Handling</span>
                    </div>
                    <label className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/20 border border-border/40 cursor-pointer hover:bg-muted/40 transition">
                       <input type="checkbox" checked={formData.sale_price_without_tax} onChange={(e) => handleInputChange('sale_price_without_tax', e.target.checked)} className="rounded border-border text-primary h-3.5 w-3.5" />
                       <span className="text-[11px] font-medium text-foreground">Prices exclude tax</span>
                    </label>
                  </div>
                </div>

                <hr className="border-border/40 m-0" />

                {/* Initial Inventory */}
                <div className="p-4 sm:p-5">
                  <div className="mb-3">
                    <h3 className="text-[13px] font-semibold text-foreground">Initial Inventory</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatInventorySummary(formData)}</p>
                  </div>
                  <div className="mb-3">
                    <FieldBlock label="Stock Location" error={formErrors.stock_location}>
                      <input type="text" value={formData.stock_location} onChange={e => handleInputChange('stock_location', e.target.value)} className={`${fieldClass('stock_location')} text-[13px]`} placeholder="e.g. Warehouse A" />
                    </FieldBlock>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldBlock label="Opening Value" error={formErrors.opening_quantity_at_price}>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[12px]">₹</span>
                        <input type="number" step="0.01" min="0" value={formData.opening_quantity_at_price} onChange={e => handleInputChange('opening_quantity_at_price', e.target.value)} className={`${fieldClass('opening_quantity_at_price')} pl-6 text-[13px]`} placeholder="0" />
                      </div>
                    </FieldBlock>
                    <FieldBlock label="As of Date">
                      <input type="date" value={formData.opening_quantity_as_of_date} onChange={e => handleInputChange('opening_quantity_as_of_date', e.target.value)} className={`${fieldClass('opening_quantity_as_of_date')} text-[12px] px-2 h-[34px]`} />
                    </FieldBlock>
                  </div>
                </div>

                <hr className="border-border/40 m-0" />

                {/* Bulk Pricing */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-[13px] font-semibold text-foreground">Bulk Pricing</h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">Optional section. Each tier needs both quantity and price.</p>
                    </div>
                    <button type="button" onClick={addWholesaleTier} className="text-[11px] font-semibold text-primary/80 hover:text-primary flex items-center gap-0.5 bg-primary/5 border border-primary/10 px-2 py-1 rounded transition-colors">
                       <PlusIcon className="h-3 w-3" /> Add Tier
                    </button>
                  </div>
                  {normalizedWholesalePrices.length === 0 ? (
                    <div className="p-3 bg-muted/20 border border-dashed border-border/50 rounded-lg text-center">
                      <p className="text-[11px] text-muted-foreground leading-tight">No quantity-based discounts set.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {normalizedWholesalePrices.map((tier, i) => (
                        <div key={`tier-${i}`} className="rounded-lg border border-border/50 bg-muted/10 p-2.5">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-foreground">Tier {i + 1}</span>
                            <button type="button" onClick={() => removeWholesaleTier(i)} className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0">
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <FieldBlock label="Minimum Quantity" required>
                              <input type="number" min="0" value={tier.quantity} onChange={e => updateWholesaleTier(i, 'quantity', e.target.value)} placeholder="Min Qty" className="input-field text-[12px] h-9 px-2" />
                            </FieldBlock>
                            <FieldBlock label="Tier Price" required>
                              <input type="number" step="0.01" min="0" value={tier.price} onChange={e => updateWholesaleTier(i, 'price', e.target.value)} placeholder="₹ Price" className="input-field text-[12px] h-9 px-2" />
                            </FieldBlock>
                          </div>
                        </div>
                      ))}
                      {formErrors.wholesale_prices && <p className="text-[10px] text-destructive">{formErrors.wholesale_prices}</p>}
                    </div>
                  )}
                </div>

              </div>

              {/* RIGHT COLUMN — fixed track width (see grid) so the main form gets the rest */}
              <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm">
                 <div className="border-b border-border/40 px-3 py-3 sm:px-4">
                    <h3 className="text-[13px] font-semibold text-foreground">Pack sizes & shipping</h3>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      {formData.is_service
                        ? 'Not used for services.'
                        : hasVariants
                          ? 'Pack options, prices, stock, and weights.'
                          : 'Default pack size, shipping weight, or multiple options.'}
                    </p>
                 </div>

                 <div className="sidebar-scroll max-h-[min(32rem,calc(80vh-13rem))] overflow-y-auto overscroll-contain p-3 sm:p-4">
                   {formData.is_service ? (
                     <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-8 text-center">
                       <Cog6ToothIcon className="h-8 w-8 text-muted-foreground/50" />
                       <p className="mt-2 text-[13px] font-semibold text-foreground">Not needed for services</p>
                       <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                         Switch to product for pack sizes and shipping weights.
                       </p>
                     </div>
                   ) : hasVariants ? (
                     <div className="space-y-3">
                       <div className="flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/20 p-2 sm:flex-row sm:items-center sm:justify-between">
                         <div className="min-w-0 px-0.5">
                            <h4 className="text-[12px] font-semibold text-foreground">Variants on</h4>
                            <p className="text-[10px] text-muted-foreground">{activeVariantCount} active · {totalVariantStock} stock</p>
                         </div>
                         {pendingRemoveOptions ? (
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                               <span className="text-[10px] text-destructive font-medium sm:pr-1">Remove all?</span>
                               <button type="button" onClick={() => setPendingRemoveOptions(false)} className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/30">Cancel</button>
                               <button type="button" onClick={() => syncDefaultVariantToSingleOption()} className="rounded bg-destructive px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-destructive/90">Confirm</button>
                            </div>
                         ) : (
                            <button type="button" onClick={() => disablePackSizes()} className="shrink-0 self-start rounded px-2 py-1 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/10 sm:self-auto">
                              Remove options
                            </button>
                         )}
                       </div>

                       {variantError && (
                         <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-[12px] font-medium text-destructive">
                           {variantError}
                         </div>
                       )}
                       <ProductVariantManager variants={variants} onChange={handleVariantsChange} compact />
                     </div>
                   ) : (
                     <div className="space-y-4">
                       <FieldBlock label="Pack Size" required error={formErrors.weight}>
                          <div className="flex gap-2">
                             <input type="number" step="0.001" min="0" value={formData.weight} onChange={(e) => handleInputChange('weight', e.target.value)} className={`${fieldClass('weight')} flex-1 text-[13px]`} placeholder="e.g. 500" />
                             <select value={formData.unit} onChange={(e) => handleInputChange('unit', e.target.value)} className={`${fieldClass('unit')} w-20 px-1 text-[12px]`}>
                               {PRODUCT_UNITS.map(u => <option key={u.value} value={u.value}>{u.shortLabel}</option>)}
                             </select>
                          </div>
                       </FieldBlock>
                       <FieldBlock
                         label="Shipping Weight (g)"
                         required={singleOptionNeedsManualWeight}
                         error={formErrors.weight_grams}
                         hint={singleOptionNeedsManualWeight ? 'Enter explicit grams for this unit.' : 'Calculated from the selected pack size.'}
                       >
                          <input type="number" min="0" value={singleOptionNeedsManualWeight ? formData.weight_grams : autoSingleOptionWeightGrams} onChange={(e) => handleInputChange('weight_grams', e.target.value)} disabled={!singleOptionNeedsManualWeight} className={`${fieldClass('weight_grams')} ${!singleOptionNeedsManualWeight ? 'bg-muted/30 cursor-not-allowed text-muted-foreground' : ''} text-[13px]`} placeholder="Grams" />
                       </FieldBlock>

                       <button type="button" onClick={() => enablePackSizes()} className="text-[12px] font-semibold text-primary flex items-center justify-center gap-1.5 hover:bg-primary/5 rounded-md px-3 py-2 transition-colors w-full border border-dashed border-primary/20 bg-primary/[0.02]">
                         <PlusIcon className="w-3.5 h-3.5" /> Add optional pack sizes and weights
                       </button>
                     </div>
                   )}
                 </div>

                 {!formData.is_service && (
                   <>
                     <hr className="m-0 border-border/40" />
                     <div className="p-3 sm:p-4">
                       <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/10 p-2">
                          <div className="flex min-w-0 items-center gap-2">
                             <div className="shrink-0 text-primary/70">
                               <Cog6ToothIcon className="h-4 w-4" />
                             </div>
                             <div className="min-w-0">
                               <h3 className="text-[12px] font-semibold text-foreground">Adv. units</h3>
                               <p className="truncate text-[10px] text-muted-foreground">{formatUnitConfiguration(formData.base_unit, formData.secondary_unit, formData.unit_conversion_value)}</p>
                             </div>
                          </div>
                          <button type="button" onClick={() => setShowUnitSelectionDialog(true)} className="shrink-0 rounded border border-primary/10 bg-primary/5 px-2 py-1 text-[10px] font-semibold text-primary hover:text-primary/80">
                            Config
                          </button>
                       </div>
                     </div>
                   </>
                 )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border/40 bg-card px-6 py-4 flex items-center justify-end gap-3 z-10 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
             <button
               type="button"
               onClick={handleClose}
               className="px-5 py-2 text-[13px] font-semibold text-foreground bg-muted/40 hover:bg-muted/60 rounded-lg transition-colors"
             >
               Cancel
             </button>
             <button
               type="submit"
               disabled={isLoading}
               className="px-6 py-2 text-[13px] font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
             >
               {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isEditing ? 'Saving...' : `Creating ${catalogTypeLabel}...`}
                  </>
               ) : submitLabel}
             </button>
          </div>
        </form>

        <UnitSelectionDialog
          isOpen={showUnitSelectionDialog}
          onClose={() => setShowUnitSelectionDialog(false)}
          onSave={handleUnitSave}
          baseUnit={formData.base_unit}
          secondaryUnit={formData.secondary_unit}
          unitConversionValue={formData.unit_conversion_value}
        />
      </AdminDialogContent>
    </AdminDialog>
  );
};

export default AddProductModal;
