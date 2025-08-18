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
import { useToast } from '../../hooks/use-toast';
import { Toaster } from '../../components/ui/toaster';
import { categoriesAPI } from '../../services/api';

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

  const handleAddItem = () => {
    const newIndex = formData.items.length;
    setFormData({
      ...formData,
      items: [...formData.items, {
        product_id: '',
        item_name: '',
        description: '',
        category_id: '',
        item_hsn: '',
        sku: '',
        quantity: 1,
        unit: 'kg',
        price_per_unit: 0,
        discount_percentage: 0,
        tax_percentage: 0,
        total_amount: 0,
        has_miscellaneous_expenses: false,
        miscellaneous_amount: 0,
        miscellaneous_note: ''
      }]
    });
    // Auto-expand the new item
    setExpandedItems(prev => new Set([...prev, newIndex]));
  };

  const toggleItemExpansion = (index) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: DocumentTextIcon },
    { id: 'pricing', label: 'Pricing', icon: CalculatorIcon },
    { id: 'details', label: 'Details', icon: TagIcon }
  ];

  const isItemExpanded = (index) => expandedItems.has(index);

  // Filter products based on category selection
  const getFilteredProducts = (categoryId) => {
    if (!categoryId) return products;
    return products.filter(product => product.category_id === categoryId);
  };

  // Get product suggestions for autocomplete
  const getProductSuggestions = (searchTerm, categoryId) => {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    const filteredProducts = categoryId ? getFilteredProducts(categoryId) : products;
    
    return filteredProducts
      .filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .slice(0, 10); // Limit to 10 suggestions
  };

  // Handle autocomplete state
  const updateAutocompleteState = (index, state) => {
    setAutocompleteStates(prev => ({
      ...prev,
      [index]: { ...prev[index], ...state }
    }));
  };

  // Handle item name change with autocomplete
  const handleItemNameChange = (index, value) => {
    handleItemChange(index, 'item_name', value);
    
    const categoryId = formData.items[index]?.category_id;
    const suggestions = getProductSuggestions(value, categoryId);
    
    updateAutocompleteState(index, {
      showDropdown: value.length >= 2,
      suggestions: suggestions,
      highlightedIndex: -1
    });
  };

  // Handle product selection from autocomplete
  const handleProductFromAutocomplete = (index, product) => {
    console.log('Autocomplete selection:', product.name, 'for item index:', index);
    
    // Update all fields in a single batch
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      item_name: product.name,
      product_id: product.id,
      category_id: product.category_id || '',
      description: product.description || '',
      item_hsn: product.item_hsn || '',
      sku: product.sku || '',
      unit: product.unit || 'kg',
      price_per_unit: product.price || 0
    };

    // Recalculate totals for pricing fields
    const item = newItems[index];
    const subtotal = item.quantity * item.price_per_unit;
    const discount = (subtotal * item.discount_percentage) / 100;
    const afterDiscount = subtotal - discount;
    const tax = (afterDiscount * item.tax_percentage) / 100;
    const miscellaneousAmount = item.has_miscellaneous_expenses ? (item.miscellaneous_amount || 0) : 0;
    
    newItems[index].discount_amount = discount;
    newItems[index].tax_amount = tax;
    newItems[index].total_amount = afterDiscount + tax + miscellaneousAmount;

    // Update form data
    setFormData({ ...formData, items: newItems });

    // Hide autocomplete dropdown
    updateAutocompleteState(index, {
      showDropdown: false,
      suggestions: [],
      highlightedIndex: -1
    });
    
    console.log('Autocomplete selection completed');
  };

  // Handle category change to filter products
  const handleCategoryChange = (index, categoryId) => {
    handleItemChange(index, 'category_id', categoryId);
    
    // Clear product selection if it doesn't match the new category
    const currentProduct = products.find(p => p.id === formData.items[index]?.product_id);
    if (currentProduct && currentProduct.category_id !== categoryId) {
      handleItemChange(index, 'product_id', '');
    }
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
    // Remove from expanded items
    setExpandedItems(prev => {
      const newSet = new Set();
      for (const expandedIndex of prev) {
        if (expandedIndex < index) {
          newSet.add(expandedIndex);
        } else if (expandedIndex > index) {
          newSet.add(expandedIndex - 1);
        }
      }
      return newSet;
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate totals
    if (['quantity', 'price_per_unit', 'discount_percentage', 'tax_percentage', 'miscellaneous_amount'].includes(field)) {
      const item = newItems[index];
      const subtotal = item.quantity * item.price_per_unit;
      const discount = (subtotal * item.discount_percentage) / 100;
      const afterDiscount = subtotal - discount;
      const tax = (afterDiscount * item.tax_percentage) / 100;
      const miscellaneousAmount = item.has_miscellaneous_expenses ? (item.miscellaneous_amount || 0) : 0;
      
      newItems[index].discount_amount = discount;
      newItems[index].tax_amount = tax;
      newItems[index].total_amount = afterDiscount + tax + miscellaneousAmount;
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const handleProductSelect = (index, productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      handleItemChange(index, 'product_id', productId);
      handleItemChange(index, 'item_name', product.name);
      handleItemChange(index, 'description', product.description || '');
      handleItemChange(index, 'category_id', product.category_id || '');
      handleItemChange(index, 'item_hsn', product.item_hsn || '');
      handleItemChange(index, 'sku', product.sku || '');
      handleItemChange(index, 'unit', product.unit || 'kg');
      handleItemChange(index, 'price_per_unit', product.price || 0);
      
      // Hide autocomplete if it's open
      updateAutocompleteState(index, {
        showDropdown: false,
        suggestions: [],
        highlightedIndex: -1
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const url = editingPO 
        ? `${API_BASE_URL}/api/admin/purchase-orders/${editingPO.id}`
        : `${API_BASE_URL}/api/admin/purchase-orders`;
      const method = editingPO ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error(`Failed to ${editingPO ? 'update' : 'create'} purchase order`);

      await fetchPurchaseOrders(currentPage);
      handleCloseModal();
      showSuccess(editingPO ? 'Purchase order updated successfully' : 'Purchase order created successfully');
    } catch (err) {
      setError(err.message);
      showError(editingPO ? 'Failed to update purchase order' : 'Failed to create purchase order');
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
        showError(`Received ${result.results?.length || 0} items with ${result.errors.length} errors: ${result.errors.join(', ')}`);
      } else {
        showSuccess(`Successfully received ${result.results?.length || 0} items`);
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

        {/* Purchase Order Form Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    {editingPO ? 'Edit Purchase Order' : 'Create Purchase Order'}
                  </h2>
                  <button onClick={handleCloseModal} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
                {/* Basic PO Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Party *</label>
                    <select required className="input-field" value={formData.party_id} onChange={(e) => setFormData({...formData, party_id: e.target.value})}>
                      <option value="">Select Party</option>
                      {parties.map(party => (<option key={party.id} value={party.id}>{party.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Order Date & Time *</label>
                    <input type="datetime-local" required className="input-field" value={formData.order_date.slice(0, 16)} onChange={(e) => setFormData({...formData, order_date: new Date(e.target.value).toISOString()})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Expected Delivery Date</label>
                    <input type="date" className="input-field" value={formData.expected_delivery_date} onChange={(e) => setFormData({...formData, expected_delivery_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Payment Terms</label>
                    <input type="text" className="input-field" placeholder="e.g., Net 30 days" value={formData.payment_terms} onChange={(e) => setFormData({...formData, payment_terms: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Delivery Address</label>
                  <textarea rows={2} className="input-field" value={formData.delivery_address} onChange={(e) => setFormData({...formData, delivery_address: e.target.value})} />
                </div>

                {/* Items Section */}
                <div className="bg-muted/10 border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <CubeIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">Purchase Items</h3>
                        <p className="text-sm text-muted-foreground">
                          {formData.items.length} item{formData.items.length !== 1 ? 's' : ''} • Total: {formatCurrency(formData.items.reduce((sum, item) => sum + (item.total_amount || 0), 0))}
                        </p>
                      </div>
                    </div>
                    <Button type="button" onClick={handleAddItem} size="sm" className="btn-primary">
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {formData.items.map((item, index) => (
                      <div key={index} className="border border-border/60 rounded-lg bg-card overflow-hidden">
                        {/* Item Header - Always Visible */}
                        <div className="p-4 bg-muted/30 border-b border-border/40">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-sm font-medium text-primary">
                                  {index + 1}
                                </div>
                                <div>
                                  <h4 className="font-medium text-foreground">
                                    {item.item_name || `Item ${index + 1}`}
                                  </h4>
                                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                    <span>Qty: {item.quantity || 0} {item.unit}</span>
                                    <span>•</span>
                                    <span>Rate: {formatCurrency(item.price_per_unit || 0)}</span>
                                    <span>•</span>
                                    <span className="font-medium text-foreground">Total: {formatCurrency(item.total_amount || 0)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleItemExpansion(index)}
                                className="h-8 w-8 p-0"
                              >
                                {isItemExpanded(index) ? (
                                  <ChevronUpIcon className="w-4 h-4" />
                                ) : (
                                  <ChevronDownIcon className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Expandable Content */}
                        {isItemExpanded(index) && (
                          <div className="p-6">
                            {/* Tab Navigation */}
                            <div className="flex space-x-1 mb-6 bg-muted/50 p-1 rounded-lg">
                              {tabs.map((tab) => (
                                <button
                                  key={tab.id}
                                  type="button"
                                  onClick={() => setActiveTab(tab.id)}
                                  className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                    activeTab === tab.id
                                      ? 'bg-card text-foreground shadow-sm'
                                      : 'text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  <tab.icon className="w-4 h-4" />
                                  <span>{tab.label}</span>
                                </button>
                              ))}
                            </div>

                            {/* Tab Content */}
                            {activeTab === 'basic' && (
                              <div className="space-y-4">
                                {/* Item Name with Autocomplete - First */}
                                <div className="relative">
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                                    Item Name *
                                    <span className="text-xs text-muted-foreground/70 ml-1">(Start typing to see product suggestions)</span>
                                  </label>
                                  <input 
                                    type="text" 
                                    required 
                                    className="input-field" 
                                    placeholder="Enter item name or search products..."
                                    value={item.item_name} 
                                    onChange={(e) => handleItemNameChange(index, e.target.value)}
                                    onFocus={() => {
                                      if (item.item_name && item.item_name.length >= 2) {
                                        const categoryId = item.category_id;
                                        const suggestions = getProductSuggestions(item.item_name, categoryId);
                                        updateAutocompleteState(index, {
                                          showDropdown: suggestions.length > 0,
                                          suggestions: suggestions
                                        });
                                      }
                                    }}
                                    onBlur={(e) => {
                                      // Only hide if not clicking on dropdown
                                      if (!e.relatedTarget || !e.relatedTarget.closest('.autocomplete-dropdown')) {
                                        setTimeout(() => {
                                          updateAutocompleteState(index, { showDropdown: false });
                                        }, 200);
                                      }
                                    }}
                                  />
                                  
                                  {/* Autocomplete Dropdown */}
                                  {autocompleteStates[index]?.showDropdown && autocompleteStates[index]?.suggestions?.length > 0 && (
                                    <div className="autocomplete-dropdown absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                      {autocompleteStates[index].suggestions.map((product, suggestionIndex) => {
                                        const category = categories.find(c => c.id === product.category_id);
                                        return (
                                          <div
                                            key={product.id}
                                            className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border/40 last:border-b-0"
                                            onMouseDown={(e) => {
                                              e.preventDefault(); // Prevent blur from firing
                                              handleProductFromAutocomplete(index, product);
                                            }}
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex-1">
                                                <div className="font-medium text-foreground">{product.name}</div>
                                                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                                  {product.sku && <span className="bg-muted px-2 py-0.5 rounded">SKU: {product.sku}</span>}
                                                  {category && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">{category.name}</span>}
                                                </div>
                                              </div>
                                              <div className="text-right text-sm">
                                                <div className="font-medium text-foreground">{formatCurrency(product.price)}</div>
                                                <div className="text-xs text-muted-foreground">{product.unit}</div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Category and Product Selection - Second Row */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Category</label>
                                    <select 
                                      className="input-field" 
                                      value={item.category_id} 
                                      onChange={(e) => handleCategoryChange(index, e.target.value)}
                                    >
                                      <option value="">Select Category</option>
                                      {categories.map(category => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                                      Select Product 
                                      {item.category_id && (
                                        <span className="text-xs text-muted-foreground/70 ml-1">
                                          (Filtered by category)
                                        </span>
                                      )}
                                    </label>
                                    <select 
                                      className="input-field" 
                                      value={item.product_id} 
                                      onChange={(e) => handleProductSelect(index, e.target.value)}
                                    >
                                      <option value="">Choose existing product (optional)</option>
                                      {getFilteredProducts(item.category_id).map(product => (
                                        <option key={product.id} value={product.id}>
                                          {product.name} {product.sku ? `(${product.sku})` : ''}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* SKU Code - Third Row */}
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">SKU/Code</label>
                                  <input 
                                    type="text" 
                                    className="input-field" 
                                    placeholder="Item code (auto-filled when product selected)"
                                    value={item.sku} 
                                    onChange={(e) => handleItemChange(index, 'sku', e.target.value)} 
                                  />
                                </div>
                              </div>
                            )}

                            {activeTab === 'pricing' && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Quantity *</label>
                                    <input 
                                      type="number" 
                                      step="0.001" 
                                      required 
                                      className="input-field" 
                                      placeholder="0"
                                      value={item.quantity} 
                                      onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} 
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Unit</label>
                                    <select className="input-field" value={item.unit} onChange={(e) => handleItemChange(index, 'unit', e.target.value)}>
                                      <option value="kg">Kilogram (kg)</option>
                                      <option value="g">Gram (g)</option>
                                      <option value="pcs">Pieces (pcs)</option>
                                      <option value="box">Box</option>
                                      <option value="pack">Pack</option>
                                      <option value="ltr">Liter (ltr)</option>
                                      <option value="ml">Milliliter (ml)</option>
                                      <option value="other">Other</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Price per Unit *</label>
                                    <input 
                                      type="number" 
                                      step="0.01" 
                                      required 
                                      className="input-field" 
                                      placeholder="0.00"
                                      value={item.price_per_unit} 
                                      onChange={(e) => handleItemChange(index, 'price_per_unit', parseFloat(e.target.value) || 0)} 
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Total</label>
                                    <div className="input-field bg-muted/50 font-medium text-lg">
                                      {formatCurrency(item.total_amount || 0)}
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Discount %</label>
                                    <input 
                                      type="number" 
                                      step="0.01" 
                                      className="input-field" 
                                      placeholder="0"
                                      value={item.discount_percentage} 
                                      onChange={(e) => handleItemChange(index, 'discount_percentage', parseFloat(e.target.value) || 0)} 
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Tax %</label>
                                    <input 
                                      type="number" 
                                      step="0.01" 
                                      className="input-field" 
                                      placeholder="0"
                                      value={item.tax_percentage} 
                                      onChange={(e) => handleItemChange(index, 'tax_percentage', parseFloat(e.target.value) || 0)} 
                                    />
                                  </div>
                                </div>
                                
                                {/* Miscellaneous Expenses Section */}
                                <div className="bg-muted/30 border border-muted rounded-lg p-4">
                                  <div className="flex items-center space-x-3 mb-4">
                                    <input
                                      type="checkbox"
                                      id={`misc-expenses-${index}`}
                                      className="w-4 h-4 text-primary bg-card border-border rounded focus:ring-primary"
                                      checked={item.has_miscellaneous_expenses || false}
                                      onChange={(e) => {
                                        handleItemChange(index, 'has_miscellaneous_expenses', e.target.checked);
                                        if (!e.target.checked) {
                                          handleItemChange(index, 'miscellaneous_amount', 0);
                                          handleItemChange(index, 'miscellaneous_note', '');
                                        }
                                      }}
                                    />
                                    <label htmlFor={`misc-expenses-${index}`} className="text-sm font-medium text-foreground">
                                      Add miscellaneous expenses
                                    </label>
                                  </div>
                                  
                                  {item.has_miscellaneous_expenses && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                                          Miscellaneous Amount *
                                        </label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          className="input-field"
                                          placeholder="0.00"
                                          value={item.miscellaneous_amount || 0}
                                          onChange={(e) => handleItemChange(index, 'miscellaneous_amount', parseFloat(e.target.value) || 0)}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                                          Side Note
                                        </label>
                                        <input
                                          type="text"
                                          className="input-field"
                                          placeholder="Description for miscellaneous expense"
                                          value={item.miscellaneous_note || ''}
                                          onChange={(e) => handleItemChange(index, 'miscellaneous_note', e.target.value)}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Calculation Summary */}
                                <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-4">
                                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                                    <div className="text-center">
                                      <div className="text-muted-foreground">Subtotal</div>
                                      <div className="font-semibold text-foreground">{formatCurrency((item.quantity || 0) * (item.price_per_unit || 0))}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-muted-foreground">Discount</div>
                                      <div className="font-semibold text-orange-600">-{formatCurrency(item.discount_amount || 0)}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-muted-foreground">Tax</div>
                                      <div className="font-semibold text-blue-600">+{formatCurrency(item.tax_amount || 0)}</div>
                                    </div>
                                    {item.has_miscellaneous_expenses && (
                                      <div className="text-center">
                                        <div className="text-muted-foreground">Misc. Exp.</div>
                                        <div className="font-semibold text-purple-600">+{formatCurrency(item.miscellaneous_amount || 0)}</div>
                                      </div>
                                    )}
                                    <div className="text-center">
                                      <div className="text-muted-foreground">Final Total</div>
                                      <div className="font-bold text-lg text-primary">{formatCurrency(item.total_amount || 0)}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {activeTab === 'details' && (
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">HSN Code</label>
                                  <input 
                                    type="text" 
                                    className="input-field" 
                                    placeholder="Enter HSN code"
                                    value={item.item_hsn} 
                                    onChange={(e) => handleItemChange(index, 'item_hsn', e.target.value)} 
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
                                  <textarea 
                                    rows="3" 
                                    className="input-field" 
                                    placeholder="Item description (optional)"
                                    value={item.description} 
                                    onChange={(e) => handleItemChange(index, 'description', e.target.value)} 
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {formData.items.length === 0 && (
                      <div className="text-center py-12 border-2 border-dashed border-muted/60 rounded-xl bg-muted/20">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CubeIcon className="w-8 h-8 text-primary" />
                        </div>
                        <h4 className="text-lg font-medium text-foreground mb-2">No items added yet</h4>
                        <p className="text-muted-foreground mb-4">Start building your purchase order by adding items</p>
                        <Button type="button" onClick={handleAddItem} className="btn-primary">
                          <PlusIcon className="w-4 h-4 mr-2" />
                          Add Your First Item
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Order Summary */}
                  {formData.items.length > 0 && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-6">
                            <div className="text-center">
                              <div className="text-sm text-muted-foreground">Total Items</div>
                              <div className="text-xl font-bold text-foreground">{formData.items.length}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm text-muted-foreground">Total Quantity</div>
                              <div className="text-xl font-bold text-foreground">
                                {formData.items.reduce((sum, item) => sum + (item.quantity || 0), 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Order Total</div>
                            <div className="text-2xl font-bold text-primary">
                              {formatCurrency(formData.items.reduce((sum, item) => sum + (item.total_amount || 0), 0))}
                            </div>
                          </div>
                        </div>
                        
                        {/* Vendor vs Miscellaneous Breakdown */}
                        {formData.items.some(item => item.has_miscellaneous_expenses && item.miscellaneous_amount > 0) && (
                          <div className="border-t pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div className="text-center p-3 bg-card/50 rounded-lg">
                                <div className="text-muted-foreground font-medium">Vendor Expenses</div>
                                <div className="text-lg font-bold text-blue-600">
                                  {formatCurrency(formData.items.reduce((sum, item) => {
                                    const vendorAmount = (item.quantity || 0) * (item.price_per_unit || 0) - (item.discount_amount || 0) + (item.tax_amount || 0);
                                    return sum + vendorAmount;
                                  }, 0))}
                                </div>
                                <div className="text-xs text-muted-foreground">Items + Tax - Discount</div>
                              </div>
                              <div className="text-center p-3 bg-card/50 rounded-lg">
                                <div className="text-muted-foreground font-medium">Miscellaneous Expenses</div>
                                <div className="text-lg font-bold text-purple-600">
                                  {formatCurrency(formData.items.reduce((sum, item) => {
                                    return sum + (item.has_miscellaneous_expenses ? (item.miscellaneous_amount || 0) : 0);
                                  }, 0))}
                                </div>
                                <div className="text-xs text-muted-foreground">Additional expenses</div>
                              </div>
                              <div className="text-center p-3 bg-primary/10 rounded-lg">
                                <div className="text-muted-foreground font-medium">Grand Total</div>
                                <div className="text-lg font-bold text-primary">
                                  {formatCurrency(formData.items.reduce((sum, item) => sum + (item.total_amount || 0), 0))}
                                </div>
                                <div className="text-xs text-muted-foreground">Vendor + Miscellaneous</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Notes</label>
                  <textarea rows={3} className="input-field" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
                  <Button type="submit" className="btn-primary">{editingPO ? 'Update PO' : 'Create PO'}</Button>
                </div>
              </form>
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
              
              <div className="p-4 sm:p-6 space-y-6">
                <div className="space-y-4">
                  {receiveData.received_items.map((item, index) => (
                    <div key={index} className="p-4 border border-muted rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Ordered</p>
                          <p className="font-medium">{item.ordered_quantity}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Received</p>
                          <p className="font-medium">{item.received_quantity}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Pending</p>
                          <p className="font-medium">{item.pending_quantity}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-1">Receive Now</label>
                          <input 
                            type="number" 
                            step="0.001" 
                            max={item.pending_quantity}
                            className="input-field" 
                            value={item.receive_now} 
                            onChange={(e) => {
                              const newItems = [...receiveData.received_items];
                              newItems[index].receive_now = parseFloat(e.target.value) || 0;
                              setReceiveData({...receiveData, received_items: newItems});
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Notes</label>
                  <textarea rows={3} className="input-field" value={receiveData.notes} onChange={(e) => setReceiveData({...receiveData, notes: e.target.value})} />
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowReceiveModal(null)}>Cancel</Button>
                  <Button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleReceiveItems}
                    disabled={!receiveData.received_items.some(item => item.receive_now > 0)}
                  >
                    Receive Items
                  </Button>
                </div>
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