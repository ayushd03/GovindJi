import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import RoleIndicator from '../../components/RoleIndicator';
import {
  CurrencyDollarIcon,
  PlusIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CalendarIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
// Removed unused UI components
import { useToast } from '../../hooks/useToast';
import { Toaster } from '../../components/ui/toaster';
import { useExpensePreferences } from '../../hooks/useExpensePreferences';
import ExpensesCalendar from './components/ExpensesCalendar';

// Import sub-components
import ExpenseForm from './components/UnifiedExpenseForm';
import UnifiedVendorPaymentForm from './components/UnifiedVendorPaymentForm';

// Constants
const EXPENSE_CATEGORIES = [
  'Store Utilities',
  'Office Supplies',
  'Marketing',
  'Maintenance',
  'Transportation',
  'Miscellaneous',
  'Vendor Order',
  'Vendor Payment',
  'Employee Payout'
];

// Removed unused PAYMENT_METHODS constant

const ITEMS_PER_PAGE = 10;

const ExpenseManagement = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Screen-level tabs: 'add' or 'view'
  const { prefs, setDefaultView, setDefaultScope, setLastDateRange } = useExpensePreferences();
  const [activeTab, setActiveTab] = useState('view');
  const [viewMode, setViewMode] = useState(prefs.defaultView || 'list'); // 'list' | 'calendar'
  const [scope, setScope] = useState(prefs.defaultScope || 'month'); // 'week' | 'month'
  
  // Form dependencies
  const [dependencies, setDependencies] = useState({
    parties: [],
    products: [],
    categories: []
  });
  
  // New expense form data
  const [expenseForm, setExpenseForm] = useState({
    transaction_type: 'expense',
    description: '',
    total_amount: 0,
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: { type: '', details: {} },
    parties: [],
    items: [],
    tax_info: { tax_rate: 0, discount_rate: 0 },
    notes: '',
    expense_category: ''
  });
  
  // Expense list data
  const [expenses, setExpenses] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [dateRange, setDateRange] = useState(() => {
    if (prefs.lastDateRange) return prefs.lastDateRange;
    return {
      start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0]
    };
  });
  const [showFilters, setShowFilters] = useState(false);
  const [calendarTitle, setCalendarTitle] = useState('');
  const calendarNavRef = useRef(null);
  
  const [validationErrors, setValidationErrors] = useState({});

  // Memoized filters object for calendar to avoid object identity changes
  const calendarFilters = useMemo(() => ({
    searchTerm,
    selectedCategory,
    selectedPaymentMethod
  }), [searchTerm, selectedCategory, selectedPaymentMethod]);

  const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Toast helper functions
  const showSuccessToast = (message) => {
    toast({ 
      title: 'Success', 
      description: message, 
      variant: 'success', 
      duration: 3000 
    });
  };
  
  const showErrorToast = (message) => {
    toast({ 
      title: 'Error', 
      description: message, 
      variant: 'destructive', 
      duration: 5000 
    });
  };

  // API helper function
  const makeApiCall = useCallback(async (endpoint, options = {}) => {
    const authToken = localStorage.getItem('authToken');
    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    try {
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        ...defaultOptions,
        ...options
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      return responseData;
    } catch (error) {
      throw error;
    }
  }, [apiBaseUrl]);

  // Load initial data
  useEffect(() => {
    const initializeComponent = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          loadDependencies(),
          fetchExpenses()
        ]);
      } catch (error) {
        showErrorToast('Failed to load expense management data. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeComponent();
  }, []);

  // Persist view preferences on change
  useEffect(() => {
    setDefaultView(viewMode);
  }, [viewMode, setDefaultView]);

  useEffect(() => {
    setDefaultScope(scope);
  }, [scope, setDefaultScope]);

  useEffect(() => {
    setLastDateRange(dateRange);
  }, [dateRange, setLastDateRange]);

  // Hide AdminLayout's header with CSS
  useEffect(() => {
    // Find and hide the AdminLayout's RoleIndicator section
    const adminHeader = document.querySelector('main.flex-1 > div.p-6 > div.flex.items-center.justify-end.mb-6');
    if (adminHeader) {
      adminHeader.style.display = 'none';
    }
    
    return () => {
      if (adminHeader) {
        adminHeader.style.display = '';
      }
    };
  }, []);

  // Load dependencies
  const loadDependencies = async () => {
    try {
      const response = await makeApiCall('/api/admin/expenses/dependencies');
      const dependencyData = response.data || response;
      setDependencies(dependencyData);
    } catch (error) {
      console.error('Failed to load dependencies:', error);
    }
  };

  // Fetch expenses with filters
  const fetchExpenses = async (page = currentPage) => {
    try {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedPaymentMethod && { payment_method: selectedPaymentMethod }),
        ...(dateRange.start_date && { start_date: dateRange.start_date }),
        ...(dateRange.end_date && { end_date: dateRange.end_date })
      });

      const response = await makeApiCall(`/api/admin/expenses/history?${searchParams}`);
      const expenseData = response.data || response;
      
      setExpenses(expenseData.expenses || []);
      setTotalExpenses(expenseData.total || 0);
      setTotalPages(Math.ceil((expenseData.total || 0) / ITEMS_PER_PAGE));
      setCurrentPage(page);
    } catch (error) {
      showErrorToast('Failed to load expenses');
      console.error('Failed to fetch expenses:', error);
    }
  };

  // Refresh expenses when filters, scope or view change (list only)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (activeTab === 'view' && viewMode === 'list') {
        // If scope is week/month, compute current range accordingly
        if (scope === 'week') {
          const today = new Date();
          const day = today.getDay();
          const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
          const weekStart = new Date(today.setDate(diff));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          setDateRange({ start_date: weekStart.toISOString().split('T')[0], end_date: weekEnd.toISOString().split('T')[0] });
        } else if (scope === 'month') {
          const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          const end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
          setDateRange({ start_date: start.toISOString().split('T')[0], end_date: end.toISOString().split('T')[0] });
        }
        fetchExpenses(1);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedCategory, selectedPaymentMethod, dateRange, scope, activeTab, viewMode]);

  // Validate expense form
  const validateExpenseForm = useCallback(async (formData) => {
    try {
      const response = await makeApiCall('/api/admin/expenses/validate', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      
      const validationResult = response.data || response;
      setValidationErrors(validationResult.errors || {});
      return validationResult.isValid;
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  }, [makeApiCall]);

  // Debounced validation for form
  useEffect(() => {
    if (activeTab === 'add' && (expenseForm.description || expenseForm.total_amount > 0)) {
      const timeoutId = setTimeout(() => {
        validateExpenseForm(expenseForm);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [expenseForm, activeTab, validateExpenseForm]);

  // Update expense form data
  const updateExpenseForm = (updates) => {
    setExpenseForm(previousForm => {
      const updatedForm = { ...previousForm, ...updates };
      
      // Recalculate total amount if items or tax info changed
      if (updates.items || updates.tax_info) {
        updatedForm.total_amount = calculateTotalAmount(updatedForm.items, updatedForm.tax_info);
      }
      
      return updatedForm;
    });
  };

  // Calculate total amount from items and tax information
  const calculateTotalAmount = (items = [], taxInfo = {}) => {
    const itemsSubtotal = items.reduce((subtotal, item) => {
      const itemTotal = (item.quantity || 0) * (item.unit_price || 0);
      const discountAmount = itemTotal * ((item.discount_rate || 0) / 100);
      return subtotal + itemTotal - discountAmount;
    }, 0);

    const taxAmount = itemsSubtotal * ((taxInfo.tax_rate || 0) / 100);
    const globalDiscountAmount = itemsSubtotal * ((taxInfo.discount_rate || 0) / 100);
    
    return Math.max(0, itemsSubtotal + taxAmount - globalDiscountAmount);
  };

  // Submit new expense
  const handleSubmitExpense = async () => {
    setIsSubmitting(true);
    
    try {
      // Final validation
      const isFormValid = await validateExpenseForm(expenseForm);
      if (!isFormValid) {
        showErrorToast('Please fix validation errors before submitting.');
        return;
      }

      // Submit expense
      const submissionResult = await makeApiCall('/api/admin/expenses', {
        method: 'POST',
        body: JSON.stringify(expenseForm)
      });

      // Reset form
      resetExpenseForm();
      
      // Refresh expenses list
      await fetchExpenses(1);
      
      // Switch to view
      setActiveTab('view');

      showSuccessToast(`Expense created successfully! Reference: ${submissionResult.reference_number}`);

    } catch (error) {
      showErrorToast(error.message || 'Failed to create expense. Please try again.');
      console.error('Failed to submit expense:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset expense form
  const resetExpenseForm = () => {
    setExpenseForm({
      transaction_type: 'expense',
      description: '',
      total_amount: 0,
      transaction_date: new Date().toISOString().split('T')[0],
      payment_method: { type: '', details: {} },
      parties: [],
      items: [],
      tax_info: { tax_rate: 0, discount_rate: 0 },
      notes: '',
      expense_category: ''
    });
    setValidationErrors({});
  };

  // Export expenses
  const handleExportExpenses = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const searchParams = new URLSearchParams({
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedPaymentMethod && { payment_method: selectedPaymentMethod }),
        ...(dateRange.start_date && { start_date: dateRange.start_date }),
        ...(dateRange.end_date && { end_date: dateRange.end_date })
      });

      const response = await fetch(`${apiBaseUrl}/api/admin/expenses/export?${searchParams}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const fileBlob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(fileBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = `expenses-${dateRange.start_date}-${dateRange.end_date}.xlsx`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(downloadLink);
        showSuccessToast('Expense report exported successfully');
      }
    } catch (error) {
      showErrorToast('Failed to export expenses');
      console.error('Export failed:', error);
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedPaymentMethod('');
    setDateRange({
      start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0]
    });
    setCurrentPage(1);
  };

  // Utility functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodDisplay = (paymentMethod) => {
    if (!paymentMethod?.type) return 'Unknown';
    
    const paymentTypeNames = {
      cash: 'Cash',
      upi: 'UPI',
      cheque: 'Cheque',
      bank_transfer: 'Bank Transfer'
    };
    
    let displayText = paymentTypeNames[paymentMethod.type] || paymentMethod.type;
    
    if (paymentMethod.details) {
      if (paymentMethod.details.reference_number) {
        displayText += ` (${paymentMethod.details.reference_number})`;
      }
      if (paymentMethod.details.cheque_number) {
        displayText += ` (#${paymentMethod.details.cheque_number})`;
      }
    }
    
    return displayText;
  };

  const getCategoryColor = (category) => {
    const categoryColorMap = {
      'Vendor Order': 'bg-blue-100 text-blue-800',
      'Vendor Payment': 'bg-purple-100 text-purple-800',
      'Employee Payout': 'bg-green-100 text-green-800',
      'Store Utilities': 'bg-orange-100 text-orange-800',
      'Marketing': 'bg-pink-100 text-pink-800',
      'Transportation': 'bg-indigo-100 text-indigo-800',
      'Maintenance': 'bg-yellow-100 text-yellow-800',
      'Office Supplies': 'bg-gray-100 text-gray-800',
      'Miscellaneous': 'bg-red-100 text-red-800'
    };
    return categoryColorMap[category] || 'bg-gray-100 text-gray-800';
  };

  // Form validation helper
  const hasErrors = Object.keys(validationErrors).length > 0;
  
  // Check if payment method is required based on expense category
  const isVendorOrder = expenseForm.expense_category === 'Vendor Order';
  const paymentMethodRequired = !isVendorOrder; // Payment method is optional for vendor orders
  
  const isComplete = expenseForm.description && 
                    expenseForm.transaction_date &&
                    expenseForm.expense_category &&
                    // For vendor orders, total_amount comes from items; for others, it's required directly
                    (isVendorOrder ? 
                      (expenseForm.items && expenseForm.items.length > 0) : 
                      expenseForm.total_amount > 0) &&
                    // Payment method is optional for vendor orders
                    (paymentMethodRequired ? expenseForm.payment_method?.type : true);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex items-center space-x-3">
          <ArrowPathIcon className="w-6 h-6 animate-spin text-primary" />
          <span className="text-lg text-muted-foreground">Loading expense management...</span>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_EXPENSES}>
      <div className="flex flex-col -m-6 h-screen bg-gray-50">
        {/* Filters Modal */}
        {activeTab === 'view' && showFilters && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFilters(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-fadeIn" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white rounded-t-2xl">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                </h3>
                <button 
                  onClick={() => setShowFilters(false)} 
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Search */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Search</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search expenses..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Category</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {EXPENSE_CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date Range</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white mb-2"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
                
                {scope === 'custom' && (
                  <div className="space-y-2">
                    <input
                      type="date"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      value={dateRange.start_date}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
                    />
                    <input
                      type="date"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      value={dateRange.end_date}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200 space-y-2">
                <button
                  onClick={clearAllFilters}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-br from-red-500 to-red-600 rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  Clear All Filters
                </button>
                <button
                  onClick={handleExportExpenses}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Export to Excel
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                >
                  Close
                </button>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'view' ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Unified Header for List/Calendar Views */}
            <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
                  title="Toggle Filters"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </button>
                
                {viewMode === 'calendar' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => calendarNavRef.current?.prev && calendarNavRef.current.prev()}
                      className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div className="text-2xl font-bold text-white min-w-[200px] text-center">
                      {calendarTitle || 'Calendar'}
                    </div>
                    <button
                      onClick={() => calendarNavRef.current?.next && calendarNavRef.current.next()}
                      className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => calendarNavRef.current?.today && calendarNavRef.current.today()}
                      className="ml-2 px-3 py-1.5 text-sm font-semibold text-white/90 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
                    >
                      Today
                    </button>
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-white">
                    Expense List
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-1 flex items-center gap-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 flex items-center gap-1.5 ${
                      viewMode === 'list'
                        ? 'bg-white text-slate-700 shadow-md'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <ListBulletIcon className="w-4 h-4" />
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 flex items-center gap-1.5 ${
                      viewMode === 'calendar'
                        ? 'bg-white text-slate-700 shadow-md'
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <CalendarIcon className="w-4 h-4" />
                    Calendar
                  </button>
                </div>

                {/* Add Expense Button */}
                <button
                  onClick={() => setActiveTab('add')}
                  className="px-4 py-2 text-sm font-semibold bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg hover:scale-105"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Expense
                </button>

                {/* Role Indicator */}
                <div className="ml-2">
                  <RoleIndicator />
                </div>
              </div>
            </div>

            {/* View switch between List / Calendar */}
            {viewMode === 'list' ? (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Summary Bar - only for list view */}
                <div className="bg-white px-6 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center space-x-2">
                        <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-600">Total: <span className="font-semibold text-gray-900">{totalExpenses}</span></span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ListBulletIcon className="w-4 h-4 text-green-600" />
                        <span className="text-gray-600">Showing: <span className="font-semibold text-gray-900">{expenses.length}</span></span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-600">Page: <span className="font-semibold text-gray-900">{currentPage} of {totalPages}</span></span>
                      </div>
                    </div>
                    {/* Inline Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => fetchExpenses(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => fetchExpenses(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRightIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* List View */}
              <div className="flex-1 bg-white overflow-auto">
                {expenses.length === 0 ? (
                  <div className="p-6 text-center">
                    <DocumentTextIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No expenses found</h3>
                    <p className="text-xs text-gray-500">Try adjusting your search criteria</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {expenses.map((expense) => (
                      <div key={expense.id} className="px-4 py-2 hover:bg-gray-50 transition-colors" style={{minHeight: '40px'}}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0 flex items-center space-x-4">
                            {/* Description and Category */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <h3 className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                  {expense.description}
                                </h3>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getCategoryColor(expense.expense_category)}`}>
                                  {expense.expense_category}
                                </span>
                              </div>
                            </div>
                            
                            {/* Date */}
                            <div className="text-xs text-gray-500 min-w-0 flex items-center space-x-1">
                              <CalendarIcon className="w-3 h-3" />
                              <span>{formatDate(expense.transaction_date)}</span>
                            </div>
                            
                            {/* Payment Method */}
                            <div className="text-xs text-gray-500 min-w-0 flex items-center space-x-1">
                              <CurrencyDollarIcon className="w-3 h-3" />
                              <span className="truncate max-w-24">{getPaymentMethodDisplay(expense.payment_method)}</span>
                            </div>
                          </div>
                          
                          {/* Amount and Actions */}
                          <div className="flex items-center space-x-3 ml-4">
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">
                                {formatCurrency(expense.total_amount)}
                              </p>
                              {expense.reference_number && (
                                <p className="text-xs text-gray-500 truncate max-w-20">
                                  {expense.reference_number}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => setSelectedExpense(expense)}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              title="View Details"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            ) : (
              <div className="flex-1 bg-white overflow-auto">
                <ExpensesCalendar
                  scope={scope}
                  dateRange={dateRange}
                  onRangeChange={setDateRange}
                  filters={calendarFilters}
                  onSelectExpense={(expense) => setSelectedExpense(expense)}
                  onTitleChange={(title, nav) => {
                    setCalendarTitle(title);
                    if (nav) calendarNavRef.current = nav;
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          /* Add Expense Form */
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Header for Add Expense View */}
            <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-white">Add New Expense</h2>
              </div>

              <div className="flex items-center gap-2">
                {/* Back to View Button */}
                <button
                  onClick={() => setActiveTab('view')}
                  className="px-4 py-2 text-sm font-semibold bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to {viewMode === 'list' ? 'List' : 'Calendar'}
                </button>

                {/* Role Indicator */}
                <div className="ml-2">
                  <RoleIndicator />
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-auto bg-white p-6">
              <div className="w-full">
                <div className="mb-6">
                  <p className="text-sm text-gray-600">Fill in the details below to record a new expense</p>
                </div>
                
                <ExpenseForm
                  transactionData={expenseForm}
                  updateTransactionData={updateExpenseForm}
                  dependencies={dependencies}
                  validationErrors={validationErrors}
                />
                
                {/* Submit Button */}
                <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white py-4 -mx-6 px-6">
                  <button
                    onClick={() => setActiveTab('view')}
                    className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitExpense}
                    disabled={!isComplete || hasErrors || isSubmitting}
                    className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 ${
                      !isComplete || hasErrors || isSubmitting
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-br from-slate-700 to-slate-800 text-white hover:shadow-lg hover:scale-105'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-5 h-5" />
                        <span>Submit Expense</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Expense Detail Modal */}
        {selectedExpense && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Expense Details</h2>
                  <button
                    onClick={() => setSelectedExpense(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Reference Number</label>
                    <p className="text-base font-medium">{selectedExpense.reference_number || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Amount</label>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedExpense.total_amount)}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Description</label>
                  <p className="text-base">{selectedExpense.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Category</label>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${getCategoryColor(selectedExpense.expense_category)}`}>
                      {selectedExpense.expense_category}
                    </span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Date</label>
                    <p className="text-base">{formatDate(selectedExpense.transaction_date)}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Payment Method</label>
                  <p className="text-base">{getPaymentMethodDisplay(selectedExpense.payment_method)}</p>
                </div>
                {selectedExpense.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Notes</label>
                    <p className="text-base">{selectedExpense.notes}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Created</label>
                    <p>{formatDateTime(selectedExpense.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <p className="capitalize">{selectedExpense.status || 'completed'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment modal removed; vendor payment uses inline category flow */}

        <Toaster />
      </div>
    </PermissionGuard>
  );
};

export default ExpenseManagement;