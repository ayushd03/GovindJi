import React, { useEffect, useState } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CubeIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { formatDiscountPercent } from '../../../utils/productPricing';

const SIZE_UNITS = [
  { value: 'GRAMS', label: 'Grams (g)' },
  { value: 'KILOGRAMS', label: 'Kilograms (kg)' },
  { value: 'POUNDS', label: 'Pounds (lb)' },
  { value: 'OUNCES', label: 'Ounces (oz)' },
  { value: 'PIECES', label: 'Pieces' },
  { value: 'LITERS', label: 'Liters (L)' },
  { value: 'MILLILITERS', label: 'Milliliters (ml)' },
  { value: 'PACKETS', label: 'Packets' },
  { value: 'BOXES', label: 'Boxes' },
  { value: 'BAGS', label: 'Bags' },
  { value: 'DOZENS', label: 'Dozens' },
  { value: 'SETS', label: 'Sets' },
  { value: 'PAIRS', label: 'Pairs' },
];

export const createEmptyVariant = (isDefault = false, displayOrder = 0) => ({
  variant_name: '',
  size_value: '',
  size_unit: 'GRAMS',
  price: '',
  mrp: '',
  stock_quantity: '',
  weight_grams: '',
  is_default: isDefault,
  is_active: true,
  display_order: displayOrder,
});

const normalizeVariants = (variants = []) =>
  variants.map((variant, index) => ({
    ...variant,
    mrp: variant?.mrp ?? '',
    weight_grams: variant?.weight_grams ?? '',
    stock_quantity: variant?.stock_quantity ?? '',
    is_active: variant?.is_active !== false,
    is_default: variant?.is_default === true,
    display_order: variant?.display_order ?? index,
  }));

const calculateWeight = (sizeValue, sizeUnit) => {
  const value = Number.parseFloat(sizeValue);
  if (!value || value <= 0) return '';
  switch (sizeUnit) {
    case 'GRAMS': return Math.round(value);
    case 'KILOGRAMS': return Math.round(value * 1000);
    case 'POUNDS': return Math.round(value * 453.592);
    case 'OUNCES': return Math.round(value * 28.3495);
    default: return '';
  }
};

const getDiscountPercent = (mrp, price) => {
  const m = Number.parseFloat(mrp);
  const p = Number.parseFloat(price);
  if (!Number.isFinite(m) || !Number.isFinite(p) || m <= p) return 0;
  return ((m - p) / m) * 100;
};

const getUnitSuffix = (sizeUnit) => {
  switch (sizeUnit) {
    case 'KILOGRAMS': return 'kg';
    case 'GRAMS': return 'g';
    case 'LITERS': return 'L';
    case 'MILLILITERS': return 'ml';
    case 'PIECES': return 'pcs';
    case 'POUNDS': return 'lb';
    case 'OUNCES': return 'oz';
    case 'PACKETS': return 'pkt';
    case 'BOXES': return 'box';
    case 'BAGS': return 'bag';
    case 'DOZENS': return 'doz';
    case 'SETS': return 'set';
    case 'PAIRS': return 'pair';
    default: return '';
  }
};

const formatCurrencyValue = (value, fallback = '') => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? `₹${n.toFixed(2)}` : fallback;
};

const formatStockValue = (value) => {
  const stock = Number.parseInt(value, 10);
  return Number.isFinite(stock) && stock >= 0 ? `${stock} stk` : 'Stock pending';
};

const labelClass = 'text-[11px] font-medium uppercase tracking-wider text-muted-foreground';
const inputClass = 'input-field h-9 px-2.5 text-sm';

