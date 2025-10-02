import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../hooks/useToast';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import {
  BuildingOfficeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AdjustmentsHorizontalIcon,
  CurrencyRupeeIcon,
  IdentificationIcon,
  MapPinIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  EyeIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  CalendarIcon,
  DocumentDuplicateIcon,
  ClockIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Toaster } from '../../components/ui/toaster';
import AddVendorModal from './components/AddVendorModal';
import UnifiedVendorPaymentForm from './components/UnifiedVendorPaymentForm';

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

const CREDIT_LIMIT_TYPES = [
  { value: 'no_limit', label: 'No Limit' },
  { value: 'custom_limit', label: 'Custom Limit' }
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu',
  'Lakshadweep'
];

const PartyManagement = () => {
  const { toast } = useToast();
  const [parties, setParties] = useState([]);
  const [archivedParties, setArchivedParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'archived'

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalParties, setTotalParties] = useState(0);
  const [totalArchivedParties, setTotalArchivedParties] = useState(0);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedGstType, setSelectedGstType] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showPartyDetails, setShowPartyDetails] = useState(null);
  const [showVendorDetailsModal, setShowVendorDetailsModal] = useState(null);
  const [vendorDetailsTab, setVendorDetailsTab] = useState('orders');
  const [vendorOrders, setVendorOrders] = useState([]);
  const [vendorOrderItems, setVendorOrderItems] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hoveredPO, setHoveredPO] = useState(null);
  const [vendorDetailsLoading, setVendorDetailsLoading] = useState(false);
  const listScrollYRef = useRef(0);
  const paymentFormRef = useRef(null);
  
  // Removed formData state - now handled by AddVendorModal component

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
    // Only fetch initial active parties data on component mount
    fetchParties(1);
  }, []);

  const fetchParties = async (page = 1, limit = itemsPerPage) => {
    if (page === 1) setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        party_type: 'vendor',
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedGstType && { gst_type: selectedGstType }),
        ...(selectedState && { state: selectedState }),
      });

      const response = await fetch(`${API_BASE_URL}/api/admin/parties?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch parties');

      const data = await response.json();
      setParties(data.parties || data);
      setTotalParties(data.total || data.length || 0);
    } catch (err) {
      setError(err.message);
      showError('Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedParties = async (page = 1, limit = itemsPerPage) => {
    if (page === 1) setLoadingArchived(true);
    try {
      const token = localStorage.getItem('authToken');
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        party_type: 'vendor',
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedGstType && { gst_type: selectedGstType }),
        ...(selectedState && { state: selectedState }),
      });

      const response = await fetch(`${API_BASE_URL}/api/admin/parties/archived?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch archived parties');

      const data = await response.json();
      setArchivedParties(data.parties || data);
      setTotalArchivedParties(data.total || data.length || 0);
    } catch (err) {
      setError(err.message);
      showError('Failed to load archived parties');
    } finally {
      setLoadingArchived(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        if (viewMode === 'active') {
          fetchParties(1);
        } else if (viewMode === 'archived') {
          fetchArchivedParties(1);
        }
      } else {
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedCategory, selectedGstType, selectedState]);

  const currentTotal = viewMode === 'active' ? totalParties : totalArchivedParties;
  const currentPartiesList = viewMode === 'active' ? parties : archivedParties;
  const totalPages = Math.ceil(currentTotal / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, currentTotal);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      if (viewMode === 'active') {
        fetchParties(page);
      } else {
        fetchArchivedParties(page);
      }
    }
  };

  const getPaginationPages = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  };


  const handleDelete = async (partyId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/parties/${partyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();

        // If the error mentions archiving, directly show archive option without error popup
        if (errorData.error && errorData.error.includes('archive')) {
          setDeleteConfirm({ ...deleteConfirm, showArchiveOption: true, deleteError: errorData.error });
          return; // Don't throw error, just show archive option
        }

        throw new Error(errorData.error || 'Failed to delete party');
      }

      await fetchParties(currentPage);
      setDeleteConfirm(null);
      showSuccess('Party deleted successfully');
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message);
      showError(err.message);
      setDeleteConfirm(null);
    }
  };

  const handleArchive = async (partyId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/parties/${partyId}/archive`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ archive: true })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to archive party');
      }

      // Only refresh the current active view
      await fetchParties(currentPage);
      setDeleteConfirm(null);
      showSuccess('Party archived successfully. You can restore it later if needed.');
    } catch (err) {
      console.error('Archive error:', err);
      setError(err.message);
      showError('Failed to archive party');
    }
  };

  const handleUnarchive = async (partyId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/parties/${partyId}/archive`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ archive: false })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unarchive party');
      }

      // Only refresh the current archived view
      await fetchArchivedParties(currentPage);
      showSuccess('Party unarchived successfully and restored to active list.');
    } catch (err) {
      console.error('Unarchive error:', err);
      setError(err.message);
      showError('Failed to unarchive party');
    }
  };

  const handleOpenModal = (party = null) => {
    setEditingParty(party);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingParty(null);
  };

  const handleVendorAdded = (vendor) => {
    // Refresh the parties list when a vendor is added/updated
    fetchParties();
  };

  const fetchPartyDetails = async (partyId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/parties/${partyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch party details');

      const data = await response.json();
      setShowPartyDetails(data);
    } catch (err) {
      showError('Failed to load party details');
    }
  };

  const fetchVendorDetails = async (partyId) => {
    const vendor = parties.find(p => p.id === partyId);
    // Immediately show inline details view with loading state
    setShowVendorDetailsModal(vendor || null);
    setVendorDetailsTab('orders');
    setVendorOrders([]);
    setVendorPayments([]);
    setVendorOrderItems([]);
    setVendorDetailsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const ts = Date.now();
      const ordersUrl = `${API_BASE_URL}/api/admin/purchase-orders?party_id=${partyId}&limit=1000&__ts=${ts}`;
      const paymentsUrl = `${API_BASE_URL}/api/admin/party-payments?party_id=${partyId}&limit=1000&__ts=${ts}`;

      const commonOpts = {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      };

      const [ordersResponse, paymentsResponse] = await Promise.all([
        fetch(ordersUrl, commonOpts),
        fetch(paymentsUrl, commonOpts)
      ]);

      if (!ordersResponse.ok || !paymentsResponse.ok) {
        throw new Error('Failed to fetch vendor details');
      }

      const ordersData = await ordersResponse.json();
      const paymentsData = await paymentsResponse.json();

      const orders = ordersData.purchase_orders || [];
      setVendorOrders(orders);
      setVendorPayments(paymentsData.payments || []);

      // Extract all items from all purchase orders
      const allItems = [];
      orders.forEach(order => {
        if (order.purchase_order_items && order.purchase_order_items.length > 0) {
          order.purchase_order_items.forEach(item => {
            allItems.push({
              ...item,
              po_number: order.po_number,
              order_date: order.order_date,
              order_status: order.status,
              order_id: order.id
            });
          });
        }
      });
      setVendorOrderItems(allItems);
    } catch (err) {
      showError('Failed to load vendor details');
    } finally {
      setVendorDetailsLoading(false);
    }
  };

  const openVendorDetails = (partyId) => {
    listScrollYRef.current = window.scrollY || 0;
    fetchVendorDetails(partyId);
  };


  const calculateVendorBalance = (vendor, orders, payments) => {
    const totalOrderAmount = orders
      .filter(order => order.status !== 'cancelled')
      .reduce((sum, order) => sum + (order.final_amount || 0), 0);
    
    const totalPayments = payments
      .filter(payment => payment.payment_type === 'payment')
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);
    
    return totalOrderAmount - totalPayments;
  };

  const getTotalItemsValue = (items) => {
    return items
      .filter(item => item.order_status !== 'cancelled')
      .reduce((sum, item) => sum + (item.total_amount || 0), 0);
  };

  const getCombinedTransactionHistory = (orders, payments) => {
    const transactions = [];

    // Add PO entries (amounts due) - these represent debt to vendor
    orders
      .filter(order => order.status !== 'cancelled')
      .forEach(order => {
        transactions.push({
          type: 'po_created',
          date: order.order_date,
          created_at: order.created_at || order.order_date,
          amount: order.final_amount,
          description: `Purchase Order: ${order.po_number}`,
          po_number: order.po_number,
          po_items: order.purchase_order_items || [],
          id: `po_${order.id}`
        });
      });

    // Add payment entries (only actual payments, not adjustments)
    // Note: Adjustment entries are legacy/deprecated and should not appear in balance sheet
    payments
      .filter(payment => payment.payment_type === 'payment')
      .forEach(payment => {
        transactions.push({
          type: 'payment',
          date: payment.payment_date,
          created_at: payment.created_at || payment.payment_date,
          amount: payment.amount,
          description: 'Payment',
          reference_number: payment.reference_number,
          notes: payment.notes,
          id: `payment_${payment.id}`
        });
      });

    // Sort by created_at timestamp first, then by date (chronologically - oldest first)
    return transactions.sort((a, b) => {
      const dateA = new Date(a.created_at || a.date);
      const dateB = new Date(b.created_at || b.date);

      // If created_at timestamps are the same, use date as secondary sort
      if (dateA.getTime() === dateB.getTime()) {
        return new Date(a.date) - new Date(b.date);
      }

      return dateA - dateB;
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const isLoading = viewMode === 'active' ? loading : loadingArchived;

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_VENDORS}>
      <div className="space-y-6">
        {/* Top Header Bar with unified action */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {showVendorDetailsModal ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowVendorDetailsModal(null)}
                      className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border hover:bg-muted"
                    >
                      <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back
                    </button>
                    <div>
                      <h1 className="text-lg sm:text-xl font-semibold text-foreground">{showVendorDetailsModal.name}</h1>
                      <p className="text-xs text-muted-foreground">Vendor details</p>
                    </div>
                  </>
                ) : (
                  <div>
                    <h1 className="text-lg sm:text-xl font-semibold text-foreground">Vendors</h1>
                    <p className="text-xs text-muted-foreground">Manage vendors, balances and payments</p>
                  </div>
                )}
              </div>
              <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_VENDORS}>
                {showVendorDetailsModal ? (
                  <Button onClick={() => setShowPaymentModal(true)} className="btn-primary">
                    <BanknotesIcon className="w-4 h-4 mr-2" /> Add Payment
                  </Button>
                ) : (
                  <Button onClick={() => handleOpenModal()} className="btn-primary">
                    <PlusIcon className="w-4 h-4 mr-2" /> Add Party
                  </Button>
                )}
              </PermissionGuard>
            </div>
          </CardHeader>
        </Card>
        {/* Header with Summary Cards (hidden while viewing a vendor to avoid confusion) */}
        {!showVendorDetailsModal && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Parties</p>
                    <p className="text-2xl font-bold text-foreground">{totalParties}</p>
                  </div>
                  <BuildingOfficeIcon className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Vendors</p>
                    <p className="text-2xl font-bold text-foreground">{parties.filter(p => p.is_active).length}</p>
                  </div>
                  <UserIcon className="w-8 h-8 text-success" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(parties.reduce((sum, p) => sum + (p.current_balance || 0), 0))}
                    </p>
                  </div>
                  <CurrencyRupeeIcon className="w-8 h-8 text-warning" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">GST Registered</p>
                    <p className="text-2xl font-bold text-foreground">
                      {parties.filter(p => p.gst_type === 'Registered').length}
                    </p>
                  </div>
                  <IdentificationIcon className="w-8 h-8 text-info" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!showVendorDetailsModal && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg">Party Management</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="md:hidden">
                  <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>
              {/* Actions moved to unified header */}
            </div>

            {/* View Mode Tabs */}
            <div className="mt-4 border-b">
              <nav className="flex space-x-8">
                <button
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${viewMode === 'active' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  onClick={() => {
                    if (viewMode !== 'active') {
                      setViewMode('active');
                      setCurrentPage(1);
                      setLoading(true);
                      fetchParties(1);
                    }
                  }}
                >
                  Active Parties
                </button>
                <button
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${viewMode === 'archived' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  onClick={() => {
                    if (viewMode !== 'archived') {
                      setViewMode('archived');
                      setCurrentPage(1);
                      setLoadingArchived(true);
                      fetchArchivedParties(1);
                    }
                  }}
                >
                  <ArchiveBoxIcon className="w-4 h-4 mr-2 inline" />
                  Archived Parties
                </button>
              </nav>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mb-4 md:hidden">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input type="text" placeholder="Search parties..." className="input-field w-full pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div className="relative hidden md:block">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input type="text" placeholder="Search parties..." className="input-field w-full pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <select className="input-field" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                  <option value="">All Categories</option>
                  {PARTY_CATEGORIES.map(category => (<option key={category} value={category}>{category}</option>))}
                </select>
                <select className="input-field" value={selectedGstType} onChange={(e) => setSelectedGstType(e.target.value)}>
                  <option value="">All GST Types</option>
                  {GST_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                </select>
                <select className="input-field" value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
                  <option value="">All States</option>
                  {INDIAN_STATES.map(state => (<option key={state} value={state}>{state}</option>))}
                </select>
                <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedCategory(''); setSelectedGstType(''); setSelectedState(''); }}>Clear Filters</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {error && (<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4"><p className="text-destructive-foreground">{error}</p></div>)}

        {!showVendorDetailsModal && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>
                {viewMode === 'active' ? 'Active' : 'Archived'} Parties
                {!isLoading ? ` (${currentTotal})` : ''}
              </CardTitle>
              {!isLoading && (
                <div className="text-sm text-muted-foreground">Showing {startIndex + 1}-{endIndex} of {currentTotal}</div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                <p className="text-sm text-muted-foreground">Loading {viewMode === 'active' ? 'active' : 'archived'} parties...</p>
              </div>
            ) : currentPartiesList.length === 0 ? (
              <div className="p-12 text-center">
                {viewMode === 'archived' ? (
                  <ArchiveBoxIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                ) : (
                  <BuildingOfficeIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                )}
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {viewMode === 'archived' ? 'No archived parties found' : 'No parties found'}
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm || selectedCategory || selectedGstType || selectedState
                    ? "Try adjusting your search criteria"
                    : viewMode === 'archived'
                    ? "No parties have been archived yet"
                    : "Get started by adding your first party"}
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {currentPartiesList.map((party) => (
                    <div key={party.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 mb-3 sm:mb-0">
                          <div className="flex items-start justify-between sm:items-center sm:space-x-4">
                            <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <button
                                type="button"
                                onClick={() => openVendorDetails(party.id)}
                                className="text-left text-base sm:text-lg font-medium text-primary hover:underline truncate"
                                title="View details"
                              >
                                {party.name}
                              </button>
                                {party.gstin && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
                                    GST
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 space-y-1 sm:space-y-0 sm:flex sm:items-center sm:space-x-4 text-sm text-muted-foreground">
                                {party.contact_person && (<div className="flex items-center"><UserIcon className="w-4 h-4 mr-1 flex-shrink-0" /><span className="truncate">{party.contact_person}</span></div>)}
                                {party.phone_number && (<div className="flex items-center"><PhoneIcon className="w-4 h-4 mr-1 flex-shrink-0" /><span className="truncate">{party.phone_number}</span></div>)}
                                {party.email && (<div className="flex items-center"><EnvelopeIcon className="w-4 h-4 mr-1 flex-shrink-0" /><span className="truncate">{party.email}</span></div>)}
                                {party.state && (<div className="flex items-center"><MapPinIcon className="w-4 h-4 mr-1 flex-shrink-0" /><span className="truncate">{party.state}</span></div>)}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{party.category}</span>
                                {party.gst_type && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary">{party.gst_type}</span>
                                )}
                                {party.current_balance !== 0 && (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${party.current_balance > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                                    {formatCurrency(party.current_balance)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_VENDORS}>
                              <div className="hidden sm:flex items-center space-x-2 ml-4">
                                <Button variant="ghost" size="icon" onClick={() => openVendorDetails(party.id)} className="h-9 w-9 text-muted-foreground hover:text-primary">
                                  <EyeIcon className="w-4 h-4" />
                                </Button>
                                {viewMode === 'active' ? (
                                  <>
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(party)} className="h-9 w-9 text-muted-foreground hover:text-primary">
                                      <PencilIcon className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(party)} className="h-9 w-9 text-muted-foreground hover:text-destructive">
                                      <TrashIcon className="w-4 h-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <Button variant="ghost" size="icon" onClick={() => handleUnarchive(party.id)} className="h-9 w-9 text-muted-foreground hover:text-success" title="Unarchive Party">
                                    <ArchiveBoxIcon className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </PermissionGuard>
                          </div>
                        </div>
                        <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_VENDORS}>
                          <div className="flex sm:hidden space-x-2 mt-3 pt-3 border-t">
                            <Button variant="outline" size="sm" onClick={() => openVendorDetails(party.id)} className="flex-1">
                              <EyeIcon className="w-4 h-4 mr-2" />View
                            </Button>
                            {viewMode === 'active' ? (
                              <>
                                <Button variant="outline" size="sm" onClick={() => handleOpenModal(party)} className="flex-1">
                                  <PencilIcon className="w-4 h-4 mr-2" />Edit
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(party)} className="flex-1">
                                  <TrashIcon className="w-4 h-4 mr-2" />Delete
                                </Button>
                              </>
                            ) : (
                              <Button variant="outline" size="sm" onClick={() => handleUnarchive(party.id)} className="flex-1">
                                <ArchiveBoxIcon className="w-4 h-4 mr-2" />Unarchive
                              </Button>
                            )}
                          </div>
                        </PermissionGuard>
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="p-4 sm:p-6 border-t">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-sm text-muted-foreground">Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{endIndex}</span> of <span className="font-medium">{currentTotal}</span> results</div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 w-8 p-0"><ChevronLeftIcon className="w-4 h-4" /></Button>
                        <div className="hidden sm:flex items-center space-x-1">
                          {getPaginationPages().map((page) => (<Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => handlePageChange(page)} className="h-8 w-8 p-0">{page}</Button>))}
                        </div>
                        <div className="sm:hidden text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
                        <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 w-8 p-0"><ChevronRightIcon className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        )}

        {/* Reusable AddVendorModal Component */}
        <AddVendorModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onVendorAdded={handleVendorAdded}
          editingVendor={editingParty}
          mode={editingParty ? 'edit' : 'add'}
          apiBaseUrl={API_BASE_URL}
        />


        {/* Party Details Modal */}
        {showPartyDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">Party Details - {showPartyDetails.party.name}</h2>
                  <button onClick={() => setShowPartyDetails(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg"><XMarkIcon className="w-5 h-5" /></button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 space-y-6">
                {/* Party Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div><span className="text-sm text-muted-foreground">Contact Person:</span> <span className="font-medium">{showPartyDetails.party.contact_person || 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">Phone:</span> <span className="font-medium">{showPartyDetails.party.phone_number || 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">Email:</span> <span className="font-medium">{showPartyDetails.party.email || 'N/A'}</span></div>
                      <div><span className="text-sm text-muted-foreground">State:</span> <span className="font-medium">{showPartyDetails.party.state || 'N/A'}</span></div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Financial Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div><span className="text-sm text-muted-foreground">Current Balance:</span> <span className="font-medium">{formatCurrency(showPartyDetails.party.current_balance)}</span></div>
                      <div><span className="text-sm text-muted-foreground">Credit Limit:</span> <span className="font-medium">{showPartyDetails.party.credit_limit_type === 'no_limit' ? 'No Limit' : formatCurrency(showPartyDetails.party.credit_limit)}</span></div>
                      <div><span className="text-sm text-muted-foreground">GST Type:</span> <span className="font-medium">{showPartyDetails.party.gst_type}</span></div>
                      <div><span className="text-sm text-muted-foreground">GSTIN:</span> <span className="font-medium">{showPartyDetails.party.gstin || 'N/A'}</span></div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Transactions */}
                {showPartyDetails.transactions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recent Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {showPartyDetails.transactions.slice(0, 5).map((transaction, index) => (
                          <div key={index} className="flex justify-between items-center py-2 border-b border-muted last:border-0">
                            <div>
                              <p className="font-medium">{transaction.description}</p>
                              <p className="text-sm text-muted-foreground">{new Date(transaction.transaction_date).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              {transaction.debit_amount > 0 && <p className="text-red-600">-{formatCurrency(transaction.debit_amount)}</p>}
                              {transaction.credit_amount > 0 && <p className="text-green-600">+{formatCurrency(transaction.credit_amount)}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Purchase Orders */}
                {showPartyDetails.purchaseOrders.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recent Purchase Orders</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {showPartyDetails.purchaseOrders.slice(0, 3).map((po, index) => (
                          <div key={index} className="flex justify-between items-center py-2 border-b border-muted last:border-0">
                            <div>
                              <p className="font-medium">{po.po_number}</p>
                              <p className="text-sm text-muted-foreground">{new Date(po.order_date).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(po.final_amount)}</p>
                              <p className={`text-sm ${po.status === 'received' ? 'text-green-600' : po.status === 'cancelled' ? 'text-red-600' : 'text-yellow-600'}`}>
                                {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                              </p>
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

        {/* Inline Vendor Details View */}
        {showVendorDetailsModal && (
          <div className="bg-card rounded-xl shadow-sm border">
            <div className="p-4 sm:p-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    {showVendorDetailsModal.name}
                  </h2>
                  {vendorDetailsTab !== 'balance' && (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      calculateVendorBalance(showVendorDetailsModal, vendorOrders, vendorPayments) > 0 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      Balance: {formatCurrency(calculateVendorBalance(showVendorDetailsModal, vendorOrders, vendorPayments))}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 border-b">
                <nav className="flex space-x-8">
                  <button 
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${vendorDetailsTab === 'orders' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setVendorDetailsTab('orders')}
                  >
                    <ClipboardDocumentListIcon className="w-4 h-4 mr-2 inline" />
                    Ordered Items
                  </button>
                  <button 
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${vendorDetailsTab === 'balance' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setVendorDetailsTab('balance')}
                  >
                    <ReceiptPercentIcon className="w-4 h-4 mr-2 inline" />
                    Balance Sheet
                  </button>
                </nav>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {vendorDetailsLoading && (
                <div className="mb-4 flex items-center text-sm text-muted-foreground">
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" /> Loading vendor details...
                </div>
              )}
              {/* Orders Tab */}
              {vendorDetailsTab === 'orders' && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                              <p className="text-2xl font-bold text-foreground">{vendorOrderItems.length}</p>
                            </div>
                            <ClipboardDocumentListIcon className="w-8 h-8 text-primary" />
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Total Quantity</p>
                              <p className="text-2xl font-bold text-foreground">
                                {vendorOrderItems.reduce((sum, item) => sum + (item.quantity || 0), 0).toFixed(2)}
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
                              <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                              <p className="text-2xl font-bold text-foreground">
                                {formatCurrency(getTotalItemsValue(vendorOrderItems))}
                              </p>
                            </div>
                            <CurrencyRupeeIcon className="w-8 h-8 text-info" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Items List */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Ordered Items</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {vendorOrderItems.length === 0 ? (
                          <div className="text-center py-8">
                            <ClipboardDocumentListIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                            <p className="text-muted-foreground">No items found for this vendor</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {vendorOrderItems.slice(0, 15).map((item, index) => (
                              <div key={index} className="flex items-center justify-between p-4 border border-muted rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex-1">
                                  <div className="mb-1">
                                    <h4 className="font-medium text-foreground">{item.item_name}</h4>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span>Qty: {item.quantity} {item.unit}</span>
                                    <span>•</span>
                                    <span>Rate: {formatCurrency(item.price_per_unit)}</span>
                                    <span>•</span>
                                    <span>Date: {new Date(item.order_date).toLocaleDateString()}</span>
                                    {item.sku && (
                                      <>
                                        <span>•</span>
                                        <span>SKU: {item.sku}</span>
                                      </>
                                    )}
                                  </div>
                                  {item.description && (
                                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="font-medium text-foreground">{formatCurrency(item.total_amount)}</p>
                                </div>
                              </div>
                            ))}
                            {vendorOrderItems.length > 15 && (
                              <div className="text-center pt-4">
                                <p className="text-sm text-muted-foreground">
                                  Showing 15 of {vendorOrderItems.length} items
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

              {/* Balance Sheet Tab */}
              {vendorDetailsTab === 'balance' && (
                <div className="space-y-6">
                    {/* Balance Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Total Items Amount</p>
                              <p className="text-2xl font-bold text-red-600">
                                {formatCurrency(getTotalItemsValue(vendorOrderItems))}
                              </p>
                            </div>
                            <DocumentDuplicateIcon className="w-8 h-8 text-red-500" />
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Total Payments</p>
                              <p className="text-2xl font-bold text-green-600">
                                {formatCurrency(vendorPayments.filter(payment => payment.payment_type === 'payment').reduce((sum, payment) => sum + (payment.amount || 0), 0))}
                              </p>
                            </div>
                            <BanknotesIcon className="w-8 h-8 text-green-500" />
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
                              <p className={`text-2xl font-bold ${
                                calculateVendorBalance(showVendorDetailsModal, vendorOrders, vendorPayments) > 0 
                                  ? 'text-red-600' 
                                  : 'text-green-600'
                              }`}>
                                {formatCurrency(Math.abs(calculateVendorBalance(showVendorDetailsModal, vendorOrders, vendorPayments)))}
                              </p>
                            </div>
                            <ReceiptPercentIcon className={`w-8 h-8 ${
                              calculateVendorBalance(showVendorDetailsModal, vendorOrders, vendorPayments) > 0 
                                ? 'text-red-500' 
                                : 'text-green-500'
                            }`} />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Transaction History */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Transaction History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {getCombinedTransactionHistory(vendorOrders, vendorPayments).length === 0 ? (
                          <div className="text-center py-8">
                            <DocumentDuplicateIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                            <p className="text-muted-foreground">No transactions found for this vendor</p>
                          </div>
                        ) : (
                          <div className="space-y-3 relative">
                            {getCombinedTransactionHistory(vendorOrders, vendorPayments).slice(0, 15).map((transaction, index) => (
                              <div key={transaction.id} className={`flex items-center justify-between p-3 border rounded-lg relative ${
                                transaction.type === 'po_created' 
                                  ? 'bg-red-50 border-red-200' 
                                  : 'bg-green-50 border-green-200'
                              }`}>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">
                                      {transaction.description}
                                    </span>
                                    {transaction.reference_number && (
                                      <span className="text-sm text-muted-foreground">
                                        • Ref: {transaction.reference_number}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CalendarIcon className="w-4 h-4" />
                                    <span>{new Date(transaction.created_at || transaction.date).toLocaleDateString('en-IN')} {new Date(transaction.created_at || transaction.date).toLocaleTimeString('en-IN', { hour12: true })}</span>
                                    {transaction.notes && (
                                      <>
                                        <span>•</span>
                                        <span>{transaction.notes}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={`font-bold ${
                                    transaction.type === 'po_created' 
                                      ? 'text-red-600' 
                                      : 'text-green-600'
                                  }`}>
                                    {transaction.type === 'po_created' ? '-' : '+'}
                                    {formatCurrency(transaction.amount)}
                                  </p>
                                  <p className={`text-xs ${
                                    transaction.type === 'po_created' 
                                      ? 'text-red-500' 
                                      : 'text-green-500'
                                  }`}>
                                    {transaction.type === 'po_created' ? 'Amount Due' : 'Payment Made'}
                                  </p>
                                </div>

                                {/* Hover tooltip for PO items */}
                                {transaction.type === 'po_created' && transaction.po_items.length > 0 && (
                                  <div className="absolute inset-0 cursor-help" 
                                       onMouseEnter={() => setHoveredPO(transaction.id)}
                                       onMouseLeave={() => setHoveredPO(null)}>
                                  </div>
                                )}

                                {/* Tooltip */}
                                {hoveredPO === transaction.id && transaction.type === 'po_created' && (
                                  <div className="absolute z-50 top-full left-0 mt-2 w-80 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
                                    <div className="font-semibold text-sm mb-2">Items in {transaction.po_number}:</div>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {transaction.po_items.map((item, itemIndex) => (
                                        <div key={itemIndex} className="text-xs border-b border-gray-100 pb-2">
                                          <div className="font-medium">{item.item_name}</div>
                                          <div className="text-gray-600">
                                            Qty: {item.quantity} {item.unit} • Rate: {formatCurrency(item.price_per_unit)} • Total: {formatCurrency(item.total_amount)}
                                          </div>
                                          {item.description && (
                                            <div className="text-gray-500 italic">{item.description}</div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            {getCombinedTransactionHistory(vendorOrders, vendorPayments).length > 15 && (
                              <div className="text-center pt-4">
                                <p className="text-sm text-muted-foreground">
                                  Showing 15 of {getCombinedTransactionHistory(vendorOrders, vendorPayments).length} transactions
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vendor Payment Modal */}
        {showPaymentModal && showVendorDetailsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
              <div className="p-4 sm:p-6 border-b flex items-center justify-between sticky top-0 bg-card z-10">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                  Add Payment - {showVendorDetailsModal.name}
                </h2>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-0 sm:p-0 flex-1 overflow-hidden">
                <div className="p-4 sm:p-6 h-full overflow-y-auto">
                  <UnifiedVendorPaymentForm
                    ref={paymentFormRef}
                    preSelectedParty={{ id: showVendorDetailsModal.id, name: showVendorDetailsModal.name, party_type: 'vendor' }}
                    lockParty
                    renderActions={false}
                    onCancel={() => setShowPaymentModal(false)}
                    onSuccess={async () => {
                      setShowPaymentModal(false);
                      await fetchVendorDetails(showVendorDetailsModal.id);
                    }}
                  />
                </div>
              </div>
              <div className="border-t p-3 sm:p-4 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
                <Button className="btn-primary" onClick={() => paymentFormRef.current?.submit()}>Save Payments</Button>
              </div>
            </div>
          </div>
        )}


        {/* Enhanced Delete/Archive Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl max-w-lg w-full p-4 sm:p-6">
              {deleteConfirm.showArchiveOption ? (
                <>
                  {/* Archive Option UI */}
                  <div className="flex items-center justify-center w-12 h-12 bg-warning/10 rounded-full mx-auto mb-4">
                    <ExclamationTriangleIcon className="w-6 h-6 text-warning" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground text-center mb-2">Cannot Delete Party</h3>
                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
                    <p className="text-warning-foreground text-sm font-medium mb-2">
                      {deleteConfirm.deleteError}
                    </p>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <ArchiveBoxIcon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-foreground mb-1">Archive Party Instead</h4>
                          <p className="text-sm text-muted-foreground">
                            Archiving will hide this party from the active list while preserving all transaction history. 
                            You can restore it later if needed.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground bg-info/10 border border-info/20 rounded-lg p-3">
                      <strong>What happens when you archive:</strong>
                      <ul className="mt-2 space-y-1 list-disc list-inside">
                        <li>Party is hidden from active lists</li>
                        <li>All purchase orders and payments remain intact</li>
                        <li>Transaction history is preserved</li>
                        <li>Can be restored anytime if needed</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-center gap-3">
                    <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => handleArchive(deleteConfirm.id)}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      <ArchiveBoxIcon className="w-4 h-4 mr-2" />
                      Archive Party
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Standard Delete UI */}
                  <div className="flex items-center justify-center w-12 h-12 bg-destructive/10 rounded-full mx-auto mb-4">
                    <TrashIcon className="w-6 h-6 text-destructive" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground text-center mb-2">Delete Party</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Are you sure you want to delete "{deleteConfirm.name}"? This action cannot be undone.
                  </p>
                  <div className="flex flex-col sm:flex-row sm:justify-center gap-3">
                    <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => handleDelete(deleteConfirm.id)}>Delete</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        
        <Toaster />
      </div>
    </PermissionGuard>
  );
};

export default PartyManagement;