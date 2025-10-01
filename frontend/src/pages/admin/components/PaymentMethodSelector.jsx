import React from 'react';
import StaticTransactionTypeSelector from '../../../components/StaticTransactionTypeSelector';

const PaymentMethodSelector = ({
  paymentMethod,
  onPaymentMethodChange,
  errors = {},
  className = "",
  required = true
}) => {
  const handleTypeChange = (typeId) => {
    // Only reset details if changing to a different payment type
    // Preserve details if clicking the same type again
    if (paymentMethod?.type !== typeId) {
      onPaymentMethodChange({
        type: typeId,
        details: {}
      });
    }
  };

  const handleFieldChange = (fieldName, value) => {
    onPaymentMethodChange({
      type: paymentMethod?.type,
      details: {
        ...(paymentMethod?.details || {}),
        [fieldName]: value
      }
    });
  };

  return (
    <div className={className}>
      <StaticTransactionTypeSelector
        selectedType={paymentMethod?.type}
        onTypeChange={handleTypeChange}
        fieldValues={paymentMethod?.details || {}}
        onFieldChange={handleFieldChange}
        errors={errors}
        required={required}
      />
    </div>
  );
};

export default PaymentMethodSelector;