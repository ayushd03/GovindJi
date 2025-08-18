import React, { useState, useEffect } from 'react';
import { 
    BanknotesIcon, 
    DevicePhoneMobileIcon, 
    DocumentArrowDownIcon 
} from '@heroicons/react/24/outline';

// Static transaction types configuration
const TRANSACTION_TYPES = {
    cash: {
        id: 'cash',
        name: 'Cash',
        description: 'Cash payment',
        icon: BanknotesIcon,
        fields: []
    },
    upi: {
        id: 'upi',
        name: 'UPI',
        description: 'UPI payment',
        icon: DevicePhoneMobileIcon,
        fields: [
            {
                field_name: 'reference_number',
                field_label: 'Reference Number',
                field_type: 'text',
                is_required: true,
                placeholder: 'Enter UPI reference number'
            }
        ]
    },
    cheque: {
        id: 'cheque',
        name: 'Cheque',
        description: 'Cheque payment',
        icon: DocumentArrowDownIcon,
        fields: [
            {
                field_name: 'cheque_number',
                field_label: 'Cheque Number',
                field_type: 'text',
                is_required: true,
                placeholder: 'Enter cheque number'
            },
            {
                field_name: 'release_date',
                field_label: 'To be Released Date',
                field_type: 'date',
                is_required: true,
                placeholder: 'Select release date'
            }
        ]
    }
};

const StaticTransactionTypeSelector = ({ 
    selectedType, 
    onTypeChange, 
    fieldValues = {}, 
    onFieldChange,
    errors = {},
    className = ""
}) => {
    const [selectedTypeData, setSelectedTypeData] = useState(null);

    useEffect(() => {
        if (selectedType && TRANSACTION_TYPES[selectedType]) {
            setSelectedTypeData(TRANSACTION_TYPES[selectedType]);
        } else {
            setSelectedTypeData(null);
        }
    }, [selectedType]);

    const handleFieldChange = (fieldName, value) => {
        onFieldChange(fieldName, value);
    };

    const renderField = (field) => {
        const value = fieldValues[field.field_name] || '';
        const error = errors[field.field_name];

        switch (field.field_type) {
            case 'date':
                return (
                    <div key={field.field_name} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.field_label}
                            {field.is_required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                            type="date"
                            value={value}
                            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                error ? 'border-red-500' : 'border-gray-300'
                            }`}
                            required={field.is_required}
                        />
                        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                    </div>
                );

            default: // text
                return (
                    <div key={field.field_name} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.field_label}
                            {field.is_required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                error ? 'border-red-500' : 'border-gray-300'
                            }`}
                            required={field.is_required}
                            placeholder={field.placeholder}
                        />
                        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                    </div>
                );
        }
    };

    return (
        <div className={className}>
            {/* Transaction Type Selector */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {Object.values(TRANSACTION_TYPES).map(type => {
                        const IconComponent = type.icon;
                        const isSelected = selectedType === type.id;
                        
                        return (
                            <button
                                key={type.id}
                                type="button"
                                onClick={() => onTypeChange(type.id)}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 ${
                                    isSelected 
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' 
                                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                                }`}
                            >
                                <IconComponent className="w-6 h-6 mb-1" />
                                <span className="text-xs font-medium">{type.name}</span>
                            </button>
                        );
                    })}
                </div>
                {errors.transaction_type_id && (
                    <p className="text-red-500 text-sm mt-1">{errors.transaction_type_id}</p>
                )}
            </div>

            {/* Dynamic Fields */}
            {selectedType && selectedTypeData && (
                <div className="mt-6">
                    {selectedTypeData.description && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <h3 className="font-medium text-gray-900 mb-1">
                                {selectedTypeData.name} Details
                            </h3>
                            <p className="text-sm text-gray-600">{selectedTypeData.description}</p>
                        </div>
                    )}
                    
                    {selectedTypeData.fields.length > 0 ? (
                        <div className="space-y-4">
                            {selectedTypeData.fields.map(renderField)}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm italic">
                            No additional fields required for this transaction type.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default StaticTransactionTypeSelector;