const VariantField = ({
  label,
  hint,
  children,
  required = false,
  className = '',
}) => (
  <div className={className}>
    <div className="mb-1">
      <label className={labelClass}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
    </div>
    {children}
    {hint ? <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
  </div>
);

const ProductVariantManager = ({ variants = [], onChange, compact = false }) => {
  const normalizedVariants = normalizeVariants(variants);
  const [expandedIndex, setExpandedIndex] = useState(0);

  useEffect(() => {
    if (normalizedVariants.length === 0) {
      setExpandedIndex(-1);
      return;
    }
    if (expandedIndex > normalizedVariants.length - 1) {
      setExpandedIndex(normalizedVariants.length - 1);
    }
  }, [normalizedVariants.length, expandedIndex]);

  const commitVariants = (nextVariants) => {
    onChange?.(nextVariants.map((v, i) => ({ ...v, display_order: i })));
  };

  const updateVariant = (index, field, value) => {
    const next = [...normalizedVariants];
    next[index] = { ...next[index], [field]: value };

    if (field === 'is_default' && value === true) {
      next.forEach((v, i) => {
        if (i !== index) next[i] = { ...v, is_default: false };
      });
    }

    if (field === 'size_value' || field === 'size_unit') {
      const sv = field === 'size_value' ? value : next[index].size_value;
      const su = field === 'size_unit' ? value : next[index].size_unit;
      const w = calculateWeight(sv, su);
      if (w !== '') next[index].weight_grams = w;
      else if (field === 'size_unit') next[index].weight_grams = '';
    }

    commitVariants(next);
  };

  const addVariant = () => {
    setExpandedIndex(normalizedVariants.length);
    commitVariants([
      ...normalizedVariants,
      createEmptyVariant(normalizedVariants.length === 0, normalizedVariants.length),
    ]);
  };

  const removeVariant = (index) => {
    const next = normalizedVariants.filter((_, i) => i !== index);
    if (next.length > 0 && !next.some((v) => v.is_default)) {
      next[0] = { ...next[0], is_default: true };
    }
    setExpandedIndex((prev) => {
      if (prev >= next.length) return Math.max(0, next.length - 1);
      if (prev > index) return prev - 1;
      return prev;
    });
    commitVariants(next);
  };

  const moveVariant = (index, direction) => {
    const next = [...normalizedVariants];
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    if (expandedIndex === index) setExpandedIndex(swap);
    else if (expandedIndex === swap) setExpandedIndex(index);
    commitVariants(next);
  };

  const generateVariantName = (index) => {
    const v = normalizedVariants[index];
    if (!v?.size_value || !v?.size_unit) return;
    const suffix = getUnitSuffix(v.size_unit);
    if (suffix) updateVariant(index, 'variant_name', `${v.size_value}${suffix}`);
  };

  if (normalizedVariants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 px-5 py-6 text-center">
        <CubeIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-semibold text-foreground">No size options yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add sizes like 250g, 500g, or 1kg for customer selection.
        </p>
        <button
          type="button"
          onClick={addVariant}
          className="btn-primary mt-4 inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold"
        >
          <PlusIcon className="mr-1.5 h-4 w-4" />
          Add First Option
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {normalizedVariants.map((variant, index) => {
        const isExpanded = expandedIndex === index;
        const suffix = getUnitSuffix(variant.size_unit);
        const sizeLabel = variant.size_value && suffix ? `${variant.size_value}${suffix}` : 'Size pending';
        const priceLabel = formatCurrencyValue(variant.price);
        const stockLabel = formatStockValue(variant.stock_quantity);
        const isWeightUnit = ['GRAMS', 'KILOGRAMS', 'POUNDS', 'OUNCES'].includes(variant.size_unit);
        const discount = getDiscountPercent(variant.mrp, variant.price);
        const compactSummary = [
          sizeLabel,
          priceLabel || 'Price pending',
          stockLabel,
          discount > 0 ? `${formatDiscountPercent(discount)}% off` : null,
          variant.is_default ? 'Default' : null,
          variant.is_active === false ? 'Hidden' : null,
        ].filter(Boolean).join(' • ');
        const compactInputClass = compact ? 'input-field h-8 px-2 text-[13px]' : inputClass;

        return (
          <div
            key={variant.id || `${index}-${variant.display_order}`}
            className={`rounded-xl border transition-colors ${
              isExpanded ? 'border-primary/20 shadow-sm' : 'border-border/60 hover:border-border'
            }`}
          >
            {/* Collapsed header -- always visible */}
            <div className={`flex items-start gap-2 ${compact ? 'px-2.5 py-2' : 'px-3 py-2'}`}>
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                className={`flex min-w-0 flex-1 gap-2 text-left ${compact ? 'items-start' : 'items-center'}`}
              >
                <ChevronRightIcon
                  className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
                <div className="min-w-0 flex-1">
                  {compact ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-muted/40 px-1 text-[10px] font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="truncate text-[13px] font-semibold leading-5 text-foreground">
                          {variant.variant_name?.trim() || `Option ${index + 1}`}
                        </div>
                      </div>
                      <div className="mt-0.5 truncate pr-1 text-[11px] leading-4 text-muted-foreground">
                        {compactSummary}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="truncate text-sm font-semibold text-foreground">
                        {variant.variant_name?.trim() || `Option ${index + 1}`}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {priceLabel && (
                          <span className="text-xs font-medium text-foreground">{priceLabel}</span>
                        )}
                        {discount > 0 && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {formatDiscountPercent(discount)}% off
                          </span>
                        )}
                        {variant.is_default && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            Default
                          </span>
                        )}
                        {variant.is_active === false && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            Hidden
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </button>

              <div className={`flex shrink-0 items-center ${compact ? 'gap-1' : 'gap-4'}`}>
                {/* Toggles */}
                {isExpanded && !compact && (
                  <div className="hidden sm:flex items-center gap-4 border-r border-border/60 pr-4 mr-1">
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={variant.is_default}
                        onChange={(e) => updateVariant(index, 'is_default', e.target.checked)}
                        className="rounded-full border-border text-primary focus:ring-primary w-3.5 h-3.5 bg-background cursor-pointer"
                      />
                      <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">Default</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={variant.is_active}
                        onChange={(e) => updateVariant(index, 'is_active', e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 bg-background cursor-pointer"
                      />
                      <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">Visible</span>
                    </label>
                  </div>
                )}

                <div className="flex shrink-0 items-center gap-0.5">
                  {!compact && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveVariant(index, 'up'); }}
                        disabled={index === 0}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ChevronUpIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveVariant(index, 'down'); }}
                        disabled={index === normalizedVariants.length - 1}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeVariant(index); }}
                    className={`inline-flex items-center justify-center rounded-lg text-destructive/70 transition hover:bg-destructive/10 hover:text-destructive ${compact ? 'h-6 w-6' : 'h-7 w-7'}`}
                    aria-label="Remove"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded edit fields */}
            {isExpanded && (
              <div className={`border-t border-border/60 ${compact ? 'space-y-2.5 px-2.5 py-2.5' : 'space-y-3 px-3 py-3'}`}>
                <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'sm:grid-cols-3'}`}>
                  <VariantField label="Option name" required className={compact ? 'col-span-2' : ''}>
                    <input
                      type="text"
                      value={variant.variant_name}
                      onChange={(e) => updateVariant(index, 'variant_name', e.target.value)}
                      placeholder="e.g. 500g"
                      className={compactInputClass}
                    />
                  </VariantField>
                  <VariantField label="Size" required>
                    <input
                      type="number"
                      step="0.001"
                      value={variant.size_value}
                      onChange={(e) => updateVariant(index, 'size_value', e.target.value)}
                      onBlur={() => generateVariantName(index)}
                      placeholder="500"
                      className={compactInputClass}
                    />
                  </VariantField>
                  <VariantField label="Unit" required>
                    <select
                      value={variant.size_unit}
                      onChange={(e) => updateVariant(index, 'size_unit', e.target.value)}
                      onBlur={() => generateVariantName(index)}
                      className={compactInputClass}
                    >
                      {SIZE_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </VariantField>
                </div>

                <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'sm:grid-cols-4'}`}>
                  <VariantField label="Selling price" required>
                    <input
                      type="number"
                      step="0.01"
                      value={variant.price}
                      onChange={(e) => updateVariant(index, 'price', e.target.value)}
                      placeholder="499.00"
                      className={compactInputClass}
                    />
                  </VariantField>
                  <VariantField label="MRP" hint="Compare-at price">
                    <input
                      type="number"
                      step="0.01"
                      value={variant.mrp}
                      onChange={(e) => updateVariant(index, 'mrp', e.target.value)}
                      placeholder="549.00"
                      className={compactInputClass}
                    />
                  </VariantField>
                  <VariantField label="Stock" required>
                    <input
                      type="number"
                      min="0"
                      value={variant.stock_quantity}
                      onChange={(e) => updateVariant(index, 'stock_quantity', e.target.value)}
                      placeholder="0"
                      className={compactInputClass}
                    />
                  </VariantField>
                  <VariantField
                    label={
                      <>
                        Weight (g)
                        {isWeightUnit && <span className="ml-1 text-emerald-600">Auto</span>}
                      </>
                    }
                    hint={isWeightUnit ? 'From size & unit' : 'Required for shipping'}
                    required={!isWeightUnit}
                  >
                    <input
                      type="number"
                      min="0"
                      value={variant.weight_grams}
                      onChange={(e) => updateVariant(index, 'weight_grams', e.target.value)}
                      placeholder={isWeightUnit ? 'Auto' : 'Enter grams'}
                      disabled={isWeightUnit}
                      className={`${compactInputClass} ${isWeightUnit ? 'cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-700' : ''}`}
                    />
                  </VariantField>
                </div>

                {/* Compact mode keeps toggles here to avoid crowding the row header. */}
                <div className={`${compact ? 'flex' : 'flex sm:hidden'} flex-wrap gap-x-6 gap-y-2 border-t border-border/40 pt-2`}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={variant.is_default}
                        onChange={(e) => updateVariant(index, 'is_default', e.target.checked)}
                        className="rounded-full border-border text-primary focus:ring-primary w-4 h-4"
                      />
                      <span className="font-medium text-foreground text-[13px]">Default option</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={variant.is_active}
                        onChange={(e) => updateVariant(index, 'is_active', e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                      />
                      <span className="font-medium text-foreground text-[13px]">Visible in storefront</span>
                    </label>
                  </div>

                {compact && (
                  <div className="flex items-center gap-2 border-t border-border/40 pt-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveVariant(index, 'up')}
                        disabled={index === 0}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-border/60 px-2 text-[11px] font-medium text-muted-foreground transition hover:bg-muted/30 hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronUpIcon className="h-3.5 w-3.5" />
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveVariant(index, 'down')}
                        disabled={index === normalizedVariants.length - 1}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-border/60 px-2 text-[11px] font-medium text-muted-foreground transition hover:bg-muted/30 hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                        Down
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addVariant}
        className={`flex w-full items-center justify-center gap-1.5 border border-dashed border-border/70 font-semibold text-muted-foreground transition hover:border-primary/30 hover:text-primary ${compact ? 'rounded-lg py-2 text-[13px]' : 'rounded-xl py-2.5 text-sm'}`}
      >
        <PlusIcon className="h-4 w-4" />
        Add New Option
      </button>
    </div>
  );
};

export default ProductVariantManager;
