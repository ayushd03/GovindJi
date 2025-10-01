// Static Transaction Types Configuration
// No database operations required - all transaction types are hardcoded

const TRANSACTION_TYPES = {
  CASH: {
    id: 'cash',
    name: 'Cash',
    description: 'Cash payment',
    icon: 'BanknotesIcon',
    fields: []
  },
  UPI: {
    id: 'upi',
    name: 'UPI',
    description: 'UPI payment',
    icon: 'DevicePhoneMobileIcon',
    fields: [
      {
        field_name: 'reference_number',
        field_label: 'Reference Number (Optional)',
        field_type: 'text',
        is_required: false,
        display_order: 1,
        placeholder: 'Enter UPI reference number'
      }
    ]
  },
  CHEQUE: {
    id: 'cheque',
    name: 'Cheque',
    description: 'Cheque payment',
    icon: 'DocumentArrowDownIcon',
    fields: [
      {
        field_name: 'cheque_number',
        field_label: 'Cheque Number',
        field_type: 'text',
        is_required: true,
        display_order: 1,
        placeholder: 'Enter cheque number'
      },
      {
        field_name: 'release_date',
        field_label: 'To be Released Date',
        field_type: 'date',
        is_required: true,
        display_order: 2,
        placeholder: 'Select release date'
      }
    ]
  }
};

// Helper functions for transaction types
const getTransactionTypes = () => {
  return Object.values(TRANSACTION_TYPES);
};

const getTransactionTypeById = (id) => {
  return Object.values(TRANSACTION_TYPES).find(type => type.id === id);
};

const getTransactionTypeByName = (name) => {
  return Object.values(TRANSACTION_TYPES).find(type => 
    type.name.toLowerCase() === name.toLowerCase()
  );
};

const validateTransactionTypeId = (id) => {
  return Object.values(TRANSACTION_TYPES).some(type => type.id === id);
};

const getFormSchemaForType = (id) => {
  const transactionType = getTransactionTypeById(id);
  if (!transactionType) {
    return null;
  }
  
  return {
    transaction_type: {
      id: transactionType.id,
      name: transactionType.name,
      description: transactionType.description,
      icon: transactionType.icon
    },
    fields: transactionType.fields.sort((a, b) => a.display_order - b.display_order)
  };
};

// Validation function for dynamic fields
const validateTransactionFields = (transactionTypeId, fieldValues) => {
  const transactionType = getTransactionTypeById(transactionTypeId);
  if (!transactionType) {
    return { isValid: false, errors: { general: 'Invalid transaction type' } };
  }

  const errors = {};
  let isValid = true;

  // Validate required fields
  transactionType.fields.forEach(field => {
    if (field.is_required) {
      const value = fieldValues[field.field_name];
      if (!value || value.toString().trim() === '') {
        errors[field.field_name] = `${field.field_label} is required`;
        isValid = false;
      }
    }
  });

  return { isValid, errors };
};

module.exports = {
  TRANSACTION_TYPES,
  getTransactionTypes,
  getTransactionTypeById,
  getTransactionTypeByName,
  validateTransactionTypeId,
  getFormSchemaForType,
  validateTransactionFields
};