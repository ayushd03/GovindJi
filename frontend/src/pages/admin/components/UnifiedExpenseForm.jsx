import React, { useState, useEffect } from 'react';
import {
  CubeIcon,
  BuildingOfficeIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import PaymentMethodSelector from './PaymentMethodSelector';
import MultiVendorItemManager from './MultiVendorItemManager';
import UnifiedVendorOrderForm from './UnifiedVendorOrderForm';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../hooks/useToast';

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
  const { toast } = useToast();
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [showVendorOrderModal, setShowVendorOrderModal] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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

  // Handle vendor order submission - Creates POs via bulk API (optimized)
  const handleVendorOrderSubmit = async (formData) => {
    try {
      const token = localStorage.getItem('authToken');

      // Group items by vendor to create separate POs
      const vendorGroups = {};
      formData.items.forEach(item => {
        const vendorId = item.vendor_id;
        if (!vendorGroups[vendorId]) {
          vendorGroups[vendorId] = {
            party_id: vendorId,
            order_date: formData.order_date,
            expected_delivery_date: formData.expected_delivery_date,
            payment_terms: formData.payment_terms,
            delivery_address: formData.delivery_address,
            notes: formData.notes,
            items: []
          };
        }
        vendorGroups[vendorId].items.push(item);
      });

      // Convert vendor groups to array for bulk API
      const purchaseOrders = Object.values(vendorGroups);

      // Single API call for bulk PO creation
      const response = await fetch(`${API_BASE_URL}/api/admin/purchase-orders/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ purchase_orders: purchaseOrders })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create purchase orders');
      }

      const result = await response.json();
      const createdPOs = result.created || [];
      const failedCount = result.failed || 0;

      // Update expense transaction with items and PO references
      if (createdPOs.length > 0) {
        const totalAmount = createdPOs.reduce((sum, po) => sum + (po.total_amount || 0), 0);

        updateTransactionData({
          items: formData.items,
          notes: formData.notes,
          total_amount: totalAmount,
          purchase_orders: createdPOs.map(po => ({
            po_id: po.id,
            po_number: po.po_number,
            vendor_id: po.party_id,
            amount: po.total_amount
          }))
        });
      }

      setShowVendorOrderModal(false);

      // Show feedback
      if (failedCount === 0) {
        toast({
          title: "Success",
          description: result.message || `Successfully created ${createdPOs.length} purchase order${createdPOs.length > 1 ? 's' : ''}!`,
          variant: "success",
          duration: 3000,
        });
      } else if (createdPOs.length > 0) {
        toast({
          title: "Partial Success",
          description: result.message || `Created ${createdPOs.length} PO(s), ${failedCount} failed`,
          variant: "warning",
          duration: 5000,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || 'Failed to create any purchase orders',
          variant: "destructive",
          duration: 5000,
        });
        throw new Error('All PO creation attempts failed');
      }
    } catch (err) {
      console.error('Failed to create purchase orders:', err);
      toast({
        title: "Error",
        description: 'Failed to create purchase orders: ' + err.message,
        variant: "destructive",
        duration: 5000,
      });
      throw err;
    }
  };

  return (
    <div className="space-y-3">
      {/* Category Selection First - Most Important */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Expense Category *
        </label>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {EXPENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className={`p-2 rounded-lg border text-xs font-medium transition-all hover:shadow-sm ${
                transactionData.expense_category === cat
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'Vendor Order' ? (
                <div className="flex flex-col items-center space-y-0.5">
                  <CubeIcon className="w-4 h-4" />
                  <span>Vendor Order</span>
                </div>
              ) : cat === 'Vendor Payment' ? (
                <div className="flex flex-col items-center space-y-0.5">
                  <BuildingOfficeIcon className="w-4 h-4" />
                  <span>Vendor Payment</span>
                </div>
              ) : (
                cat
              )}
            </button>
          ))}
        </div>
        {validationErrors.expense_category && (
          <p className="text-red-500 text-xs mt-1">{validationErrors.expense_category}</p>
        )}
      </div>

      {/* Vendor Selection for Vendor Payment */}
      {isVendorPayment && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Select Vendor to Pay *
          </label>
          <div className="relative vendor-dropdown-container">
            <input
              type="text"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm ${
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
              <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredVendors.map(vendor => (
                  <div
                    key={vendor.id}
                    className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => handleVendorSelect(vendor)}
                  >
                    <div className="font-medium text-sm text-gray-900">{vendor.name}</div>
                    {vendor.contact_person && (
                      <div className="text-xs text-gray-500">Contact: {vendor.contact_person}</div>
                    )}
                    {vendor.current_balance && vendor.current_balance !== 0 && (
                      <div className={`text-xs font-medium ${vendor.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Balance: ₹{Math.abs(vendor.current_balance).toFixed(2)} {vendor.current_balance > 0 ? 'Due' : 'Advance'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {validationErrors.parties && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.parties}</p>
          )}
        </div>
      )}

      {/* Amount, Date, and Payment Method - Horizontal Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {!isVendorOrder && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {isVendorPayment ? 'Payment Amount *' : 'Amount *'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm ${
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
              <p className="text-red-500 text-xs mt-1">{validationErrors.total_amount}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Date *
          </label>
          <input
            type="date"
            required
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm ${
              validationErrors.transaction_date ? 'border-red-500' : 'border-border'
            }`}
            value={transactionData.transaction_date}
            onChange={(e) => handleFieldChange('transaction_date', e.target.value)}
          />
          {validationErrors.transaction_date && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.transaction_date}</p>
          )}
        </div>

        {/* Payment Method moved here for better layout */}
        {!isVendorOrder && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Payment Method *
            </label>
            <div className="text-sm">
              <PaymentMethodSelector
                paymentMethod={transactionData.payment_method}
                onPaymentMethodChange={handlePaymentMethodChange}
                errors={validationErrors.payment_method || {}}
                required={!isVendorOrder}
              />
            </div>
          </div>
        )}
      </div>

      {/* Description with Notes - Combined */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {isVendorOrder ? 'Order Description & Notes' : 
           isVendorPayment ? 'Payment Description & Notes' : 
           'Description & Notes'} *
        </label>
        <textarea
          required
          rows={2}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm ${
            validationErrors.description ? 'border-red-500' : 'border-border'
          }`}
          value={transactionData.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          placeholder={isVendorOrder ? 'Describe the order purpose...' : 
                      isVendorPayment ? 'Payment for which invoice/order?' : 
                      'What was this expense for?'}
        />
        {validationErrors.description && (
          <p className="text-red-500 text-xs mt-1">{validationErrors.description}</p>
        )}
      </div>

      {/* Vendor Order - Open Unified Form Modal */}
      {isVendorOrder && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                <CubeIcon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Create Vendor Order</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add items from multiple vendors and create purchase orders in one go
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setShowVendorOrderModal(true)}
                size="lg"
                className="btn-primary"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Add Vendor Order Items
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vendor Order Modal */}
      {showVendorOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                  Create Vendor Orders
                </h2>
                <button
                  onClick={() => setShowVendorOrderModal(false)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <UnifiedVendorOrderForm
                mode="create"
                onSubmit={handleVendorOrderSubmit}
                onCancel={() => setShowVendorOrderModal(false)}
              />
            </div>
          </div>
        </div>
      )}


      {/* Additional Details */}
      {!isVendorOrder && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Receipt/Reference (optional)
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
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