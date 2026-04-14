import React, { useState } from 'react';
import {
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../hooks/useToast';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogDescription,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogIconButton,
  AdminDialogTitle,
} from '../../../components/AdminDialog';
import { API_BASE_URL } from '../../../config/apiBaseUrl';
import {
  GST_TYPES,
  INDIAN_STATES,
  PARTY_CATEGORIES,
} from '../../../constants/adminConstants';

const AddVendorModal = ({
  isOpen,
  onClose,
  onVendorAdded,
  defaultName = '',
  editingVendor = null, // For editing existing vendors
  mode = 'add', // 'add' or 'edit'
  apiBaseUrl = API_BASE_URL
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const tabItems = [
    { key: 'basic', label: 'Basic Details', description: 'Identity and contacts' },
    { key: 'gst', label: 'GST & Address', description: 'Compliance and location' },
    { key: 'financial', label: 'Financial Details', description: 'Opening balance and notes' }
  ];

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
    setValidationErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updateField = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value
    }));
    setValidationErrors((previous) => ({
      ...previous,
      [field]: undefined
    }));
  };

  const validateForm = () => {
    const errors = {};
    const cleanedPhone = (formData.phone_number || '').replace(/\D/g, '');
    const normalizedEmail = (formData.email || '').trim();
    const normalizedGstin = (formData.gstin || '').trim().toUpperCase();

    if (!formData.name.trim()) {
      errors.name = 'Vendor name is required.';
    }

    if (!formData.category) {
      errors.category = 'Choose a vendor category.';
    }

    if (cleanedPhone && cleanedPhone.length !== 10) {
      errors.phone_number = 'Enter a valid 10-digit phone number.';
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      errors.email = 'Enter a valid email address.';
    }

    if (normalizedGstin && !/^\d{2}[A-Z0-9]{13}$/.test(normalizedGstin)) {
      errors.gstin = 'Enter a valid 15-character GSTIN.';
    }

    if (Number(formData.opening_balance) < 0) {
      errors.opening_balance = 'Opening balance cannot be negative.';
    }

    setValidationErrors(errors);

    if (errors.name || errors.category || errors.phone_number || errors.email) {
      setActiveTab('basic');
    } else if (errors.gstin) {
      setActiveTab('gst');
    } else if (errors.opening_balance) {
      setActiveTab('financial');
    }

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
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
    <AdminDialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <AdminDialogContent size="lg">
        <AdminDialogHeader sticky>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <BuildingOfficeIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <AdminDialogTitle>{mode === 'edit' ? 'Edit Vendor' : 'Add New Vendor'}</AdminDialogTitle>
                <AdminDialogDescription>
                  Capture vendor identity, compliance, and opening balance details in one place.
                </AdminDialogDescription>
              </div>
            </div>
            <AdminDialogIconButton onClick={handleClose} />
          </div>
          <div className="admin-dialog-tabs mt-4">
            {tabItems.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`admin-dialog-tab ${
                  activeTab === tab.key
                    ? 'border-primary/30 bg-primary/10 text-foreground shadow-sm'
                    : 'border-border/70 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                <div className="text-sm font-semibold">{tab.label}</div>
                <div className="mt-1 text-xs">{tab.description}</div>
              </button>
            ))}
          </div>
        </AdminDialogHeader>

        <form onSubmit={handleSubmit}>
        <AdminDialogBody className="admin-dialog-stack">
          <div className="admin-dialog-section-muted">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {tabItems.find((tab) => tab.key === activeTab)?.label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tabItems.find((tab) => tab.key === activeTab)?.description}
                </p>
              </div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {mode === 'edit' ? 'Updating existing vendor' : 'New vendor record'}
              </div>
            </div>
          </div>

          {/* Basic Details Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="admin-dialog-grid-2">
                <div>
                  <label className="admin-dialog-label">Vendor Name *</label>
                  <input
                    type="text"
                    required
                    className={`input-field ${validationErrors.name ? 'border-destructive focus:ring-destructive' : ''}`}
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                  {validationErrors.name && <p className="mt-1 text-xs text-destructive">{validationErrors.name}</p>}
                </div>
                <div>
                  <label className="admin-dialog-label">Category *</label>
                  <select
                    required
                    className={`input-field ${validationErrors.category ? 'border-destructive focus:ring-destructive' : ''}`}
                    value={formData.category}
                    onChange={(e) => updateField('category', e.target.value)}
                  >
                    <option value="">Select Category</option>
                    {PARTY_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  {validationErrors.category && <p className="mt-1 text-xs text-destructive">{validationErrors.category}</p>}
                </div>
              </div>
              <div className="admin-dialog-grid-2">
                <div>
                  <label className="admin-dialog-label">Contact Person</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.contact_person}
                    onChange={(e) => updateField('contact_person', e.target.value)}
                  />
                </div>
                <div>
                  <label className="admin-dialog-label">Phone Number</label>
                  <input
                    type="tel"
                    className={`input-field ${validationErrors.phone_number ? 'border-destructive focus:ring-destructive' : ''}`}
                    value={formData.phone_number}
                    onChange={(e) => updateField('phone_number', e.target.value)}
                  />
                  {validationErrors.phone_number && <p className="mt-1 text-xs text-destructive">{validationErrors.phone_number}</p>}
                </div>
              </div>
              <div>
                <label className="admin-dialog-label">Email</label>
                <input
                  type="email"
                  className={`input-field ${validationErrors.email ? 'border-destructive focus:ring-destructive' : ''}`}
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                />
                {validationErrors.email && <p className="mt-1 text-xs text-destructive">{validationErrors.email}</p>}
              </div>
            </div>
          )}

          {/* GST & Address Tab */}
          {activeTab === 'gst' && (
            <div className="space-y-4">
              <div className="admin-dialog-grid-2">
                <div>
                  <label className="admin-dialog-label">GST Type</label>
                  <select
                    className="input-field"
                    value={formData.gst_type}
                    onChange={(e) => updateField('gst_type', e.target.value)}
                  >
                    {GST_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="admin-dialog-label">GSTIN</label>
                  <input
                    type="text"
                    className={`input-field ${validationErrors.gstin ? 'border-destructive focus:ring-destructive' : ''}`}
                    placeholder="e.g., 22AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => updateField('gstin', e.target.value.toUpperCase())}
                  />
                  {validationErrors.gstin && <p className="mt-1 text-xs text-destructive">{validationErrors.gstin}</p>}
                </div>
              </div>
              <div>
                <label className="admin-dialog-label">State</label>
                <select
                  className="input-field"
                  value={formData.state}
                  onChange={(e) => updateField('state', e.target.value)}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="admin-dialog-label">Billing Address</label>
                <textarea
                  rows={3}
                  className="input-field"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </div>
              <div>
                <label className="admin-dialog-label">Shipping Address</label>
                <textarea
                  rows={3}
                  className="input-field"
                  placeholder="Leave blank if same as billing address"
                  value={formData.shipping_address}
                  onChange={(e) => updateField('shipping_address', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Financial Details Tab */}
          {activeTab === 'financial' && (
            <div className="space-y-4">
              <div className="admin-dialog-grid-2">
                <div>
                  <label className="admin-dialog-label">Opening Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    className={`input-field ${validationErrors.opening_balance ? 'border-destructive focus:ring-destructive' : ''}`}
                    value={formData.opening_balance}
                    onChange={(e) => updateField('opening_balance', parseFloat(e.target.value) || 0)}
                  />
                  {validationErrors.opening_balance && <p className="mt-1 text-xs text-destructive">{validationErrors.opening_balance}</p>}
                </div>
                <div>
                  <label className="admin-dialog-label">As of Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formData.balance_as_of_date}
                    onChange={(e) => updateField('balance_as_of_date', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="admin-dialog-label">Notes</label>
                <textarea
                  rows={3}
                  className="input-field"
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                />
              </div>
            </div>
          )}
        </AdminDialogBody>

        <AdminDialogFooter sticky className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Use tabs to complete the vendor record without leaving the form.</p>
          <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row">
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
        </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialog>
  );
};

export default AddVendorModal;
