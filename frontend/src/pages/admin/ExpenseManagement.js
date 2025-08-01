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
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Line, Area
} from 'recharts';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/use-toast';
import { Toaster } from '../../components/ui/toaster';

const EXPENSE_CATEGORIES = ['Vendor Payment', 'Employee Payout', 'Store Utilities', 'Marketing', 'Maintenance', 'Miscellaneous'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Credit'];

// New color palette for charts
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--secondary))',
  'hsl(260 80% 60%)',
  'hsl(180 80% 60%)',
];

const ExpenseManagement = () => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
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

  const showSuccess = (message) => toast({ title: "Success", description: message, variant: "success", duration: 3000 });
  const showError = (message) => toast({ title: "Error", description: message, variant: "destructive", duration: 5000 });

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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to fetch expenses');

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

  const fetchSelectOptions = async (endpoint, setter) => {
    try {
      const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/admin/${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
      if (response.ok) {
        const data = await response.json();
            setter(data.vendors || data.employees || data);
      }
    } catch (err) {
        // Silently fail
    }
  }

  const fetchVendors = () => fetchSelectOptions('vendors', setVendors);
  const fetchEmployees = () => fetchSelectOptions('employees', setEmployees);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/expenses/analytics`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (response.ok) setAnalytics(await response.json());
    } catch (err) {
      // Silently fail
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const url = editingExpense ? `${API_BASE_URL}/api/admin/expenses/${editingExpense.id}` : `${API_BASE_URL}/api/admin/expenses`;
      const method = editingExpense ? 'PUT' : 'POST';
      const submitData = {
        ...formData,
        amount: parseFloat(formData.amount),
        vendor_id: formData.vendor_id || null,
        employee_id: formData.employee_id || null
      };
      const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      if (!response.ok) throw new Error(`Failed to ${editingExpense ? 'update' : 'create'} expense`);
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
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete expense');
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
        expense_date: expense.expense_date ? new Date(expense.expense_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: expense.notes || ''
      });
    } else {
      setEditingExpense(null);
      setFormData({
        amount: '', description: '', category: '', vendor_id: '', employee_id: '', payment_mode: '',
        expense_date: new Date().toISOString().split('T')[0], notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setFormData({
        amount: '', description: '', category: '', vendor_id: '', employee_id: '', payment_mode: '',
        expense_date: new Date().toISOString().split('T')[0], notes: ''
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) fetchExpenses(1);
      else setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedCategory, selectedVendor, selectedEmployee, selectedPaymentMode, dateRange]);

  const calculatedTotalPages = totalPages > 0 ? totalPages : Math.ceil(totalExpenses / itemsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= calculatedTotalPages) {
      setCurrentPage(page);
      fetchExpenses(page);
    }
  };
  
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-IN');
  const getPaymentModeIcon = (mode) => {
    switch(mode) {
        case 'Cash': return BanknotesIcon;
        case 'UPI': return DevicePhoneMobileIcon;
        case 'Bank Transfer': return CreditCardIcon;
        case 'Cheque': return DocumentArrowDownIcon;
        case 'Credit': return CreditCardIcon;
        default: return CurrencyDollarIcon;
    }
  }

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

  const handleCategoryClick = async (data) => {
    if (!data || !data.name) return;
    setSelectedCategory(data.name);
    setActiveTab('expenses');
    setCurrentPage(1);
    showSuccess(`Viewing all ${data.name} expenses`);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <span className="ml-3 text-lg text-muted-foreground">Loading expenses...</span>
    </div>
  );

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card px-3 py-2 border rounded-md shadow-md cursor-pointer hover:shadow-lg transition-shadow group min-w-max" onClick={() => handleCategoryClick(data)}>
          <div className="text-xs font-medium text-muted-foreground mb-1">{data.name}</div>
          <div className="text-sm font-semibold text-foreground mb-2">{formatCurrency(data.amount)}</div>
          <button className="text-xs text-primary hover:underline font-medium transition-colors">View expenses</button>
        </div>
      );
    }
    return null;
  };

  const renderPagination = () => {
    if (calculatedTotalPages <= 1) return null;
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(calculatedTotalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    return (
        <div className="px-4 py-4 sm:px-6 border-t bg-muted/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalExpenses)} of {totalExpenses} results
      </div>
                <div className="flex items-center space-x-1 sm:space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeftIcon className="w-4 h-4" /></Button>
                    {pages.map(page => <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => handlePageChange(page)}>{page}</Button>)}
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === calculatedTotalPages}><ChevronRightIcon className="w-4 h-4" /></Button>
    </div>
    </div>
        </div>
    )
  }

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_EXPENSES}>
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6">
                <div className="flex-1">
                    <CardTitle>Expense Management</CardTitle>
                    <p className="text-muted-foreground text-sm mt-1">Track, analyze, and manage all business expenses.</p>
              </div>
              <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_EXPENSES}>
                    <div className="mt-4 sm:mt-0">
                    <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto btn-primary">
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Expense
                  </Button>
                </div>
              </PermissionGuard>
            </div>
            <div className="border-b mt-4">
              <div className="flex space-x-2 sm:space-x-8 px-4 sm:px-6">
                <button onClick={() => setActiveTab('dashboard')} className={`py-2 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-sm flex items-center ${activeTab === 'dashboard' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}>
                  <ChartPieIcon className="w-5 h-5 mr-2" /> Overview
                </button>
                <button onClick={() => setActiveTab('expenses')} className={`py-2 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-sm flex items-center ${activeTab === 'expenses' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}>
                  <CurrencyDollarIcon className="w-5 h-5 mr-2" /> All Expenses
                </button>
          </div>
            </div>
          </CardHeader>

          {activeTab === 'dashboard' && analytics && (
            <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Today's Expenses</CardTitle><ClockIcon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(analytics.todayTotal || 0)}</div></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">This Week</CardTitle><CalendarIcon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(analytics.weekTotal || 0)}</div></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">This Month</CardTitle><ChartPieIcon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(analytics.monthTotal || 0)}</div></CardContent></Card>
                        </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <Card>
                        <CardHeader><CardTitle>Expenses by Category</CardTitle></CardHeader>
                        <CardContent>
                            {analytics.categoryBreakdown?.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <PieChart>
                                            <Pie data={analytics.categoryBreakdown} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="amount" onClick={handleCategoryClick} className="cursor-pointer">
                                                {analytics.categoryBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} className="hover:opacity-80 transition-opacity" />)}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="mt-6">
                                        <div className="mb-3">
                                            <h4 className="text-sm font-medium text-muted-foreground">Category Breakdown</h4>
                                        </div>
                                        <div className="bg-card border rounded-lg overflow-hidden">
                                            <div className="divide-y divide-border">
                                                {analytics.categoryBreakdown.map((category, index) => (
                                                    <div key={category.name} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group" onClick={() => handleCategoryClick(category)}>
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></div>
                                                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{category.name}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-semibold text-foreground">{formatCurrency(category.amount)}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {((category.amount / analytics.categoryBreakdown.reduce((sum, cat) => sum + cat.amount, 0)) * 100).toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mt-2 text-xs text-muted-foreground text-center">
                                            Click on any category to view detailed expenses
                                        </div>
                                    </div>
                                </>
                            ) : <div className="h-60 flex items-center justify-center text-muted-foreground">No data</div>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Daily Expense Trend</CardTitle></CardHeader>
                        <CardContent>
                            {analytics.dailyTrend?.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <ComposedChart data={analytics.dailyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={value => `₹${(value / 1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="amount" fill="hsl(var(--primary) / 0.1)" stroke="none" />
                                        <Bar dataKey="amount" fill="hsl(var(--primary) / 0.8)" radius={[4, 4, 0, 0]} />
                                        <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                      </ComposedChart>
                      </ResponsiveContainer>
                            ) : <div className="h-60 flex items-center justify-center text-muted-foreground">No data</div>}
                        </CardContent>
                    </Card>
                    </div>
            </CardContent>
          )}

          {activeTab === 'expenses' && (
            <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
                <Card className="bg-muted/50">
                    <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                            <CardTitle>Filters</CardTitle>
                            <Button variant="outline" size="sm" onClick={exportToCSV}><DocumentArrowDownIcon className="w-4 h-4 mr-2" />Export CSV</Button>
                </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            <div className="relative lg:col-span-1"><MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" /><input type="text" placeholder="Search expenses..." className="input-field w-full pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                            <select className="input-field" value={selectedCategory} onChange={e => {setSelectedCategory(e.target.value); setSelectedVendor(''); setSelectedEmployee('');}}>
                    <option value="">All Categories</option>
                                {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                            {selectedCategory === 'Vendor Payment' && <select className="input-field" value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}><option value="">All Vendors</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>}
                            {selectedCategory === 'Employee Payout' && <select className="input-field" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}><option value="">All Employees</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>}
                            <select className="input-field" value={selectedPaymentMode} onChange={e => setSelectedPaymentMode(e.target.value)}>
                    <option value="">All Payment Modes</option>
                                {PAYMENT_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                  </select>
                            <input type="date" className="input-field" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} />
                            <input type="date" className="input-field" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} />
                </div>
                    </CardContent>
                </Card>

              {error && <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4"><p className="text-destructive-foreground">{error}</p></div>}

              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle>Expenses {totalAmount > 0 && `(${formatCurrency(totalAmount)})`}</CardTitle>
                    <div className="text-sm text-muted-foreground">{totalExpenses} {totalExpenses === 1 ? 'expense' : 'expenses'}</div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                {expenses.length === 0 ? (
                  <div className="p-12 text-center">
                        <CurrencyDollarIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No expenses found</h3>
                        <p className="text-muted-foreground">{searchTerm || selectedCategory ? "Try adjusting your search criteria" : "Get started by adding your first expense"}</p>
                  </div>
                ) : (
                    <>
                        <div className="divide-y">
                      {expenses.map((expense) => {
                        const PaymentIcon = getPaymentModeIcon(expense.payment_mode);
                        return (
                                <div key={expense.id} className="px-4 py-3 sm:px-6 sm:py-4 hover:bg-muted/50 transition-colors w-full">
                            <div className="flex items-start justify-between w-full space-x-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full min-w-0">
                                                <div className="p-2 bg-muted rounded-lg flex-shrink-0"><PaymentIcon className="w-5 h-5 text-muted-foreground" /></div>
                                  <div className="flex-1 min-w-0">
                                                    <h3 className="text-base sm:text-lg font-medium text-foreground truncate">{expense.description}</h3>
                                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground max-w-full">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{expense.category}</span>
                                      <span className="whitespace-nowrap">{formatDate(expense.expense_date)}</span>
                                      <span className="whitespace-nowrap">{expense.payment_mode}</span>
                                                        {(expense.vendor_name || expense.employee_name) && <span className="truncate">• {expense.vendor_name || expense.employee_name}</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 sm:space-x-4 ml-2 flex-shrink-0">
                                            <div className="text-right min-w-[80px]"><p className="text-xl font-bold text-foreground">{formatCurrency(expense.amount)}</p></div>
                                <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_EXPENSES}>
                                  <div className="flex items-center space-x-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(expense)} className="text-muted-foreground hover:text-primary"><PencilIcon className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(expense)} className="text-muted-foreground hover:text-destructive"><TrashIcon className="w-4 h-4" /></Button>
                                  </div>
                                </PermissionGuard>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                        {renderPagination()}
                    </>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          )}
        </Card>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-0 sm:p-4 z-50 pt-2 sm:pt-8">
            <div className="bg-card rounded-none sm:rounded-xl shadow-xl w-full max-w-full sm:max-w-lg max-h-screen sm:max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="sticky top-0 bg-card p-3 sm:p-4 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h2>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
                    <Button type="submit" form="expense-form" className="btn-primary">{editingExpense ? 'Update' : 'Add'}</Button>
                  </div>
                </div>
              </div>
              <form id="expense-form" onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="block text-sm font-semibold text-foreground mb-1">Amount (₹) *</label><input type="number" step="0.01" required className="input-field text-lg" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="0.00" /></div>
                  <div><label className="block text-sm font-medium text-muted-foreground mb-1">Description *</label><input type="text" required className="input-field" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="What was this for?" /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Category *</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {EXPENSE_CATEGORIES.map(c => <button key={c} type="button" onClick={() => setFormData(p => ({...p, category: c, vendor_id: '', employee_id: ''}))} className={`p-2 rounded-lg border text-xs font-medium transition-all ${formData.category === c ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 hover:bg-primary/5'}`}>{c}</button>)}
                  </div>
                </div>
                {formData.category === 'Vendor Payment' && <select className="input-field" value={formData.vendor_id} onChange={e => setFormData({...formData, vendor_id: e.target.value})}><option value="">Select Vendor</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>}
                {formData.category === 'Employee Payout' && <select className="input-field" value={formData.employee_id} onChange={e => setFormData({...formData, employee_id: e.target.value})}><option value="">Select Employee</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>}
                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Payment Mode *</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                        {PAYMENT_MODES.map(m => {
                            const Icon = getPaymentModeIcon(m);
                            return <button key={m} type="button" onClick={() => setFormData(p => ({...p, payment_mode: m}))} className={`p-2 rounded-lg border text-xs font-medium transition-all flex flex-col items-center space-y-1 ${formData.payment_mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 hover:bg-primary/5'}`}><Icon className="w-4 h-4" /><span>{m}</span></button>
                        })}
                </div>
                  </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-muted-foreground mb-1">Date *</label><input type="date" required className="input-field" value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} /></div>
                  <div><label className="block text-sm font-medium text-muted-foreground mb-1">Notes</label><input type="text" className="input-field" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Quick notes..." /></div>
                  </div>
              </form>
            </div>
          </div>
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-destructive/10 rounded-full mx-auto mb-4"><TrashIcon className="w-6 h-6 text-destructive" /></div>
              <h3 className="text-lg font-medium text-foreground text-center mb-2">Delete Expense</h3>
              <p className="text-muted-foreground text-center mb-6">Are you sure you want to delete this expense of {formatCurrency(deleteConfirm.amount)}? This action cannot be undone.</p>
              <div className="flex flex-col sm:flex-row sm:justify-center gap-3">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => handleDelete(deleteConfirm.id)}>Delete</Button>
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
