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
    onPaymentMethodChange({
      type: typeId,
      details: {}
    });
  };

  const handleFieldChange = (fieldName, value) => {
    onPaymentMethodChange(prev => ({
      ...prev,
      details: {
        ...prev.details,
        [fieldName]: value
      }
    }));
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