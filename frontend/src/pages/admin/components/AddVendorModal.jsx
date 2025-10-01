import React, { useState } from 'react';
import {
  XMarkIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../hooks/useToast';

const PARTY_CATEGORIES = [
  'Raw Materials',
  'Packaging',
  'Dairy',
  'Services',
  'Equipment',
  'Miscellaneous'
];

const GST_TYPES = [
  'Unregistered/Consumer',
  'Registered',
  'Composition',
  'Overseas'
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const AddVendorModal = ({
  isOpen,
  onClose,
  onVendorAdded,
  defaultName = '',
  editingVendor = null, // For editing existing vendors
  mode = 'add', // 'add' or 'edit'
  apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001'
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: defaultName,
    contact_person: '',
    phone_number: '',
    email: '',
    address: '',
    shipping_address: '',
    gstin: '',
    gst_type: 'Unregistered/Consumer',
    state: '',
    party_type: 'vendor',
    category: '',
    opening_balance: 0,
    balance_as_of_date: new Date().toISOString().split('T')[0],
    credit_limit: 0,
    credit_limit_type: 'no_limit',
    notes: ''
  });

  // Initialize form data when editing or when defaultName changes
  React.useEffect(() => {
    if (editingVendor) {
      setFormData({
        name: editingVendor.name || '',
        contact_person: editingVendor.contact_person || '',
        phone_number: editingVendor.phone_number || '',
        email: editingVendor.email || '',
        address: editingVendor.address || '',
        shipping_address: editingVendor.shipping_address || '',
        gstin: editingVendor.gstin || '',
        gst_type: editingVendor.gst_type || 'Unregistered/Consumer',
        state: editingVendor.state || '',
        party_type: editingVendor.party_type || 'vendor',
        category: editingVendor.category || '',
        opening_balance: editingVendor.opening_balance || 0,
        balance_as_of_date: editingVendor.balance_as_of_date || new Date().toISOString().split('T')[0],
        credit_limit: editingVendor.credit_limit || 0,
        credit_limit_type: editingVendor.credit_limit_type || 'no_limit',
        notes: editingVendor.notes || ''
      });
    } else {
      setFormData(prev => ({
        ...prev,
        name: defaultName
      }));
    }
  }, [editingVendor, defaultName]);

  const resetForm = () => {
    setFormData({
      name: defaultName,
      contact_person: '',
      phone_number: '',
      email: '',
      address: '',
      shipping_address: '',
      gstin: '',
      gst_type: 'Unregistered/Consumer',
      state: '',
      party_type: 'vendor',
      category: '',
      opening_balance: 0,
      balance_as_of_date: new Date().toISOString().split('T')[0],
      credit_limit: 0,
      credit_limit_type: 'no_limit',
      notes: ''
    });
    setActiveTab('basic');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('authToken');
      const isEditing = mode === 'edit' && editingVendor;

      const url = isEditing
        ? `${apiBaseUrl}/api/admin/parties/${editingVendor.id}`
        : `${apiBaseUrl}/api/admin/parties`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: isEditing ? 'Vendor updated successfully' : 'Vendor added successfully',
          variant: 'success',
          duration: 3000
        });

        // Call the callback to refresh vendor lists
        if (onVendorAdded) {
          onVendorAdded(result.data || result);
        }

        handleClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isEditing ? 'update' : 'add'} vendor`);
      }
    } catch (error) {
      console.error(`Error ${mode === 'edit' ? 'updating' : 'adding'} vendor:`, error);
      toast({
        title: 'Error',
        description: error.message || `Failed to ${mode === 'edit' ? 'update' : 'add'} vendor`,
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BuildingOfficeIcon className="w-6 h-6 text-primary" />
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {mode === 'edit' ? 'Edit Vendor' : 'Add New Vendor'}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 border-b">
            <nav className="flex space-x-8">
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'basic'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('basic')}
                type="button"
              >
                Basic Details
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'gst'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('gst')}
                type="button"
              >
                GST & Address
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'financial'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('financial')}
                type="button"
              >
                Financial Details
              </button>
            </nav>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {/* Basic Details Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Vendor Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Category *</label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="">Select Category</option>
                    {PARTY_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Contact Person</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>
          )}

          {/* GST & Address Tab */}
          {activeTab === 'gst' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">GST Type</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.gst_type}
                    onChange={(e) => setFormData({...formData, gst_type: e.target.value})}
                  >
                    {GST_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">GSTIN</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., 22AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({...formData, gstin: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">State</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Billing Address</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Shipping Address</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Leave blank if same as billing address"
                  value={formData.shipping_address}
                  onChange={(e) => setFormData({...formData, shipping_address: e.target.value})}
                />
              </div>
            </div>
          )}

          {/* Financial Details Tab */}
          {activeTab === 'financial' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Opening Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({...formData, opening_balance: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">As of Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.balance_as_of_date}
                    onChange={(e) => setFormData({...formData, balance_as_of_date: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading
                ? (mode === 'edit' ? 'Updating...' : 'Adding...')
                : (mode === 'edit' ? 'Update Vendor' : 'Add Vendor')
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddVendorModal;