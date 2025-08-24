import React from 'react';
import { 
  CalendarIcon, 
  CurrencyDollarIcon, 
  DocumentTextIcon, 
  TruckIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import PaymentMethodSelector from './PaymentMethodSelector';
import MultiVendorItemManager from './MultiVendorItemManager';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

// Simplified expense categories - this replaces the complex top-level categories
const EXPENSE_CATEGORIES = [
  'Store Utilities',
  'Office Supplies', 
  'Marketing',
  'Maintenance',
  'Transportation',
  'Miscellaneous',
  'Vendor Order' // This is the special category for vendor orders
];

const UnifiedExpenseForm = ({
  transactionData,
  updateTransactionData,
  dependencies,
  validationErrors = {}
}) => {
  const handleFieldChange = (field, value) => {
    updateTransactionData({ [field]: value });
  };

  const handlePaymentMethodChange = (paymentMethod) => {
    updateTransactionData({ payment_method: paymentMethod });
  };

  const handleItemsChange = (items) => {
    updateTransactionData({ items });
  };

  const handleCategoryChange = (category) => {
    handleFieldChange('expense_category', category);
    
    // If changing to vendor order, reset amount to 0 as it will be calculated from items
    if (category === 'Vendor Order') {
      handleFieldChange('total_amount', 0);
    }
  };


  const isVendorOrder = transactionData.expense_category === 'Vendor Order';

  return (
    <div className="space-y-6">
      {/* Category Selection First - Most Important */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          What type of expense is this? *
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {EXPENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className={`p-4 rounded-lg border text-sm font-medium transition-all hover:shadow-sm ${
                transactionData.expense_category === cat
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'Vendor Order' ? (
                <div className="flex flex-col items-center space-y-1">
                  <CubeIcon className="w-5 h-5" />
                  <span>Vendor Order</span>
                </div>
              ) : (
                cat
              )}
            </button>
          ))}
        </div>
        {validationErrors.expense_category && (
          <p className="text-red-500 text-sm mt-1">{validationErrors.expense_category}</p>
        )}
      </div>

      {/* Amount and Date - Compact Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!isVendorOrder && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className={`w-full pl-8 pr-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base ${
                  validationErrors.total_amount ? 'border-red-500' : 'border-border'
                }`}
                value={transactionData.total_amount || ''}
                onChange={(e) => handleFieldChange('total_amount', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            {validationErrors.total_amount && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.total_amount}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Date *
          </label>
          <input
            type="date"
            required
            className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base ${
              validationErrors.transaction_date ? 'border-red-500' : 'border-border'
            }`}
            value={transactionData.transaction_date}
            onChange={(e) => handleFieldChange('transaction_date', e.target.value)}
          />
          {validationErrors.transaction_date && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.transaction_date}</p>
          )}
        </div>

        {isVendorOrder && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Expected Delivery
            </label>
            <input
              type="date"
              className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base"
              value={transactionData.expected_delivery_date || ''}
              onChange={(e) => handleFieldChange('expected_delivery_date', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Description with Notes - Combined */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {isVendorOrder ? 'Order Description & Notes' : 'Description & Notes'} *
        </label>
        <textarea
          required
          rows={3}
          className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none text-base ${
            validationErrors.description ? 'border-red-500' : 'border-border'
          }`}
          value={transactionData.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          placeholder={isVendorOrder ? 'Describe the order purpose, special instructions, delivery requirements...' : 'What was this expense for? Any additional notes...'}
        />
        {validationErrors.description && (
          <p className="text-red-500 text-sm mt-1">{validationErrors.description}</p>
        )}
      </div>

      {/* Vendor Order Items Section */}
      {isVendorOrder && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CubeIcon className="w-5 h-5" />
              <span>Order Items</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Add items and select vendors for each item. Multiple vendors can be used in one order.
            </p>
          </CardHeader>
          <CardContent>
            <MultiVendorItemManager
              items={transactionData.items || []}
              onItemsChange={handleItemsChange}
              validationErrors={validationErrors.items || {}}
              showMultiVendorFeatures={true}
            />
          </CardContent>
        </Card>
      )}


      {/* Payment Method - Simplified */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          How did you pay? *
        </label>
        <PaymentMethodSelector
          paymentMethod={transactionData.payment_method}
          onPaymentMethodChange={handlePaymentMethodChange}
          errors={validationErrors.payment_method || {}}
        />
      </div>


      {/* Additional Details */}
      {!isVendorOrder && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Receipt/Reference (optional)
          </label>
          <input
            type="text"
            className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base"
            value={transactionData.reference_number || ''}
            onChange={(e) => handleFieldChange('reference_number', e.target.value)}
            placeholder="Receipt number..."
          />
        </div>
      )}
    </div>
  );
};

export default UnifiedExpenseForm;