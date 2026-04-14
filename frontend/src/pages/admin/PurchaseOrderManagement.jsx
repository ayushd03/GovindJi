import React, { useState, useEffect, useCallback } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  CurrencyRupeeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/useToast';
import { Toaster } from '../../components/ui/toaster';
import UnifiedVendorOrderForm from './components/UnifiedVendorOrderForm';
import { API_BASE_URL } from '../../config/apiBaseUrl';
import { ITEMS_PER_PAGE } from '../../constants/adminConstants';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(ITEMS_PER_PAGE);
  const [totalPOs, setTotalPOs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPODetails, setShowPODetails] = useState(null);
  const [showReceiveModal, setShowReceiveModal] = useState(null);

  const [receiveData, setReceiveData] = useState({
    received_items: [],
    notes: ''
  });

  const showSuccess = useCallback((message) => {
    toast({
      title: "Success",
      description: message,
      variant: "success",
      duration: 3000,
    });
  }, [toast]);

  const showError = useCallback((message) => {
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
      duration: 5000,
    });
  }, [toast]);

  const fetchPurchaseOrders = useCallback(async (page = 1, limit = itemsPerPage) => {
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
      const nextPurchaseOrders = Array.isArray(data.purchase_orders) ? data.purchase_orders : [];
      const pagination = data.pagination;

      if (!pagination || typeof pagination !== 'object') {
        throw new Error('Invalid purchase orders response format');
      }

      setPurchaseOrders(nextPurchaseOrders);
      setTotalPOs(Number(pagination.total) || 0);
      setTotalPages(Math.max(1, Number(pagination.totalPages) || 1));
      setCurrentPage(Number(pagination.page) || page);
      setError(null);
    } catch (err) {
      setError(err.message);
      showError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage, searchTerm, selectedStatus, selectedParty, startDate, endDate, showError]);

  const fetchParties = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const nextParties = [];
      let page = 1;

      while (page <= 1000) {
        const queryParams = new URLSearchParams({
          party_type: 'vendor',
          page: page.toString(),
          limit: '200'
        });
        const response = await fetch(`${API_BASE_URL}/api/admin/parties?${queryParams}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to fetch parties');

        const data = await response.json();
        const pagedParties = Array.isArray(data.parties) ? data.parties : [];
        const pagination = data.pagination;
        if (!pagination || typeof pagination !== 'object') {
          throw new Error('Invalid parties response format');
        }

        nextParties.push(...pagedParties);
        if (!pagination.hasNextPage) break;
        page += 1;
      }

      setParties(nextParties);
    } catch (err) {
      console.error('Error fetching parties:', err);
    }
  }, []);

  useEffect(() => {
    fetchPurchaseOrders(1);
    fetchParties();
  }, [fetchParties, fetchPurchaseOrders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
        return;
      }
      fetchPurchaseOrders(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [endDate, fetchPurchaseOrders, searchTerm, selectedParty, selectedStatus, startDate]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      fetchPurchaseOrders(page);
    }
  };

  const getPaginationPages = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let page = start; page <= end; page += 1) pages.push(page);
    return pages;
  };

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

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
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
      <div className="admin-page">
        <div className="admin-page-header">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="admin-page-title">Purchase Orders</h1>
              <p className="admin-page-description">Create, track, and receive vendor purchase orders without leaving the admin flow.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="md:hidden">
                <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_VENDORS}>
                <Button onClick={() => handleOpenModal()} className="btn-primary">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create PO
                </Button>
              </PermissionGuard>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="admin-stat-card">
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
          
          <Card className="admin-stat-card">
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
          
          <Card className="admin-stat-card">
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
          
          <Card className="admin-stat-card">
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

        <Card className="admin-section">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">PO List</CardTitle>
                <p className="text-sm text-muted-foreground">Filter by vendor, status, and date range to review pending purchasing work.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="input-icon-left" />
                  <input type="text" placeholder="Search POs..." className="input-field input-with-left-icon w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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

        <Card className="admin-section overflow-hidden">
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
                          </div>
                        </PermissionGuard>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          {purchaseOrders.length > 0 && totalPages > 1 && (
            <div className="p-4 sm:p-6 border-t">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span> • <span className="font-medium">{totalPOs}</span> total
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 w-8 p-0">
                    <ChevronLeftIcon className="w-4 h-4" />
                  </Button>
                  <div className="hidden sm:flex items-center space-x-1">
                    {getPaginationPages().map((page) => (
                      <Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(page)} className="h-8 w-8 p-0">
                        {page}
                      </Button>
                    ))}
                  </div>
                  <div className="sm:hidden text-sm text-muted-foreground">Page {currentPage}</div>
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 w-8 p-0">
                    <ChevronRightIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Purchase Order Form Modal - Using Unified Component */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-6xl max-h-[95vh] overflow-y-auto rounded-3xl border bg-card shadow-2xl">
              <div className="admin-dialog-header admin-dialog-header-sticky">
                <div className="flex items-center justify-between">
                  <h2 className="admin-dialog-title">
                    Create Purchase Orders
                  </h2>
                  <button onClick={handleCloseModal} className="admin-dialog-close">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="admin-dialog-body">
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
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-3xl border bg-card shadow-2xl">
              <div className="admin-dialog-header admin-dialog-header-sticky">
                <div className="flex items-center justify-between">
                  <h2 className="admin-dialog-title">
                    Receive Items - {showReceiveModal.po_number}
                  </h2>
                  <button onClick={() => setShowReceiveModal(null)} className="admin-dialog-close">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="admin-dialog-body space-y-6">
                <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground sm:grid-cols-3">
                  <div>
                    <span className="font-medium text-foreground">Vendor:</span> {showReceiveModal.party?.name || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Status:</span> {getStatusInfo(showReceiveModal.status).label}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Expected:</span> {showReceiveModal.expected_delivery_date ? new Date(showReceiveModal.expected_delivery_date).toLocaleDateString() : 'N/A'}
                  </div>
                </div>

                <div className="space-y-4">
                  {receiveData.received_items.length === 0 ? (
                    <div className="admin-empty-state py-10">
                      <TruckIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No receivable items are available for this purchase order.</p>
                    </div>
                  ) : (
                    receiveData.received_items.map((item) => (
                      <div key={item.item_id} className="rounded-2xl border border-border/70 bg-card p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="space-y-1">
                            <h3 className="font-medium text-foreground">{item.item_name}</h3>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              <span>Ordered: {item.ordered_quantity}</span>
                              <span>Received: {item.received_quantity}</span>
                              <span>Pending: {item.pending_quantity}</span>
                            </div>
                          </div>
                          <div className="w-full lg:w-48">
                            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Receive Now
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={item.pending_quantity}
                              value={item.receive_now}
                              onChange={(e) => {
                                const nextValue = Math.max(0, Math.min(item.pending_quantity, Number(e.target.value) || 0));
                                setReceiveData((prev) => ({
                                  ...prev,
                                  received_items: prev.received_items.map((entry) => (
                                    entry.item_id === item.item_id ? { ...entry, receive_now: nextValue } : entry
                                  ))
                                }));
                              }}
                              className="input-field"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Receiving Notes</label>
                  <textarea
                    rows={3}
                    value={receiveData.notes}
                    onChange={(e) => setReceiveData((prev) => ({ ...prev, notes: e.target.value }))}
                    className="input-field"
                    placeholder="Add any receiving notes for this delivery"
                  />
                </div>

                <div className="admin-dialog-footer admin-dialog-footer-sticky">
                  <Button variant="outline" onClick={() => setShowReceiveModal(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReceiveItems}
                    className="btn-primary"
                    disabled={!receiveData.received_items.some((item) => item.receive_now > 0)}
                  >
                    Confirm Receipt
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PO Details Modal */}
        {showPODetails && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-6xl max-h-[95vh] overflow-y-auto rounded-3xl border bg-card shadow-2xl">
              <div className="admin-dialog-header admin-dialog-header-sticky">
                <div className="flex items-center justify-between">
                  <h2 className="admin-dialog-title">
                    Purchase Order Details - {showPODetails.po_number}
                  </h2>
                  <button onClick={() => setShowPODetails(null)} className="admin-dialog-close">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="admin-dialog-body space-y-6">
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
