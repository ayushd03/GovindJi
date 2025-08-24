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
      {/* Date and Basic Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Date *
          </label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="date"
              required
              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                validationErrors.transaction_date ? 'border-red-500' : 'border-border'
              }`}
              value={transactionData.transaction_date}
              onChange={(e) => handleFieldChange('transaction_date', e.target.value)}
            />
          </div>
          {validationErrors.transaction_date && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.transaction_date}</p>
          )}
        </div>

        {/* Amount field - only shown when not vendor order */}
        {!isVendorOrder && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Amount (₹) *
            </label>
            <div className="relative">
              <CurrencyDollarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
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

        {/* Expected delivery date for vendor orders */}
        {isVendorOrder && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Expected Delivery Date
            </label>
            <div className="relative">
              <TruckIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="date"
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={transactionData.expected_delivery_date || ''}
                onChange={(e) => handleFieldChange('expected_delivery_date', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {isVendorOrder ? 'Order Description' : 'Description'} *
        </label>
        <div className="relative">
          <DocumentTextIcon className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
          <textarea
            required
            rows={3}
            className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none ${
              validationErrors.description ? 'border-red-500' : 'border-border'
            }`}
            value={transactionData.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder={
              isVendorOrder ? 'Describe the purpose of this purchase order...' : 'What was this expense for?'
            }
          />
        </div>
        {validationErrors.description && (
          <p className="text-red-500 text-sm mt-1">{validationErrors.description}</p>
        )}
      </div>

      {/* Expense Category Selection - This is now the main category selector */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Expense Category *
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {EXPENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                transactionData.expense_category === cat
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'Vendor Order' ? (
                <div className="flex flex-col items-center space-y-1">
                  <CubeIcon className="w-4 h-4" />
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


      {/* Payment Method */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Payment Method *
        </label>
        <PaymentMethodSelector
          paymentMethod={transactionData.payment_method}
          onPaymentMethodChange={handlePaymentMethodChange}
          errors={validationErrors.payment_method || {}}
        />
      </div>

      {/* Vendor Order Terms */}
      {isVendorOrder && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Payment Terms
            </label>
            <select
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={transactionData.payment_terms || ''}
              onChange={(e) => handleFieldChange('payment_terms', e.target.value)}
            >
              <option value="">Select payment terms</option>
              <option value="net_0">Net 0 (Immediate)</option>
              <option value="net_15">Net 15</option>
              <option value="net_30">Net 30</option>
              <option value="net_45">Net 45</option>
              <option value="net_60">Net 60</option>
              <option value="net_90">Net 90</option>
              <option value="advance">Advance Payment</option>
              <option value="cod">Cash on Delivery</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Order Priority
            </label>
            <select
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={transactionData.priority || 'normal'}
              onChange={(e) => handleFieldChange('priority', e.target.value)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      )}

      {/* Receipt/Reference for non-vendor orders */}
      {!isVendorOrder && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Receipt/Reference Number
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            value={transactionData.reference_number || ''}
            onChange={(e) => handleFieldChange('reference_number', e.target.value)}
            placeholder="Receipt or reference number..."
          />
        </div>
      )}

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Additional Notes
        </label>
        <textarea
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          value={transactionData.notes}
          onChange={(e) => handleFieldChange('notes', e.target.value)}
          placeholder={
            isVendorOrder ? 'Any special instructions, delivery requirements, or additional notes...' :
            'Any additional details or notes...'
          }
        />
      </div>
    </div>
  );
};

export default UnifiedExpenseForm;