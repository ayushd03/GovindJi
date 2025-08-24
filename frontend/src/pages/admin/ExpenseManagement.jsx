import React, { useState, useEffect, useCallback } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import {
  CurrencyDollarIcon,
  PlusIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CalendarIcon,
  TagIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/useToast';
import { Toaster } from '../../components/ui/toaster';

// Import sub-components
import ExpenseForm from './components/UnifiedExpenseForm';

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

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' }
];

const ITEMS_PER_PAGE = 10;

const ExpenseManagement = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('add'); // 'list' or 'add'
  
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
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });
  const [showFilters, setShowFilters] = useState(false);
  
  const [validationErrors, setValidationErrors] = useState({});

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

  // Refresh expenses when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchExpenses(1);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedCategory, selectedPaymentMethod, dateRange]);

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
      
      // Switch to list view
      setActiveTab('list');

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
  const isComplete = expenseForm.description && 
                    expenseForm.total_amount > 0 && 
                    expenseForm.payment_method?.type &&
                    expenseForm.transaction_date &&
                    expenseForm.expense_category;

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
      <div className="space-y-4">
        {/* Floating Header */}
        <div className="sticky top-0 z-40 bg-white rounded-lg shadow-sm border p-4 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-semibold text-gray-900">Expense Management</h1>
              <div className="flex items-center space-x-2">
                <Button
                  variant={activeTab === 'add' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('add')}
                  className="flex items-center space-x-1"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Add</span>
                </Button>
                <Button
                  variant={activeTab === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('list')}
                  className="flex items-center space-x-1"
                >
                  <ListBulletIcon className="w-4 h-4" />
                  <span>View</span>
                </Button>
              </div>
            </div>
            
            {/* Header Actions - Conditional based on active tab */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              {activeTab === 'list' && (
                <>
                  {/* Search */}
                  <div className="relative flex-1 sm:max-w-xs">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search expenses..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Filters */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center space-x-1"
                    >
                      <FunnelIcon className="w-4 h-4" />
                      <span>Filters</span>
                    </Button>
                    
                    {/* Export */}
                    <Button
                      onClick={handleExportExpenses}
                      size="sm"
                      variant="outline"
                      className="flex items-center space-x-1"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      <span>Export</span>
                    </Button>
                  </div>
                </>
              )}
              
              {activeTab === 'add' && (
                <div className="flex items-center space-x-2">
                  {/* Submit Expense (shown when in add mode) */}
                  <Button
                    onClick={handleSubmitExpense}
                    disabled={!isComplete || hasErrors || isSubmitting}
                    className="flex items-center space-x-1"
                    size="sm"
                  >
                    {isSubmitting ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        <span>Submitting</span>
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>Submit</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Expandable Filters - Only show when in list view */}
          {showFilters && activeTab === 'list' && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {EXPENSE_CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                >
                  <option value="">All Methods</option>
                  {PAYMENT_METHODS.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={dateRange.start_date}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="w-full text-sm"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Content based on active tab */}
        {activeTab === 'list' ? (
          <div className="space-y-4">

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Total Expenses</p>
                    <p className="text-lg font-semibold text-gray-900">{totalExpenses}</p>
                  </div>
                  <DocumentTextIcon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Current Page</p>
                    <p className="text-lg font-semibold text-gray-900">{expenses.length} items</p>
                  </div>
                  <ListBulletIcon className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Page</p>
                    <p className="text-lg font-semibold text-gray-900">{currentPage} of {totalPages}</p>
                  </div>
                  <DocumentTextIcon className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Expenses List */}
            <div className="bg-white rounded-lg shadow-sm border">
              {expenses.length === 0 ? (
                <div className="p-8 text-center">
                  <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No expenses found</h3>
                  <p className="text-sm text-gray-500">Try adjusting your search criteria</p>
                </div>
              ) : (
                <div className="divide-y">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {expense.description}
                            </h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(expense.expense_category)}`}>
                              {expense.expense_category}
                            </span>
                            {expense.reference_number && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {expense.reference_number}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <div className="flex items-center space-x-1">
                              <CalendarIcon className="w-3 h-3" />
                              <span>{formatDate(expense.transaction_date)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <CurrencyDollarIcon className="w-3 h-3" />
                              <span>{getPaymentMethodDisplay(expense.payment_method)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(expense.total_amount)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(expense.created_at)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedExpense(expense)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalExpenses)} of {totalExpenses} expenses
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchExpenses(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-gray-700">
                      {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchExpenses(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Add Expense Form */
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <ExpenseForm
              transactionData={expenseForm}
              updateTransactionData={updateExpenseForm}
              dependencies={dependencies}
              validationErrors={validationErrors}
            />
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

        <Toaster />
      </div>
    </PermissionGuard>
  );
};

export default ExpenseManagement;