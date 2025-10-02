import React, { useState, useEffect } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AdjustmentsHorizontalIcon,
  CurrencyRupeeIcon,
  CubeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  CalculatorIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/useToast';
import { Toaster } from '../../components/ui/toaster';
import { categoriesAPI } from '../../services/api';
import UnifiedVendorOrderForm from './components/UnifiedVendorOrderForm';

const PO_STATUSES = [
  { value: 'draft', label: 'Draft', icon: PencilIcon, color: 'bg-gray-100 text-gray-800' },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircleIcon, color: 'bg-blue-100 text-blue-800' },
  { value: 'partial_received', label: 'Partial Received', icon: TruckIcon, color: 'bg-orange-100 text-orange-800' },
  { value: 'received', label: 'Received', icon: CheckCircleIcon, color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircleIcon, color: 'bg-red-100 text-red-800' },
];

const PurchaseOrderManagement = () => {
  const { toast } = useToast();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPOs, setTotalPOs] = useState(0);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [showPODetails, setShowPODetails] = useState(null);
  const [showReceiveModal, setShowReceiveModal] = useState(null);
  
  const [formData, setFormData] = useState({
    party_id: '',
    order_date: new Date().toISOString(),
    expected_delivery_date: '',
    payment_terms: '',
    delivery_address: '',
    notes: '',
    items: []
  });

  const [categories, setCategories] = useState([]);

  const [receiveData, setReceiveData] = useState({
    received_items: [],
    notes: ''
  });

  const [expandedItems, setExpandedItems] = useState(new Set());
  const [activeTab, setActiveTab] = useState('basic');
  const [autocompleteStates, setAutocompleteStates] = useState({});

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
    fetchPurchaseOrders(1);
    fetchParties();
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchPurchaseOrders = async (page = 1, limit = itemsPerPage) => {
    try {
      const token = localStorage.getItem('authToken');
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedStatus && { status: selectedStatus }),
        ...(selectedParty && { party_id: selectedParty }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      });

      const response = await fetch(`${API_BASE_URL}/api/admin/purchase-orders?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch purchase orders');

      const data = await response.json();
      setPurchaseOrders(data.purchase_orders || []);
      setTotalPOs(data.total || 0);
    } catch (err) {
      setError(err.message);
      showError('Failed to load purchase orders');
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

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`);

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const data = await response.json();
      const productsArray = Array.isArray(data) ? data : (data.products || []);
      setProducts(productsArray);
    } catch (err) {
      console.error('Error fetching products:', err);
      showError('Failed to load products: ' + err.message);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.getAll();
      const data = response.data;
      const activeCategories = data.filter(category => category.is_active !== false);
      setCategories(activeCategories);
    } catch (err) {
      console.error('Error fetching categories:', err);
      showError('Failed to load categories, using fallback data');
      // Fallback categories
      setCategories([
        { id: '1', name: 'Nuts' },
        { id: '2', name: 'Dried Fruits' },
        { id: '3', name: 'Seeds' },
        { id: '4', name: 'Spices' }
      ]);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        fetchPurchaseOrders(1);
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
    return PO_STATUSES.find(s => s.value === status) || PO_STATUSES[0];
  };
  // OLD FORM HANDLERS REMOVED - Now using UnifiedVendorOrderForm

  // Handle bulk PO creation from unified form (optimized - single API call)
  const handleSubmitUnifiedForm = async (formData) => {
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

      // Refresh list and close modal
      await fetchPurchaseOrders(currentPage);
      handleCloseModal();

      // Show results
      if (failedCount === 0) {
        showSuccess(result.message || `Successfully created ${createdPOs.length} purchase order${createdPOs.length > 1 ? 's' : ''}!`);
      } else if (createdPOs.length > 0) {
        showSuccess(result.message || `Created ${createdPOs.length} PO(s), ${failedCount} failed`);
      } else {
        showError(result.error || 'Failed to create any purchase orders');
      }
    } catch (err) {
      showError('Failed to create purchase orders: ' + err.message);
      throw err;
    }
  };

  const handleUpdateStatus = async (poId, newStatus, notes = '') => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/purchase-orders/${poId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus, notes })
      });

      if (!response.ok) throw new Error('Failed to update status');

      await fetchPurchaseOrders(currentPage);
      showSuccess('Status updated successfully');
    } catch (err) {
      showError('Failed to update status');
    }
  };

  const handleReceiveItems = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      // Format the received items data to match the new API structure
      const formattedItems = receiveData.received_items
        .filter(item => item.receive_now > 0)
        .map(item => ({
          item_id: item.item_id,
          receive_now: item.receive_now
        }));

      if (formattedItems.length === 0) {
        showError('Please specify quantities to receive');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/purchase-orders/${showReceiveModal.id}/receive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          received_items: formattedItems,
          notes: receiveData.notes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to receive items');
      }

      const result = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        showError(`Received ${(result.results && result.results.length) || 0} items with ${result.errors.length} errors: ${result.errors.join(', ')}`);
      } else {
        showSuccess(`Successfully received ${(result.results && result.results.length) || 0} items`);
      }

      await fetchPurchaseOrders(currentPage);
      setShowReceiveModal(null);
      setReceiveData({ received_items: [], notes: '' });
    } catch (err) {
      showError(err.message || 'Failed to receive items');
    }
  };

  const fetchPODetails = async (poId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/purchase-orders/${poId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch PO details');

      const data = await response.json();
      setShowPODetails(data);
    } catch (err) {
      showError('Failed to load PO details');
    }
  };

  const handleOpenModal = (po = null) => {
    if (po) {
      setEditingPO(po);
      setFormData({
        party_id: po.party_id || '',
        order_date: po.order_date || new Date().toISOString(),
        expected_delivery_date: po.expected_delivery_date || '',
        payment_terms: po.payment_terms || '',
        delivery_address: po.delivery_address || '',
        notes: po.notes || '',
        items: (po.purchase_order_items || []).map(item => ({
          ...item,
          has_miscellaneous_expenses: item.has_miscellaneous_expenses || false,
          miscellaneous_amount: item.miscellaneous_amount || 0,
          miscellaneous_note: item.miscellaneous_note || ''
        }))
      });
    } else {
      setEditingPO(null);
      setFormData({
        party_id: '',
        order_date: new Date().toISOString(),
        expected_delivery_date: '',
        payment_terms: '',
        delivery_address: '',
        notes: '',
        items: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPO(null);
    setFormData({
      party_id: '',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: '',
      payment_terms: '',
      delivery_address: '',
      notes: '',
      items: []
    });
  };

  const handleOpenReceiveModal = (po) => {
    setShowReceiveModal(po);
    const receivableItems = po.purchase_order_items?.map(item => ({
      item_id: item.id,
      item_name: item.item_name,
      ordered_quantity: item.quantity,
      received_quantity: item.received_quantity || 0,
      pending_quantity: item.pending_quantity || item.quantity,
      receive_now: 0
    })) || [];
    
    setReceiveData({
      received_items: receivableItems,
      notes: ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-3 text-lg text-muted-foreground">Loading purchase orders...</span>
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
                  <p className="text-sm font-medium text-muted-foreground">Total POs</p>
                  <p className="text-2xl font-bold text-foreground">{totalPOs}</p>
                </div>
                <ClipboardDocumentListIcon className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-foreground">
                    {purchaseOrders.filter(po => ['draft', 'confirmed'].includes(po.status)).length}
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
                  <p className="text-sm font-medium text-muted-foreground">Received</p>
                  <p className="text-2xl font-bold text-foreground">
                    {purchaseOrders.filter(po => po.status === 'received').length}
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
                  <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(purchaseOrders.reduce((sum, po) => sum + (po.final_amount || 0), 0))}
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
                <CardTitle className="text-lg">Purchase Orders</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="md:hidden">
                  <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>
              <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_VENDORS}>
                <Button onClick={() => handleOpenModal()} className="btn-primary">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create PO
                </Button>
              </PermissionGuard>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input type="text" placeholder="Search POs..." className="input-field w-full pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <select className="input-field" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  {PO_STATUSES.map(status => (<option key={status.value} value={status.value}>{status.label}</option>))}
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
            {purchaseOrders.length === 0 ? (
              <div className="p-12 text-center">
                <ClipboardDocumentListIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No purchase orders found</h3>
                <p className="text-muted-foreground">Get started by creating your first purchase order</p>
              </div>
            ) : (
              <div className="divide-y">
                {purchaseOrders.map((po) => {
                  const statusInfo = getStatusInfo(po.status);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div key={po.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 mb-3 sm:mb-0">
                          <div className="flex items-start justify-between sm:items-center sm:space-x-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base sm:text-lg font-medium text-foreground truncate">{po.po_number}</h3>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {statusInfo.label}
                                </span>
                              </div>
                              <div className="mt-1 space-y-1 sm:space-y-0 sm:flex sm:items-center sm:space-x-4 text-sm text-muted-foreground">
                                <div><span className="font-medium">Party:</span> {po.party?.name || 'N/A'}</div>
                                <div><span className="font-medium">Date:</span> {new Date(po.order_date).toLocaleDateString()}</div>
                                <div><span className="font-medium">Amount:</span> {formatCurrency(po.final_amount)}</div>
                                {po.expected_delivery_date && <div><span className="font-medium">Delivery:</span> {new Date(po.expected_delivery_date).toLocaleDateString()}</div>}
                              </div>
                              {po.purchase_order_items && po.purchase_order_items.length > 0 && (
                                <div className="mt-2 text-sm text-muted-foreground">
                                  {po.purchase_order_items.length} item(s) • 
                                  {po.purchase_order_items.some(item => (item.received_quantity || 0) > 0) 
                                    ? ` Partially received` 
                                    : ` Not received`
                                  }
                                </div>
                              )}
                            </div>
                            <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_VENDORS}>
                              <div className="hidden sm:flex items-center space-x-2 ml-4">
                                <Button variant="ghost" size="icon" onClick={() => fetchPODetails(po.id)} className="h-9 w-9 text-muted-foreground hover:text-primary" title="View Details">
                                  <EyeIcon className="w-4 h-4" />
                                </Button>
                                {['confirmed', 'partial_received'].includes(po.status) && (
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenReceiveModal(po)} className="h-9 w-9 text-muted-foreground hover:text-success" title="Receive Items">
                                    <TruckIcon className="w-4 h-4" />
                                  </Button>
                                )}
                                {po.status === 'draft' && (
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenModal(po)} className="h-9 w-9 text-muted-foreground hover:text-primary" title="Edit PO">
                                    <PencilIcon className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </PermissionGuard>
                          </div>
                        </div>
                        <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_VENDORS}>
                          <div className="flex sm:hidden space-x-2 mt-3 pt-3 border-t">
                            <Button variant="outline" size="sm" onClick={() => fetchPODetails(po.id)} className="flex-1">
                              <EyeIcon className="w-4 h-4 mr-2" />View
                            </Button>
                            {['confirmed', 'partial_received'].includes(po.status) && (
                              <Button variant="outline" size="sm" onClick={() => handleOpenReceiveModal(po)} className="flex-1">
                                <TruckIcon className="w-4 h-4 mr-2" />Receive
                              </Button>
                            )}
                            {po.status === 'draft' && (
                              <Button variant="outline" size="sm" onClick={() => handleOpenModal(po)} className="flex-1">
                                <PencilIcon className="w-4 h-4 mr-2" />Edit
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

        {/* Purchase Order Form Modal - Using Unified Component */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    Create Purchase Orders
                  </h2>
                  <button onClick={handleCloseModal} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                <UnifiedVendorOrderForm
                  mode="create"
                  onSubmit={handleSubmitUnifiedForm}
                  onCancel={handleCloseModal}
                />
              </div>
            </div>
          </div>
        )}

        {/* Receive Items Modal */}
        {showReceiveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    Receive Items - {showReceiveModal.po_number}
                  </h2>
                  <button onClick={() => setShowReceiveModal(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Receive modal content will go here - placeholder for now */}
              <div className="p-4 sm:p-6">
                <p className="text-muted-foreground">Receive items functionality coming soon...</p>
              </div>
            </div>
          </div>
        )}

        {/* PO Details Modal */}
        {showPODetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    Purchase Order Details - {showPODetails.po_number}
                  </h2>
                  <button onClick={() => setShowPODetails(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-6">
                {/* PO Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Order Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div><span className="text-sm text-muted-foreground">PO Number:</span> <span className="font-medium">{showPODetails.po_number}</span></div>
                      <div><span className="text-sm text-muted-foreground">Order Date:</span> <span className="font-medium">{new Date(showPODetails.order_date).toLocaleDateString()}</span></div>
                      <div><span className="text-sm text-muted-foreground">Expected Delivery:</span> <span className="font-medium">{showPODetails.expected_delivery_date ? new Date(showPODetails.expected_delivery_date).toLocaleDateString() : 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">Status:</span> <span className={`font-medium px-2 py-1 rounded text-xs ${getStatusInfo(showPODetails.status).color}`}>{getStatusInfo(showPODetails.status).label}</span></div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Party Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div><span className="text-sm text-muted-foreground">Party Name:</span> <span className="font-medium">{showPODetails.party?.name || 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">Contact:</span> <span className="font-medium">{showPODetails.party?.contact_person || 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">Phone:</span> <span className="font-medium">{showPODetails.party?.phone_number || 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">Email:</span> <span className="font-medium">{showPODetails.party?.email || 'N/A'}</span></div>
                    </CardContent>
                  </Card>
                </div>

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
                            <th className="text-right py-2">Received</th>
                            <th className="text-right py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {showPODetails.purchase_order_items?.map((item, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2">
                                <div>
                                  <p className="font-medium">{item.item_name}</p>
                                  {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                                </div>
                              </td>
                              <td className="text-right py-2">{item.quantity} {item.unit}</td>
                              <td className="text-right py-2">{formatCurrency(item.price_per_unit)}</td>
                              <td className="text-right py-2">
                                <span className={`px-2 py-1 rounded text-xs ${(item.received_quantity || 0) >= item.quantity ? 'bg-green-100 text-green-800' : (item.received_quantity || 0) > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {item.received_quantity || 0} / {item.quantity}
                                </span>
                              </td>
                              <td className="text-right py-2">{formatCurrency(item.total_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2">
                            <th colSpan="4" className="text-right py-2">Total Amount:</th>
                            <th className="text-right py-2">{formatCurrency(showPODetails.final_amount)}</th>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Status Update Actions */}
                <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_VENDORS}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {showPODetails.status === 'draft' && (
                          <Button onClick={() => handleUpdateStatus(showPODetails.id, 'confirmed')} size="sm" className="btn-primary">
                            <CheckCircleIcon className="w-4 h-4 mr-2" />
                            Confirm Order
                          </Button>
                        )}
                        {['confirmed', 'partial_received'].includes(showPODetails.status) && (
                          <Button onClick={() => handleOpenReceiveModal(showPODetails)} size="sm" className="btn-primary">
                            <TruckIcon className="w-4 h-4 mr-2" />
                            Receive Items
                          </Button>
                        )}
                        {!['received', 'cancelled'].includes(showPODetails.status) && (
                          <Button onClick={() => handleUpdateStatus(showPODetails.id, 'cancelled')} size="sm" variant="destructive">
                            <XCircleIcon className="w-4 h-4 mr-2" />
                            Cancel Order
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </PermissionGuard>
              </div>
            </div>
          </div>
        )}

        <Toaster />
      </div>
    </PermissionGuard>
  );
};

export default PurchaseOrderManagement;