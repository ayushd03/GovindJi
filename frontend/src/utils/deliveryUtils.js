export const formatDeliveryCurrency = (value) => {
  const amount = Number.parseFloat(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Free';
  }

  return `₹${amount.toFixed(2)}`;
};

export const formatDeliveryDate = (dateString) => {
  if (!dateString) {
    return 'Not available';
  }

  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDeliveryRange = (startDate, endDate) => {
  if (!startDate && !endDate) {
    return 'Calculated at checkout';
  }

  if (startDate && endDate && startDate === endDate) {
    return formatDeliveryDate(startDate);
  }

  if (!startDate) {
    return formatDeliveryDate(endDate);
  }

  if (!endDate) {
    return formatDeliveryDate(startDate);
  }

  return `${formatDeliveryDate(startDate)} - ${formatDeliveryDate(endDate)}`;
};

export const getDeliveryModeLabel = (mode) => {
  if (mode === 'Express') {
    return 'Express delivery';
  }

  return 'Normal delivery';
};

export const getSelectedDeliveryOption = (options = [], mode = '') => (
  options.find((option) => option.mode === mode) || options[0] || null
);
