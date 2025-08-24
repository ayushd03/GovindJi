import React, { useState, useEffect } from 'react';
import { 
  CalendarIcon, 
  CurrencyDollarIcon, 
  DocumentTextIcon, 
  TruckIcon,
  CubeIcon,
  UserIcon,
  BuildingOfficeIcon
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
  'Vendor Order', // This is the special category for vendor orders (creates credit for vendor)
  'Vendor Payment' // This is for paying vendors (creates debit for vendor)
];

const UnifiedExpenseForm = ({
  transactionData,
  updateTransactionData,
  dependencies,
  validationErrors = {}
}) => {
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);

  // Define expense category checks
  const isVendorOrder = transactionData.expense_category === 'Vendor Order';
  const isVendorPayment = transactionData.expense_category === 'Vendor Payment';

  // Filter vendors based on search
  useEffect(() => {
    if (!dependencies.parties) return;
    
    const vendors = dependencies.parties.filter(party => party.party_type === 'vendor');
    if (vendorSearch) {
      setFilteredVendors(
        vendors.filter(vendor =>
          vendor.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
          (vendor.contact_person && vendor.contact_person.toLowerCase().includes(vendorSearch.toLowerCase()))
        )
      );
    } else {
      setFilteredVendors(vendors.slice(0, 10)); // Show first 10 vendors
    }
  }, [vendorSearch, dependencies.parties]);

  // Set selected vendor from transaction data if available
  useEffect(() => {
    if (isVendorPayment && transactionData.parties && transactionData.parties.length > 0 && dependencies.parties) {
      const partyId = transactionData.parties[0].party_id;
      const vendor = dependencies.parties.find(p => p.id === partyId && p.party_type === 'vendor');
      if (vendor && !selectedVendor) {
        setSelectedVendor(vendor);
        setVendorSearch(vendor.name);
      }
    }
  }, [isVendorPayment, transactionData.parties, dependencies.parties, selectedVendor]);

  // Close vendor dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.vendor-dropdown-container')) {
        setShowVendorDropdown(false);
      }
    };

    if (showVendorDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showVendorDropdown]);

  const handleFieldChange = (field, value) => {
    updateTransactionData({ [field]: value });
  };

  const handlePaymentMethodChange = (paymentMethod) => {
    updateTransactionData({ payment_method: paymentMethod });
  };

  const handleItemsChange = (items) => {
    updateTransactionData({ items });
  };

  const handleVendorSelect = (vendor) => {
    setSelectedVendor(vendor);
    setVendorSearch(vendor.name);
    setShowVendorDropdown(false);
    
    // Update the parties in transaction data
    updateTransactionData({ 
      parties: [{
        party_id: vendor.id,
        party_name: vendor.name,
        party_type: 'vendor',
        amount: transactionData.total_amount || 0
      }]
    });
  };

  const handleCategoryChange = (category) => {
    handleFieldChange('expense_category', category);
    
    // Reset relevant fields when changing categories
    if (category === 'Vendor Order') {
      handleFieldChange('total_amount', 0);
      setSelectedVendor(null);
      setVendorSearch('');
      updateTransactionData({ parties: [] });
    } else if (category === 'Vendor Payment') {
      handleFieldChange('total_amount', 0);
      updateTransactionData({ items: [] });
    } else {
      // For other categories, reset vendor-related data
      setSelectedVendor(null);
      setVendorSearch('');
      updateTransactionData({ parties: [], items: [] });
    }
  };

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
              ) : cat === 'Vendor Payment' ? (
                <div className="flex flex-col items-center space-y-1">
                  <BuildingOfficeIcon className="w-5 h-5" />
                  <span>Vendor Payment</span>
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

      {/* Vendor Selection for Vendor Payment */}
      {isVendorPayment && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Select Vendor to Pay *
          </label>
          <div className="relative vendor-dropdown-container">
            <input
              type="text"
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base ${
                validationErrors.parties ? 'border-red-500' : 'border-border'
              }`}
              value={vendorSearch}
              onChange={(e) => {
                setVendorSearch(e.target.value);
                setShowVendorDropdown(true);
              }}
              onFocus={() => setShowVendorDropdown(true)}
              placeholder="Search for vendor..."
            />
            
            {showVendorDropdown && filteredVendors.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredVendors.map(vendor => (
                  <div
                    key={vendor.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => handleVendorSelect(vendor)}
                  >
                    <div className="font-medium text-gray-900">{vendor.name}</div>
                    {vendor.contact_person && (
                      <div className="text-sm text-gray-500">Contact: {vendor.contact_person}</div>
                    )}
                    {vendor.current_balance && vendor.current_balance !== 0 && (
                      <div className={`text-sm font-medium ${vendor.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Balance: ₹{Math.abs(vendor.current_balance).toFixed(2)} {vendor.current_balance > 0 ? 'Due' : 'Advance'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {validationErrors.parties && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.parties}</p>
          )}
        </div>
      )}

      {/* Amount and Date - Compact Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!isVendorOrder && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {isVendorPayment ? 'Payment Amount *' : 'Amount *'}
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
                onChange={(e) => {
                  const amount = parseFloat(e.target.value) || 0;
                  handleFieldChange('total_amount', amount);
                  
                  // Update the party amount if vendor is selected for vendor payment
                  if (isVendorPayment && selectedVendor) {
                    updateTransactionData({ 
                      parties: [{
                        party_id: selectedVendor.id,
                        party_name: selectedVendor.name,
                        party_type: 'vendor',
                        amount: amount
                      }]
                    });
                  }
                }}
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
          {isVendorOrder ? 'Order Description & Notes' : 
           isVendorPayment ? 'Payment Description & Notes' : 
           'Description & Notes'} *
        </label>
        <textarea
          required
          rows={3}
          className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none text-base ${
            validationErrors.description ? 'border-red-500' : 'border-border'
          }`}
          value={transactionData.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          placeholder={isVendorOrder ? 'Describe the order purpose, special instructions, delivery requirements...' : 
                      isVendorPayment ? 'Payment for which invoice/order? Include invoice numbers, payment terms, etc...' : 
                      'What was this expense for? Any additional notes...'}
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
          {isVendorOrder ? 'Payment Method (Optional - only if paying now)' : 'How did you pay? *'}
        </label>
        {isVendorOrder && (
          <p className="text-sm text-muted-foreground mb-3">
            You can place the order without payment now and make payment later using "Vendor Payment" category.
          </p>
        )}
        <PaymentMethodSelector
          paymentMethod={transactionData.payment_method}
          onPaymentMethodChange={handlePaymentMethodChange}
          errors={validationErrors.payment_method || {}}
          required={!isVendorOrder}
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