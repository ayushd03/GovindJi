import React, { useState, useEffect } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import {
  DocumentTextIcon,
  PlusIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  CurrencyRupeeIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AdjustmentsHorizontalIcon,
  CreditCardIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/use-toast';
import { Toaster } from '../../components/ui/toaster';

const PAYMENT_STATUSES = [
  { value: 'paid', label: 'Paid', icon: CheckCircleIcon, color: 'bg-green-100 text-green-800' },
  { value: 'unpaid', label: 'Unpaid', icon: ClockIcon, color: 'bg-red-100 text-red-800' },
  { value: 'partial', label: 'Partial', icon: CurrencyRupeeIcon, color: 'bg-yellow-100 text-yellow-800' },
];

const PAYMENT_TYPES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Credit Card'];

const PurchaseBillManagement = () => {
  const { toast } = useToast();
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [parties, setParties] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalBills, setTotalBills] = useState(0);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [showBillDetails, setShowBillDetails] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  
  const [formData, setFormData] = useState({
    party_id: '',
    purchase_order_id: '',
    bill_date: new Date().toISOString().split('T')[0],
    vendor_bill_number: '',
    due_date: '',
    notes: '',
    items: []
  });

  const [paymentData, setPaymentData] = useState({
    payment_amount: 0,
    payment_type: 'Cash',
    payment_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    notes: ''
  });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const showSuccess = (message) => {
    toast({
      title: "Success",
      description: message,
      variant: "success",
      duration: 3000,
    });
  };

  const showError = (message) => {
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
      duration: 5000,
    });
  };

  useEffect(() => {
    fetchPurchaseBills(1);
    fetchParties();
    fetchPurchaseOrders();
  }, []);

  const fetchPurchaseBills = async (page = 1, limit = itemsPerPage) => {
    try {
      const token = localStorage.getItem('authToken');
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedStatus && { payment_status: selectedStatus }),
        ...(selectedParty && { party_id: selectedParty }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      });

      const response = await fetch(`${API_BASE_URL}/api/admin/purchase-bills?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch purchase bills');

      const data = await response.json();
      setPurchaseBills(data.purchase_bills || []);
      setTotalBills(data.total || 0);
    } catch (err) {
      setError(err.message);
      showError('Failed to load purchase bills');
    } finally {
      setLoading(false);
    }
  };

  const fetchParties = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/parties?party_type=vendor&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch parties');

      const data = await response.json();
      setParties(data.parties || []);
    } catch (err) {
      console.error('Error fetching parties:', err);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/purchase-orders?status=confirmed&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch purchase orders');

      const data = await response.json();
      setPurchaseOrders(data.purchase_orders || []);
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        fetchPurchaseBills(1);
      } else {
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedStatus, selectedParty, startDate, endDate]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const getStatusInfo = (status) => {
    return PAYMENT_STATUSES.find(s => s.value === status) || PAYMENT_STATUSES[1];
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, {
        product_id: '',
        item_name: '',
        description: '',
        quantity: 1,
        unit: 'kg',
        price_per_unit: 0,
        discount_percentage: 0,
        tax_percentage: 0,
        total_amount: 0
      }]
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate totals
    if (['quantity', 'price_per_unit', 'discount_percentage', 'tax_percentage'].includes(field)) {
      const item = newItems[index];
      const subtotal = item.quantity * item.price_per_unit;
      const discount = (subtotal * item.discount_percentage) / 100;
      const afterDiscount = subtotal - discount;
      const tax = (afterDiscount * item.tax_percentage) / 100;
      
      newItems[index].discount_amount = discount;
      newItems[index].tax_amount = tax;
      newItems[index].total_amount = afterDiscount + tax;
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      
      // Calculate totals
      const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.price_per_unit), 0);
      const totalDiscount = formData.items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
      const totalTax = formData.items.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
      const finalAmount = subtotal - totalDiscount + totalTax;

      const billData = {
        ...formData,
        subtotal_amount: subtotal,
        discount_amount: totalDiscount,
        tax_amount: totalTax,
        final_amount: finalAmount
      };

      const url = editingBill 
        ? `${API_BASE_URL}/api/admin/purchase-bills/${editingBill.id}`
        : `${API_BASE_URL}/api/admin/purchase-bills`;
      const method = editingBill ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(billData)
      });

      if (!response.ok) throw new Error(`Failed to ${editingBill ? 'update' : 'create'} purchase bill`);

      await fetchPurchaseBills(currentPage);
      handleCloseModal();
      showSuccess(editingBill ? 'Purchase bill updated successfully' : 'Purchase bill created successfully');
    } catch (err) {
      setError(err.message);
      showError(editingBill ? 'Failed to update purchase bill' : 'Failed to create purchase bill');
    }
  };

  const handlePayment = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/purchase-bills/${showPaymentModal.id}/payment`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) throw new Error('Failed to record payment');

      await fetchPurchaseBills(currentPage);
      setShowPaymentModal(null);
      setPaymentData({
        payment_amount: 0,
        payment_type: 'Cash',
        payment_date: new Date().toISOString().split('T')[0],
        reference_number: '',
        notes: ''
      });
      showSuccess('Payment recorded successfully');
    } catch (err) {
      showError('Failed to record payment');
    }
  };

  const fetchBillDetails = async (billId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/purchase-bills/${billId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch bill details');

      const data = await response.json();
      setShowBillDetails(data);
    } catch (err) {
      showError('Failed to load bill details');
    }
  };

  const handleOpenModal = (bill = null) => {
    if (bill) {
      setEditingBill(bill);
      setFormData({
        party_id: bill.party_id || '',
        purchase_order_id: bill.purchase_order_id || '',
        bill_date: bill.bill_date || new Date().toISOString().split('T')[0],
        vendor_bill_number: bill.vendor_bill_number || '',
        due_date: bill.due_date || '',
        notes: bill.notes || '',
        items: bill.purchase_bill_items || []
      });
    } else {
      setEditingBill(null);
      setFormData({
        party_id: '',
        purchase_order_id: '',
        bill_date: new Date().toISOString().split('T')[0],
        vendor_bill_number: '',
        due_date: '',
        notes: '',
        items: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBill(null);
    setFormData({
      party_id: '',
      purchase_order_id: '',
      bill_date: new Date().toISOString().split('T')[0],
      vendor_bill_number: '',
      due_date: '',
      notes: '',
      items: []
    });
  };

  const handleOpenPaymentModal = (bill) => {
    setShowPaymentModal(bill);
    setPaymentData({
      payment_amount: bill.due_amount || 0,
      payment_type: 'Cash',
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: '',
      notes: ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-3 text-lg text-muted-foreground">Loading purchase bills...</span>
      </div>
    );
  }

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_VENDORS}>
      <div className="space-y-6">
        {/* Header with Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Bills</p>
                  <p className="text-2xl font-bold text-foreground">{totalBills}</p>
                </div>
                <DocumentTextIcon className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold text-foreground">
                    {purchaseBills.filter(bill => bill.payment_status === 'paid').length}
                  </p>
                </div>
                <CheckCircleIcon className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unpaid</p>
                  <p className="text-2xl font-bold text-foreground">
                    {purchaseBills.filter(bill => bill.payment_status === 'unpaid').length}
                  </p>
                </div>
                <ClockIcon className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(purchaseBills.reduce((sum, bill) => sum + (bill.final_amount || 0), 0))}
                  </p>
                </div>
                <CurrencyRupeeIcon className="w-8 h-8 text-info" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg">Purchase Bills</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="md:hidden">
                  <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>
              <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_VENDORS}>
                <Button onClick={() => handleOpenModal()} className="btn-primary">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create Bill
                </Button>
              </PermissionGuard>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input type="text" placeholder="Search bills..." className="input-field w-full pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <select className="input-field" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  {PAYMENT_STATUSES.map(status => (<option key={status.value} value={status.value}>{status.label}</option>))}
                </select>
                <select className="input-field" value={selectedParty} onChange={(e) => setSelectedParty(e.target.value)}>
                  <option value="">All Parties</option>
                  {parties.map(party => (<option key={party.id} value={party.id}>{party.name}</option>))}
                </select>
                <input type="date" className="input-field" placeholder="Start Date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <input type="date" className="input-field" placeholder="End Date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedStatus(''); setSelectedParty(''); setStartDate(''); setEndDate(''); }}>Clear</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4"><p className="text-destructive-foreground">{error}</p></div>)}

        <Card>
          <CardContent className="p-0">
            {purchaseBills.length === 0 ? (
              <div className="p-12 text-center">
                <DocumentTextIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No purchase bills found</h3>
                <p className="text-muted-foreground">Get started by creating your first purchase bill</p>
              </div>
            ) : (
              <div className="divide-y">
                {purchaseBills.map((bill) => {
                  const statusInfo = getStatusInfo(bill.payment_status);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div key={bill.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 mb-3 sm:mb-0">
                          <div className="flex items-start justify-between sm:items-center sm:space-x-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base sm:text-lg font-medium text-foreground truncate">{bill.bill_number}</h3>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {statusInfo.label}
                                </span>
                                {bill.vendor_bill_number && (
                                  <span className="text-xs text-muted-foreground">#{bill.vendor_bill_number}</span>
                                )}
                              </div>
                              <div className="mt-1 space-y-1 sm:space-y-0 sm:flex sm:items-center sm:space-x-4 text-sm text-muted-foreground">
                                <div><span className="font-medium">Party:</span> {bill.party?.name || 'N/A'}</div>
                                <div><span className="font-medium">Date:</span> {new Date(bill.bill_date).toLocaleDateString()}</div>
                                <div><span className="font-medium">Amount:</span> {formatCurrency(bill.final_amount)}</div>
                                {bill.due_amount > 0 && <div><span className="font-medium">Due:</span> {formatCurrency(bill.due_amount)}</div>}
                              </div>
                              {bill.purchase_order && (
                                <div className="mt-2 text-sm text-muted-foreground">
                                  PO: {bill.purchase_order.po_number}
                                </div>
                              )}
                            </div>
                            <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_VENDORS}>
                              <div className="hidden sm:flex items-center space-x-2 ml-4">
                                <Button variant="ghost" size="icon" onClick={() => fetchBillDetails(bill.id)} className="h-9 w-9 text-muted-foreground hover:text-primary">
                                  <EyeIcon className="w-4 h-4" />
                                </Button>
                                {bill.payment_status !== 'paid' && (
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenPaymentModal(bill)} className="h-9 w-9 text-muted-foreground hover:text-success">
                                    <CreditCardIcon className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </PermissionGuard>
                          </div>
                        </div>
                        <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_VENDORS}>
                          <div className="flex sm:hidden space-x-2 mt-3 pt-3 border-t">
                            <Button variant="outline" size="sm" onClick={() => fetchBillDetails(bill.id)} className="flex-1">
                              <EyeIcon className="w-4 h-4 mr-2" />View
                            </Button>
                            {bill.payment_status !== 'paid' && (
                              <Button variant="outline" size="sm" onClick={() => handleOpenPaymentModal(bill)} className="flex-1">
                                <CreditCardIcon className="w-4 h-4 mr-2" />Pay
                              </Button>
                            )}
                          </div>
                        </PermissionGuard>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Purchase Bill Form Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    {editingBill ? 'Edit Purchase Bill' : 'Create Purchase Bill'}
                  </h2>
                  <button onClick={handleCloseModal} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
                {/* Basic Bill Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Party *</label>
                    <select required className="input-field" value={formData.party_id} onChange={(e) => setFormData({...formData, party_id: e.target.value})}>
                      <option value="">Select Party</option>
                      {parties.map(party => (<option key={party.id} value={party.id}>{party.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Purchase Order</label>
                    <select className="input-field" value={formData.purchase_order_id} onChange={(e) => setFormData({...formData, purchase_order_id: e.target.value})}>
                      <option value="">Select PO (Optional)</option>
                      {purchaseOrders.filter(po => !formData.party_id || po.party_id === formData.party_id).map(po => (<option key={po.id} value={po.id}>{po.po_number}</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Bill Date *</label>
                    <input type="date" required className="input-field" value={formData.bill_date} onChange={(e) => setFormData({...formData, bill_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Vendor Bill Number</label>
                    <input type="text" className="input-field" placeholder="Vendor's invoice number" value={formData.vendor_bill_number} onChange={(e) => setFormData({...formData, vendor_bill_number: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Due Date</label>
                    <input type="date" className="input-field" value={formData.due_date} onChange={(e) => setFormData({...formData, due_date: e.target.value})} />
                  </div>
                </div>

                {/* Items Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-foreground">Items</h3>
                    <Button type="button" onClick={handleAddItem} className="btn-primary">
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {formData.items.map((item, index) => (
                      <div key={index} className="p-4 border border-muted rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Item {index + 1}</h4>
                          <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveItem(index)}>
                            Remove
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Item Name *</label>
                            <input type="text" required className="input-field" value={item.item_name} onChange={(e) => handleItemChange(index, 'item_name', e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
                            <input type="text" className="input-field" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Quantity *</label>
                            <input type="number" step="0.001" required className="input-field" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Unit</label>
                            <input type="text" className="input-field" value={item.unit} onChange={(e) => handleItemChange(index, 'unit', e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Price per Unit *</label>
                            <input type="number" step="0.01" required className="input-field" value={item.price_per_unit} onChange={(e) => handleItemChange(index, 'price_per_unit', parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Total Amount</label>
                            <input type="text" className="input-field" value={formatCurrency(item.total_amount)} disabled />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Discount %</label>
                            <input type="number" step="0.01" className="input-field" value={item.discount_percentage} onChange={(e) => handleItemChange(index, 'discount_percentage', parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Tax %</label>
                            <input type="number" step="0.01" className="input-field" value={item.tax_percentage} onChange={(e) => handleItemChange(index, 'tax_percentage', parseFloat(e.target.value) || 0)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Notes</label>
                  <textarea rows={3} className="input-field" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
                  <Button type="submit" className="btn-primary">{editingBill ? 'Update Bill' : 'Create Bill'}</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    Record Payment - {showPaymentModal.bill_number}
                  </h2>
                  <button onClick={() => setShowPaymentModal(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 space-y-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="font-medium">Total Amount:</span> {formatCurrency(showPaymentModal.final_amount)}</div>
                    <div><span className="font-medium">Paid Amount:</span> {formatCurrency(showPaymentModal.paid_amount)}</div>
                    <div><span className="font-medium">Due Amount:</span> {formatCurrency(showPaymentModal.due_amount)}</div>
                    <div><span className="font-medium">Status:</span> {getStatusInfo(showPaymentModal.payment_status).label}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Payment Amount *</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      className="input-field" 
                      max={showPaymentModal.due_amount}
                      value={paymentData.payment_amount} 
                      onChange={(e) => setPaymentData({...paymentData, payment_amount: parseFloat(e.target.value) || 0})} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Payment Type *</label>
                    <select required className="input-field" value={paymentData.payment_type} onChange={(e) => setPaymentData({...paymentData, payment_type: e.target.value})}>
                      {PAYMENT_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Payment Date *</label>
                    <input type="date" required className="input-field" value={paymentData.payment_date} onChange={(e) => setPaymentData({...paymentData, payment_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Reference Number</label>
                    <input type="text" className="input-field" placeholder="Transaction ID, Cheque no., etc." value={paymentData.reference_number} onChange={(e) => setPaymentData({...paymentData, reference_number: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Notes</label>
                  <textarea rows={3} className="input-field" value={paymentData.notes} onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})} />
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowPaymentModal(null)}>Cancel</Button>
                  <Button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handlePayment}
                    disabled={paymentData.payment_amount <= 0 || paymentData.payment_amount > showPaymentModal.due_amount}
                  >
                    Record Payment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bill Details Modal */}
        {showBillDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    Bill Details - {showBillDetails.bill_number}
                  </h2>
                  <button onClick={() => setShowBillDetails(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 space-y-6">
                {/* Bill Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Bill Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div><span className="text-sm text-muted-foreground">Bill Number:</span> <span className="font-medium">{showBillDetails.bill_number}</span></div>
                      <div><span className="text-sm text-muted-foreground">Vendor Bill:</span> <span className="font-medium">{showBillDetails.vendor_bill_number || 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">Bill Date:</span> <span className="font-medium">{new Date(showBillDetails.bill_date).toLocaleDateString()}</span></div>
                      <div><span className="text-sm text-muted-foreground">Due Date:</span> <span className="font-medium">{showBillDetails.due_date ? new Date(showBillDetails.due_date).toLocaleDateString() : 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">Status:</span> <span className={`font-medium px-2 py-1 rounded text-xs ${getStatusInfo(showBillDetails.payment_status).color}`}>{getStatusInfo(showBillDetails.payment_status).label}</span></div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Party Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div><span className="text-sm text-muted-foreground">Party Name:</span> <span className="font-medium">{showBillDetails.party?.name || 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">Contact:</span> <span className="font-medium">{showBillDetails.party?.contact_person || 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">Phone:</span> <span className="font-medium">{showBillDetails.party?.phone_number || 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">GSTIN:</span> <span className="font-medium">{showBillDetails.party?.gstin || 'N/A'}</span></div>
                    </CardContent>
                  </Card>
                </div>

                {/* Financial Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Financial Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Subtotal</p>
                        <p className="font-medium">{formatCurrency(showBillDetails.subtotal_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Discount</p>
                        <p className="font-medium">-{formatCurrency(showBillDetails.discount_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Tax</p>
                        <p className="font-medium">{formatCurrency(showBillDetails.tax_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Final Amount</p>
                        <p className="text-lg font-bold">{formatCurrency(showBillDetails.final_amount)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Paid Amount</p>
                        <p className="font-medium text-green-600">{formatCurrency(showBillDetails.paid_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Due Amount</p>
                        <p className="font-medium text-red-600">{formatCurrency(showBillDetails.due_amount)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Item</th>
                            <th className="text-right py-2">Qty</th>
                            <th className="text-right py-2">Unit Price</th>
                            <th className="text-right py-2">Discount</th>
                            <th className="text-right py-2">Tax</th>
                            <th className="text-right py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {showBillDetails.purchase_bill_items?.map((item, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2">
                                <div>
                                  <p className="font-medium">{item.item_name}</p>
                                  {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                                </div>
                              </td>
                              <td className="text-right py-2">{item.quantity} {item.unit}</td>
                              <td className="text-right py-2">{formatCurrency(item.price_per_unit)}</td>
                              <td className="text-right py-2">{formatCurrency(item.discount_amount)}</td>
                              <td className="text-right py-2">{formatCurrency(item.tax_amount)}</td>
                              <td className="text-right py-2">{formatCurrency(item.total_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment History */}
                {showBillDetails.party_payments && showBillDetails.party_payments.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Payment History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {showBillDetails.party_payments.map((payment, index) => (
                          <div key={index} className="flex justify-between items-center py-2 border-b border-muted last:border-0">
                            <div>
                              <p className="font-medium">{payment.payment_type}</p>
                              <p className="text-sm text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString()}</p>
                              {payment.reference_number && <p className="text-sm text-muted-foreground">Ref: {payment.reference_number}</p>}
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-green-600">{formatCurrency(payment.amount)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}
        
        <Toaster />
      </div>
    </PermissionGuard>
  );
};

export default PurchaseBillManagement;