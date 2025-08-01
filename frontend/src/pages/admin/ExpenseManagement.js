import React, { useState, useEffect } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import {
  CurrencyDollarIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  ChartPieIcon,
  DocumentArrowDownIcon,
  XMarkIcon,
  BanknotesIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AdjustmentsHorizontalIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, Area, AreaChart, ComposedChart
} from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/use-toast';
import { Toaster } from '../../components/ui/toaster';

const EXPENSE_CATEGORIES = [
  'Vendor Payment',
  'Employee Payout',
  'Store Utilities',
  'Marketing',
  'Maintenance',
  'Miscellaneous'
];

const PAYMENT_MODES = [
  'Cash',
  'UPI',
  'Bank Transfer',
  'Cheque',
  'Credit'
];

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#84cc16', '#f97316', '#ec4899'];

const CHART_COLORS = {
  primary: '#8b5cf6',
  secondary: '#06b6d4', 
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#84cc16'
};

const ExpenseManagement = () => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);
  
  // Dashboard drill-down states
  const [selectedCategoryDrill, setSelectedCategoryDrill] = useState(null);
  const [drillDownData, setDrillDownData] = useState(null);
  const [chartView, setChartView] = useState('overview'); // overview, category, trend
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: '',
    vendor_id: '',
    employee_id: '',
    payment_mode: '',
    expense_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Show success toast notification
  const showSuccess = (message) => {
    toast({
      title: "Success",
      description: message,
      variant: "success",
      duration: 3000,
    });
  };

  // Show error toast notification
  const showError = (message) => {
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
      duration: 5000,
    });
  };

  // Show warning toast notification
  const showWarning = (message) => {
    toast({
      title: "Warning",
      description: message,
      variant: "warning",
      duration: 4000,
    });
  };

  useEffect(() => {
    fetchExpenses(1);
    fetchVendors();
    fetchEmployees();
    fetchAnalytics();
  }, []);

  const fetchExpenses = async (page = 1, limit = itemsPerPage) => {
    try {
      const token = localStorage.getItem('authToken');
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedVendor && { vendor_id: selectedVendor }),
        ...(selectedEmployee && { employee_id: selectedEmployee }),
        ...(selectedPaymentMode && { paymentMode: selectedPaymentMode }),
        ...(dateRange.start && { startDate: dateRange.start }),
        ...(dateRange.end && { endDate: dateRange.end }),
      });

      const response = await fetch(`${API_BASE_URL}/api/admin/expenses?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch expenses');
      }

      const data = await response.json();
      setExpenses(data.expenses || data);
      setTotalExpenses(data.total || data.length || 0);
      setTotalPages(data.totalPages || Math.ceil((data.total || 0) / limit));
      setTotalAmount(data.totalAmount || 0);
    } catch (err) {
      setError(err.message);
      showError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/vendors`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVendors(data);
      }
    } catch (err) {
      // Silently handle vendor fetch errors
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/employees`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (err) {
      // Silently handle employee fetch errors
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/expenses/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (err) {
      // Silently handle analytics fetch errors
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('authToken');
      const url = editingExpense 
        ? `${API_BASE_URL}/api/admin/expenses/${editingExpense.id}`
        : `${API_BASE_URL}/api/admin/expenses`;
      
      const method = editingExpense ? 'PUT' : 'POST';
      
      const submitData = {
        ...formData,
        amount: parseFloat(formData.amount),
        vendor_id: formData.vendor_id || null,
        employee_id: formData.employee_id || null
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        throw new Error(`Failed to ${editingExpense ? 'update' : 'create'} expense`);
      }

      await fetchExpenses(currentPage);
      await fetchAnalytics();
      handleCloseModal();
      showSuccess(editingExpense ? 'Expense updated successfully' : 'Expense added successfully');
    } catch (err) {
      setError(err.message);
      showError(editingExpense ? 'Failed to update expense' : 'Failed to add expense');
    }
  };

  const handleDelete = async (expenseId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete expense');
      }

      await fetchExpenses(currentPage);
      await fetchAnalytics();
      setDeleteConfirm(null);
      showSuccess('Expense deleted successfully');
    } catch (err) {
      setError(err.message);
      showError('Failed to delete expense');
    }
  };

  const handleOpenModal = (expense = null) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        amount: expense.amount || '',
        description: expense.description || '',
        category: expense.category || '',
        vendor_id: expense.vendor_id || '',
        employee_id: expense.employee_id || '',
        payment_mode: expense.payment_mode || '',
        expense_date: expense.expense_date || new Date().toISOString().split('T')[0],
        notes: expense.notes || ''
      });
    } else {
      setEditingExpense(null);
      setFormData({
        amount: '',
        description: '',
        category: '',
        vendor_id: '',
        employee_id: '',
        payment_mode: '',
        expense_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setFormData({
      amount: '',
      description: '',
      category: '',
      vendor_id: '',
      employee_id: '',
      payment_mode: '',
      expense_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  const handleCategoryChange = (category) => {
    setFormData(prev => ({
      ...prev,
      category,
      vendor_id: category === 'Vendor Payment' ? prev.vendor_id : '',
      employee_id: category === 'Employee Payout' ? prev.employee_id : ''
    }));
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Amount', 'Description', 'Category', 'Payment Mode', 'Vendor/Employee', 'Notes'];
    const csvData = [
      headers.join(','),
      ...expenses.map(expense => [
        expense.expense_date,
        expense.amount,
        `"${expense.description.replace(/"/g, '""')}"`,
        expense.category,
        expense.payment_mode,
        expense.vendor_name || expense.employee_name || '',
        `"${(expense.notes || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    showSuccess('Expenses exported successfully');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getPaymentModeIcon = (mode) => {
    switch (mode) {
      case 'Cash': return BanknotesIcon;
      case 'UPI': return DevicePhoneMobileIcon;
      case 'Bank Transfer': return CreditCardIcon;
      case 'Cheque': return DocumentArrowDownIcon;
      case 'Credit': return CreditCardIcon;
      default: return CurrencyDollarIcon;
    }
  };

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1);
    fetchExpenses(1);
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        fetchExpenses(1);
      } else {
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedCategory, selectedVendor, selectedEmployee, selectedPaymentMode, dateRange]);

  // Pagination calculations
  const calculatedTotalPages = totalPages > 0 ? totalPages : Math.ceil(totalExpenses / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalExpenses);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= calculatedTotalPages) {
      setCurrentPage(page);
      fetchExpenses(page);
    }
  };

  const getPaginationPages = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(calculatedTotalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  // Enhanced chart interactions - navigate to expenses tab with category filter
  const handleCategoryClick = async (data) => {
    if (!data || !data.name) return;
    
    // Clear other filters to show only this category
    setSelectedVendor('');
    setSelectedEmployee('');
    setSelectedPaymentMode('');
    setDateRange({ start: '', end: '' });
    setSearchTerm('');
    
    // Set the category filter and switch to expenses tab
    setSelectedCategory(data.name);
    setActiveTab('expenses');
    
    // Reset pagination to first page
    setCurrentPage(1);
    
    // Fetch filtered expenses immediately
    try {
      const token = localStorage.getItem('authToken');
      const queryParams = new URLSearchParams({
        page: '1',
        limit: itemsPerPage.toString(),
        category: data.name
      });

      const response = await fetch(`${API_BASE_URL}/api/admin/expenses?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const responseData = await response.json();
        setExpenses(responseData.expenses || responseData);
        setTotalExpenses(responseData.total || responseData.length || 0);
        setTotalPages(responseData.totalPages || Math.ceil((responseData.total || 0) / itemsPerPage));
        setTotalAmount(responseData.totalAmount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch filtered expenses:', err);
    }
    
    // Show success message
    showSuccess(`Viewing all ${data.name} expenses`);
  };

  const handleChartReset = () => {
    setSelectedCategoryDrill(null);
    setDrillDownData(null);
    setChartView('overview');
  };

  // Calculate trend indicators
  const calculateTrendIndicator = (current, previous) => {
    if (!previous || previous === 0) return { change: 0, percentage: 0, trend: 'neutral' };
    
    const change = current - previous;
    const percentage = (change / previous) * 100;
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    
    return { change, percentage: Math.abs(percentage), trend };
  };

  // Minimal Mixpanel-style tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div 
          className="bg-white px-3 py-2 border border-gray-200 rounded-md shadow-md cursor-pointer hover:shadow-lg transition-shadow group min-w-max"
          onClick={() => handleCategoryClick(data)}
        >
          <div className="text-xs font-medium text-gray-600 mb-1">
            {data.name}
          </div>
          <div className="text-sm font-semibold text-gray-900 mb-2">
            {formatCurrency(data.amount)}
          </div>
          <button className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
            View expenses
          </button>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-lg text-gray-600">Loading expenses...</span>
      </div>
    );
  }

  const CategoryQuickButtons = () => (
    <div className="grid grid-cols-2 gap-2 mb-3">
      {EXPENSE_CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => setFormData(prev => ({ ...prev, category }))}
          className={`p-2 rounded-lg border text-xs font-medium transition-all min-h-[36px] touch-manipulation ${
            formData.category === category
              ? 'border-purple-500 bg-purple-50 text-purple-700'
              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );

  const PaymentModeButtons = () => (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
      {PAYMENT_MODES.map((mode) => {
        const IconComponent = getPaymentModeIcon(mode);
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, payment_mode: mode }))}
            className={`p-2 rounded-lg border text-xs font-medium transition-all flex flex-col items-center space-y-1 min-h-[44px] touch-manipulation ${
              formData.payment_mode === mode
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
            }`}
          >
            <IconComponent className="w-4 h-4" />
            <span className="leading-tight">{mode}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_EXPENSES}>
      <div className="space-y-6 max-w-full overflow-hidden">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-8">
                <nav className="flex space-x-4 sm:space-x-8 pb-4 sm:pb-0" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`py-2 sm:py-4 px-1 border-b-2 font-medium text-sm min-h-[44px] flex items-center touch-manipulation ${
                      activeTab === 'dashboard'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <ChartPieIcon className="w-5 h-5 mr-2" />
                    <span className="hidden sm:inline">Overview</span>
                    <span className="sm:hidden">Charts</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('expenses')}
                    className={`py-2 sm:py-4 px-1 border-b-2 font-medium text-sm min-h-[44px] flex items-center touch-manipulation ${
                      activeTab === 'expenses'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <CurrencyDollarIcon className="w-5 h-5 mr-2" />
                    <span className="hidden sm:inline">All Expenses</span>
                    <span className="sm:hidden">Expenses</span>
                  </button>
                </nav>
              </div>
              <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_EXPENSES}>
                <div className="pb-4 sm:pb-0">
                  <Button
                    onClick={() => handleOpenModal()}
                    className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-sm font-medium min-h-[44px] touch-manipulation"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Expense
                  </Button>
                </div>
              </PermissionGuard>
            </div>
          </div>

          {/* Enhanced Dashboard Tab */}
          {activeTab === 'dashboard' && analytics && (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

              {/* Enhanced Key Metrics with Trends */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Today's Expenses</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(analytics.todayTotal || 0)}</p>
                      {analytics.yesterdayTotal !== undefined && (
                        <div className="flex items-center mt-1">
                          {(() => {
                            const trend = calculateTrendIndicator(analytics.todayTotal || 0, analytics.yesterdayTotal || 0);
                            return (
                              <span className={`text-xs font-medium flex items-center ${
                                trend.trend === 'up' ? 'text-red-600' : 
                                trend.trend === 'down' ? 'text-green-600' : 'text-gray-500'
                              }`}>
                                {trend.trend === 'up' ? '↗' : trend.trend === 'down' ? '↘' : '→'} 
                                {trend.percentage.toFixed(1)}% vs yesterday
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <ClockIcon className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">This Week</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(analytics.weekTotal || 0)}</p>
                      {analytics.lastWeekTotal !== undefined && (
                        <div className="flex items-center mt-1">
                          {(() => {
                            const trend = calculateTrendIndicator(analytics.weekTotal || 0, analytics.lastWeekTotal || 0);
                            return (
                              <span className={`text-xs font-medium flex items-center ${
                                trend.trend === 'up' ? 'text-red-600' : 
                                trend.trend === 'down' ? 'text-green-600' : 'text-gray-500'
                              }`}>
                                {trend.trend === 'up' ? '↗' : trend.trend === 'down' ? '↘' : '→'} 
                                {trend.percentage.toFixed(1)}% vs last week
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CalendarIcon className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">This Month</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(analytics.monthTotal || 0)}</p>
                      {analytics.lastMonthTotal !== undefined && (
                        <div className="flex items-center mt-1">
                          {(() => {
                            const trend = calculateTrendIndicator(analytics.monthTotal || 0, analytics.lastMonthTotal || 0);
                            return (
                              <span className={`text-xs font-medium flex items-center ${
                                trend.trend === 'up' ? 'text-red-600' : 
                                trend.trend === 'down' ? 'text-green-600' : 'text-gray-500'
                              }`}>
                                {trend.trend === 'up' ? '↗' : trend.trend === 'down' ? '↘' : '→'} 
                                {trend.percentage.toFixed(1)}% vs last month
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <ChartPieIcon className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Avg Daily</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">
                        {formatCurrency((analytics.monthTotal || 0) / new Date().getDate())}
                      </p>
                      <div className="flex items-center mt-1">
                        <span className="text-xs font-medium text-gray-500">
                          Based on {new Date().getDate()} days
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <BanknotesIcon className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Enhanced Interactive Category Breakdown */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Expenses by Category</h3>
                  </div>
                  
                  {analytics.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={analytics.categoryBreakdown}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={false}
                            outerRadius={90}
                            fill="#8884d8"
                            dataKey="amount"
                            onClick={handleCategoryClick}
                            className="cursor-pointer"
                          >
                            {analytics.categoryBreakdown.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={COLORS[index % COLORS.length]}
                                className="hover:opacity-80 transition-opacity"
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      
                      {/* Interactive Category Legend */}
                      <div className="mt-4 grid grid-cols-1 gap-2">
                        {analytics.categoryBreakdown.map((entry, index) => (
                          <div 
                            key={entry.name}
                            className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all hover:bg-purple-50 hover:border-purple-200 border border-transparent group"
                            onClick={() => handleCategoryClick(entry)}
                            title={`Click to view all ${entry.name} expenses`}
                          >
                            <div className="flex items-center space-x-3">
                              <div 
                                className="w-4 h-4 rounded-full shadow-sm"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700 transition-colors">
                                {entry.name}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-semibold text-gray-900">
                                {formatCurrency(entry.amount)}
                              </span>
                              <svg 
                                className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors opacity-0 group-hover:opacity-100" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      <div className="text-center">
                        <ChartPieIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p>No expense data available for this month</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enhanced Daily Trend Chart */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Daily Expense Trend</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setChartView(chartView === 'trend' ? 'overview' : 'trend')}
                        className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                      >
                        {chartView === 'trend' ? '7 Days' : '30 Days'}
                      </button>
                    </div>
                  </div>
                  
                  {analytics.dailyTrend && analytics.dailyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={analytics.dailyTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#6b7280"
                          fontSize={12}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis 
                          stroke="#6b7280"
                          fontSize={12}
                          tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="amount"
                          fill={CHART_COLORS.primary}
                          fillOpacity={0.1}
                          stroke="none"
                        />
                        <Bar
                          dataKey="amount"
                          fill={CHART_COLORS.primary}
                          radius={[4, 4, 0, 0]}
                          opacity={0.8}
                        />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke={CHART_COLORS.secondary}
                          strokeWidth={2}
                          dot={{ fill: CHART_COLORS.secondary, strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, fill: CHART_COLORS.secondary }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      <div className="text-center">
                        <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p>No daily trend data available</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Recent Transactions with Quick Actions */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Recent Transactions</h3>
                  <button
                    onClick={() => setActiveTab('expenses')}
                    className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                  >
                    View All →
                  </button>
                </div>
                
                <div className="space-y-3">
                  {expenses.slice(0, 5).map((expense) => {
                    const PaymentIcon = getPaymentModeIcon(expense.payment_mode);
                    return (
                      <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <PaymentIcon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 truncate">{expense.description}</p>
                            <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                {expense.category}
                              </span>
                              <span>•</span>
                              <span>{formatDate(expense.expense_date)}</span>
                              <span>•</span>
                              <span>{expense.payment_mode}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{formatCurrency(expense.amount)}</p>
                          {(expense.vendor_name || expense.employee_name) && (
                            <p className="text-sm text-gray-500 truncate max-w-24">
                              {expense.vendor_name || expense.employee_name}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {expenses.length === 0 && (
                  <div className="text-center py-8">
                    <CurrencyDollarIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No recent transactions</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All Expenses Tab */}
          {activeTab === 'expenses' && (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Filters */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filters</h3>
                  <button
                    onClick={exportToCSV}
                    className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 min-h-[44px] touch-manipulation"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                    Export CSV
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
                  <div className="relative lg:col-span-1 w-full">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search expenses..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[44px] touch-manipulation max-w-full"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[44px] touch-manipulation max-w-full"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      // Clear vendor/employee selection when category changes
                      setSelectedVendor('');
                      setSelectedEmployee('');
                    }}
                  >
                    <option value="">All Categories</option>
                    {EXPENSE_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  
                  {/* Conditional Vendor/Employee Dropdown */}
                  {selectedCategory === 'Vendor Payment' && vendors.length > 0 && (
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[44px] touch-manipulation max-w-full"
                      value={selectedVendor}
                      onChange={(e) => setSelectedVendor(e.target.value)}
                    >
                      <option value="">All Vendors</option>
                      {vendors.map(vendor => (
                        <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                      ))}
                    </select>
                  )}
                  
                  {selectedCategory === 'Employee Payout' && employees.length > 0 && (
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[44px] touch-manipulation max-w-full"
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                    >
                      <option value="">All Employees</option>
                      {employees.map(employee => (
                        <option key={employee.id} value={employee.id}>{employee.name}</option>
                      ))}
                    </select>
                  )}
                  
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[44px] touch-manipulation"
                    value={selectedPaymentMode}
                    onChange={(e) => setSelectedPaymentMode(e.target.value)}
                  >
                    <option value="">All Payment Modes</option>
                    {PAYMENT_MODES.map(mode => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                  
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[44px] touch-manipulation"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    placeholder="From Date"
                  />
                  
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[44px] touch-manipulation"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    placeholder="To Date"
                  />
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {/* Expenses List */}
              <div className="bg-white border border-gray-200 rounded-xl">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Expenses {totalAmount > 0 && `(${formatCurrency(totalAmount)})`}
                      </h3>
                    </div>
                    <div className="text-sm text-gray-500">
                      {totalExpenses} {totalExpenses === 1 ? 'expense' : 'expenses'}
                    </div>
                  </div>
                </div>
                
                {expenses.length === 0 ? (
                  <div className="p-12 text-center">
                    <CurrencyDollarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses found</h3>
                    <p className="text-gray-500">
                      {searchTerm || selectedCategory || selectedVendor || selectedEmployee || selectedPaymentMode || dateRange.start || dateRange.end
                        ? "Try adjusting your search criteria" 
                        : "Get started by adding your first expense"}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="divide-y divide-gray-200">
                      {expenses.map((expense) => {
                        const PaymentIcon = getPaymentModeIcon(expense.payment_mode);
                        return (
                          <div key={expense.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex-1 mb-4 sm:mb-0">
                                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
                                  <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                                    <PaymentIcon className="w-5 h-5 text-gray-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">{expense.description}</h3>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                        {expense.category}
                                      </span>
                                      <span className="whitespace-nowrap">{formatDate(expense.expense_date)}</span>
                                      <span className="whitespace-nowrap">{expense.payment_mode}</span>
                                      {(expense.vendor_name || expense.employee_name) && (
                                        <span className="truncate">• {expense.vendor_name || expense.employee_name}</span>
                                      )}
                                    </div>
                                    {/* Mobile Amount Display */}
                                    <div className="mt-2 sm:hidden">
                                      <p className="text-xl font-bold text-gray-900">{formatCurrency(expense.amount)}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between sm:justify-end sm:space-x-4">
                                {/* Desktop Amount Display */}
                                <div className="hidden sm:block text-right">
                                  <p className="text-xl font-bold text-gray-900">{formatCurrency(expense.amount)}</p>
                                </div>
                                
                                <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_EXPENSES}>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => handleOpenModal(expense)}
                                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] touch-manipulation"
                                    >
                                      <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(expense)}
                                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] touch-manipulation"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                </PermissionGuard>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Pagination */}
                    {calculatedTotalPages > 1 && (
                      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="text-sm text-gray-700">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalExpenses)} of {totalExpenses} results
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handlePageChange(currentPage - 1)}
                              disabled={currentPage === 1}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] touch-manipulation"
                            >
                              <ChevronLeftIcon className="w-4 h-4 mr-1" />
                              Previous
                            </button>
                            
                            <div className="flex items-center space-x-1">
                              {getPaginationPages().map((page) => (
                                <button
                                  key={page}
                                  onClick={() => handlePageChange(page)}
                                  className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-lg min-h-[40px] min-w-[40px] touch-manipulation ${
                                    currentPage === page
                                      ? 'border-purple-500 bg-purple-50 text-purple-600'
                                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              ))}
                            </div>
                            
                            <button
                              onClick={() => handlePageChange(currentPage + 1)}
                              disabled={currentPage === calculatedTotalPages}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] touch-manipulation"
                            >
                              Next
                              <ChevronRightIcon className="w-4 h-4 ml-1" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-2 sm:p-4 z-50 pt-4 sm:pt-8">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm sm:max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="sticky top-0 bg-white p-3 sm:p-4 border-b border-gray-200 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    {editingExpense ? 'Edit Expense' : 'Add Expense'}
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 min-h-[40px] touch-manipulation"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="expense-form"
                      className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 min-h-[40px] touch-manipulation"
                    >
                      {editingExpense ? 'Update' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
              
              <form id="expense-form" onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                {/* Amount & Description Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="w-full px-3 py-2 text-lg border-2 border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[44px] touch-manipulation"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[44px] touch-manipulation"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="What was this expense for?"
                    />
                  </div>
                </div>


                {/* Smart Categories */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <CategoryQuickButtons />
                </div>

                {/* Context-Aware Linking - Only show when relevant */}
                {formData.category === 'Vendor Payment' && vendors.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[40px] touch-manipulation text-sm"
                      value={formData.vendor_id}
                      onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
                    >
                      <option value="">Select Vendor</option>
                      {vendors.map(vendor => (
                        <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.category === 'Employee Payout' && employees.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[40px] touch-manipulation text-sm"
                      value={formData.employee_id}
                      onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                    >
                      <option value="">Select Employee (Optional)</option>
                      {employees.map(employee => (
                        <option key={employee.id} value={employee.id}>{employee.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Payment Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Mode *
                  </label>
                  <PaymentModeButtons />
                </div>

                {/* Date & Notes Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[40px] touch-manipulation"
                      value={formData.expense_date}
                      onChange={(e) => setFormData({...formData, expense_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 min-h-[40px] touch-manipulation"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      placeholder="Quick notes..."
                    />
                  </div>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <TrashIcon className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                Delete Expense
              </h3>
              <p className="text-gray-500 text-center mb-6">
                Are you sure you want to delete this expense of {formatCurrency(deleteConfirm.amount)}? This action cannot be undone.
              </p>
              <div className="flex flex-col sm:flex-row sm:justify-center gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="w-full sm:w-auto px-4 py-3 sm:py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px] touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm.id)}
                  className="w-full sm:w-auto px-4 py-3 sm:py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 min-h-[44px] touch-manipulation"
                >
                  Delete
                </button>
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