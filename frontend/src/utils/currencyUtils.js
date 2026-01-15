/**
 * Indian Currency Formatting Utilities
 * Handles large amounts with short forms (K, L, CR) for mobile UI
 */

/**
 * Format Indian currency with short forms for compact display
 * @param {number} amount - The amount to format
 * @param {object} options - Formatting options
 * @param {boolean} options.showSymbol - Whether to show ₹ symbol (default: true)
 * @param {number} options.decimalPlaces - Number of decimal places (default: 1)
 * @param {boolean} options.compact - Use short forms (default: true)
 * @returns {string} Formatted currency string
 */
export const formatIndianCurrency = (amount, options = {}) => {
  const {
    showSymbol = true,
    decimalPlaces = 1,
    compact = true
  } = options;

  if (!amount || amount === 0) {
    return showSymbol ? '₹0' : '0';
  }

  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;
  const prefix = isNegative ? '-' : '';

  if (!compact) {
    // Full format for large displays
    return `${prefix}${showSymbol ? '₹' : ''}${amount.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    })}`;
  }

  let formattedAmount;
  let suffix = '';

  if (absAmount >= 10000000) { // 1 Crore and above
    const crores = absAmount / 10000000;
    formattedAmount = crores.toFixed(decimalPlaces);
    suffix = 'CR';
  } else if (absAmount >= 100000) { // 1 Lakh and above
    const lakhs = absAmount / 100000;
    formattedAmount = lakhs.toFixed(decimalPlaces);
    suffix = 'L';
  } else if (absAmount >= 1000) { // 1 Thousand and above
    const thousands = absAmount / 1000;
    formattedAmount = thousands.toFixed(decimalPlaces);
    suffix = 'K';
  } else {
    // Less than 1000, show full amount
    formattedAmount = absAmount.toString();
  }

  // Remove trailing zeros and decimal point if not needed
  if (formattedAmount.includes('.')) {
    formattedAmount = formattedAmount.replace(/\.?0+$/, '');
  }

  return `${prefix}${showSymbol ? '₹' : ''}${formattedAmount}${suffix}`;
};

/**
 * Format currency for mobile month view (very compact)
 * @param {number} amount - The amount to format
 * @returns {string} Very compact formatted currency
 */
export const formatMobileCurrency = (amount) => {
  return formatIndianCurrency(amount, {
    showSymbol: true,
    decimalPlaces: 0, // No decimals for mobile month view
    compact: true
  });
};

/**
 * Format currency for mobile day view (slightly more detail)
 * @param {number} amount - The amount to format
 * @returns {string} Compact but readable formatted currency
 */
export const formatMobileDayCurrency = (amount) => {
  return formatIndianCurrency(amount, {
    showSymbol: true,
    decimalPlaces: 1,
    compact: true
  });
};

/**
 * Format currency for desktop calendar events
 * @param {number} amount - The amount to format
 * @returns {string} Compact formatted currency for calendar
 */
export const formatCalendarCurrency = (amount) => {
  return formatIndianCurrency(amount, {
    showSymbol: true,
    decimalPlaces: 1,
    compact: true
  });
};

/**
 * Format currency for detailed views (full precision when needed)
 * @param {number} amount - The amount to format
 * @returns {string} Full formatted currency
 */
export const formatDetailedCurrency = (amount) => {
  return formatIndianCurrency(amount, {
    showSymbol: true,
    decimalPlaces: 2,
    compact: false
  });
};

/**
 * Get appropriate currency formatter based on context
 * @param {string} context - The context ('mobile-month', 'mobile-day', 'calendar', 'detailed')
 * @returns {function} The appropriate formatter function
 */
export const getCurrencyFormatter = (context) => {
  switch (context) {
    case 'mobile-month':
      return formatMobileCurrency;
    case 'mobile-day':
      return formatMobileDayCurrency;
    case 'calendar':
      return formatCalendarCurrency;
    case 'detailed':
      return formatDetailedCurrency;
    default:
      return formatIndianCurrency;
  }
};

// Examples of the formatting:
// formatIndianCurrency(25000) → "₹25.0K"
// formatIndianCurrency(250000) → "₹2.5L" 
// formatIndianCurrency(2500000) → "₹25.0L"
// formatIndianCurrency(25000000) → "₹2.5CR"
// formatIndianCurrency(250000000) → "₹25.0CR"
