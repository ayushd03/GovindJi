import React, { useState, useEffect, useCallback } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import {
  UserGroupIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  CurrencyRupeeIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/useToast';
import { Toaster } from '../../components/ui/toaster';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogIconButton,
  AdminDialogTitle,
} from '../../components/AdminDialog';
import { API_BASE_URL } from '../../config/apiBaseUrl';
import { ITEMS_PER_PAGE } from '../../constants/adminConstants';

const EMPLOYEE_ROLES = [
  'Store Manager',
  'Assistant Manager',
  'Cashier',
  'Sales Associate',
  'Stocking Staff',
  'Driver',
  'Security Guard',
  'Cleaner',
  'Accountant'
];

const EmployeeManagement = () => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(ITEMS_PER_PAGE);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    contact_number: '',
    email: '',
    start_date: '',
    salary: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
    notes: ''
  });

  const showSuccess = useCallback((message) => {
    toast({ title: "Success", description: message, variant: "success", duration: 3000 });
  }, [toast]);

  const showError = useCallback((message) => {
    toast({ title: "Error", description: message, variant: "destructive", duration: 5000 });
  }, [toast]);

  const fetchEmployees = useCallback(async (page = 1, limit = itemsPerPage) => {
    try {
      const token = localStorage.getItem('authToken');
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedRole && { role: selectedRole }),
      });

      const response = await fetch(`${API_BASE_URL}/api/admin/employees?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch employees');

      const data = await response.json();
      const nextEmployees = Array.isArray(data.employees) ? data.employees : [];
      const pagination = data.pagination;

      if (!pagination || typeof pagination !== 'object') {
        throw new Error('Invalid employees response format');
      }

      setEmployees(nextEmployees);
      setTotalEmployees(Number(pagination.total) || 0);
      setTotalPages(Math.max(1, Number(pagination.totalPages) || 1));
      setCurrentPage(Number(pagination.page) || page);
      setError(null);
    } catch (err) {
      setError(err.message);
      showError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage, searchTerm, selectedRole, showError]);

  useEffect(() => {
    fetchEmployees(1);
  }, [fetchEmployees]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
        return;
      }
      fetchEmployees(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchEmployees, searchTerm, selectedRole]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalEmployees);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      fetchEmployees(page);
    }
  };

  const getPaginationPages = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    const cleanedPhone = (formData.contact_number || '').replace(/\D/g, '');
    const cleanedEmergencyPhone = (formData.emergency_phone || '').replace(/\D/g, '');

    if (!formData.name.trim()) {
      errors.name = 'Full name is required.';
    }

    if (!formData.role) {
      errors.role = 'Select an employee role.';
    }

    if (!formData.start_date) {
      errors.start_date = 'Start date is required.';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }

    if (cleanedPhone && cleanedPhone.length !== 10) {
      errors.contact_number = 'Enter a valid 10-digit phone number.';
    }

    if (cleanedEmergencyPhone && cleanedEmergencyPhone.length !== 10) {
      errors.emergency_phone = 'Enter a valid 10-digit emergency phone number.';
    }

    if (formData.salary !== '' && Number(formData.salary) < 0) {
      errors.salary = 'Salary cannot be negative.';
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const url = editingEmployee ? `${API_BASE_URL}/api/admin/employees/${editingEmployee.id}` : `${API_BASE_URL}/api/admin/employees`;
      const method = editingEmployee ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, salary: formData.salary ? parseFloat(formData.salary) : null })
      });

      if (!response.ok) throw new Error(`Failed to ${editingEmployee ? 'update' : 'create'} employee`);

      await fetchEmployees(currentPage);
      handleCloseModal();
      showSuccess(editingEmployee ? 'Employee updated successfully' : 'Employee added successfully');
    } catch (err) {
      setError(err.message);
      showError(editingEmployee ? 'Failed to update employee' : 'Failed to add employee');
    }
  };

  const handleDelete = async (employeeId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/employees/${employeeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete employee');
      await fetchEmployees(currentPage);
      setDeleteConfirm(null);
      showSuccess('Employee deleted successfully');
    } catch (err) {
      setError(err.message);
      showError('Failed to delete employee');
    }
  };

  const handleOpenModal = (employee = null) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name || '',
        role: employee.role || '',
        contact_number: employee.contact_number || '',
        email: employee.email || '',
        start_date: employee.start_date ? new Date(employee.start_date).toISOString().split('T')[0] : '',
        salary: employee.salary || '',
        address: employee.address || '',
        emergency_contact: employee.emergency_contact || '',
        emergency_phone: employee.emergency_phone || '',
        notes: employee.notes || ''
      });
    } else {
      setEditingEmployee(null);
      setFormData({ name: '', role: '', contact_number: '', email: '', start_date: '', salary: '', address: '', emergency_contact: '', emergency_phone: '', notes: '' });
    }
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setFormData({ name: '', role: '', contact_number: '', email: '', start_date: '', salary: '', address: '', emergency_contact: '', emergency_phone: '', notes: '' });
    setValidationErrors({});
  };

  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString() : '';
  const formatSalary = (amount) => amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount) : '';

  if (loading) return (
    <div className="flex items-center justify-center min-h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <span className="ml-3 text-lg text-muted-foreground">Loading employees...</span>
    </div>
  );

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_EMPLOYEES}>
      <div className="admin-page">
        <div className="admin-page-header">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="admin-page-title">Employee Management</h1>
              <p className="admin-page-description">Manage employee records, roles, and contact details.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="md:hidden">
                <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2" /> Filters
              </Button>
              <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_EMPLOYEES}>
                <Button onClick={() => handleOpenModal()} className="btn-primary">
                  <PlusIcon className="w-4 h-4 mr-2" /> Add Employee
                </Button>
              </PermissionGuard>
            </div>
          </div>
        </div>

        <Card className="admin-section">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Employee Directory</CardTitle>
                <p className="text-sm text-muted-foreground">Search, filter, and update your team records.</p>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="md:hidden">
                  <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2" /> Filters
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mb-4 md:hidden">
              <div className="relative">
                <MagnifyingGlassIcon className="input-icon-left" />
                <input type="text" placeholder="Search employees..." className="input-field input-with-left-icon w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="relative hidden md:block">
                  <MagnifyingGlassIcon className="input-icon-left" />
                  <input type="text" placeholder="Search employees..." className="input-field input-with-left-icon w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <select className="input-field" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                  <option value="">All Roles</option>
                  {EMPLOYEE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
                <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedRole(''); }}>Clear Filters</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4"><p className="text-destructive-foreground">{error}</p></div>}

        <Card className="admin-section overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Employees ({totalEmployees})</CardTitle>
              <div className="text-sm text-muted-foreground">
                {totalEmployees > 0 ? `Showing ${startIndex + 1}-${endIndex} of ${totalEmployees}` : 'No records'}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {employees.length === 0 ? (
              <div className="p-12 text-center">
                <UserGroupIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No employees found</h3>
                <p className="text-muted-foreground">{searchTerm || selectedRole ? "Try adjusting your search criteria" : "Get started by adding your first employee"}</p>
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {employees.map((employee) => (
                    <div key={employee.id} className="p-6 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-medium text-foreground">{employee.name}</h3>
                              <div className="mt-1 flex items-center space-x-4 text-sm text-muted-foreground flex-wrap">
                                <div className="flex items-center"><UserIcon className="w-4 h-4 mr-1" />{employee.role}</div>
                                {employee.contact_number && <div className="flex items-center"><PhoneIcon className="w-4 h-4 mr-1" />{employee.contact_number}</div>}
                                {employee.email && <div className="flex items-center"><EnvelopeIcon className="w-4 h-4 mr-1" />{employee.email}</div>}
                                {employee.start_date && <div className="flex items-center"><CalendarIcon className="w-4 h-4 mr-1" />Joined {formatDate(employee.start_date)}</div>}
                              </div>
                              <div className="mt-2 flex items-center space-x-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{employee.role}</span>
                                {employee.salary && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success"><CurrencyRupeeIcon className="w-3 h-3 mr-1" />{formatSalary(employee.salary)}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                        <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_EMPLOYEES}>
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal(employee)} className="h-8 w-8 text-muted-foreground hover:text-primary"><PencilIcon className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(employee)} className="h-8 w-8 text-muted-foreground hover:text-destructive"><TrashIcon className="w-4 h-4" /></Button>
                          </div>
                        </PermissionGuard>
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="p-4 sm:p-6 border-t">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-sm text-muted-foreground">Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{endIndex}</span> of <span className="font-medium">{totalEmployees}</span> results</div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 w-8 p-0"><ChevronLeftIcon className="w-4 h-4" /></Button>
                        <div className="hidden sm:flex items-center space-x-1">{getPaginationPages().map(page => <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => handlePageChange(page)} className="h-8 w-8 p-0">{page}</Button>)}</div>
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

        {isModalOpen && (
          <AdminDialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
            <AdminDialogContent size="lg">
              <AdminDialogHeader sticky>
                <div className="flex w-full items-start justify-between gap-3">
                  <AdminDialogTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</AdminDialogTitle>
                  <AdminDialogIconButton onClick={handleCloseModal} />
                </div>
              </AdminDialogHeader>
              <form onSubmit={handleSubmit}>
              <AdminDialogBody className="admin-dialog-stack">
                <div className="admin-dialog-section">
                  <h3 className="text-lg font-medium text-foreground mb-4">Basic Information</h3>
                  <div className="admin-dialog-grid-2">
                    <div>
                      <label className="admin-dialog-label">Full Name *</label>
                      <input
                        type="text"
                        required
                        className={`input-field ${validationErrors.name ? 'border-destructive focus:ring-destructive' : ''}`}
                        value={formData.name}
                        onChange={(e) => {
                          setFormData({ ...formData, name: e.target.value });
                          setValidationErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                      />
                      {validationErrors.name && <p className="mt-1 text-xs text-destructive">{validationErrors.name}</p>}
                    </div>
                    <div>
                      <label className="admin-dialog-label">Role *</label>
                      <select
                        required
                        className={`input-field ${validationErrors.role ? 'border-destructive focus:ring-destructive' : ''}`}
                        value={formData.role}
                        onChange={(e) => {
                          setFormData({ ...formData, role: e.target.value });
                          setValidationErrors((prev) => ({ ...prev, role: undefined }));
                        }}
                      >
                        <option value="">Select Role</option>
                        {EMPLOYEE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                      {validationErrors.role && <p className="mt-1 text-xs text-destructive">{validationErrors.role}</p>}
                    </div>
                  </div>
                </div>
                <div className="admin-dialog-section">
                  <h3 className="text-lg font-medium text-foreground mb-4">Contact Information</h3>
                  <div className="admin-dialog-grid-2">
                    <div>
                      <label className="admin-dialog-label">Phone Number</label>
                      <input
                        type="tel"
                        className={`input-field ${validationErrors.contact_number ? 'border-destructive focus:ring-destructive' : ''}`}
                        value={formData.contact_number}
                        onChange={(e) => {
                          setFormData({ ...formData, contact_number: e.target.value });
                          setValidationErrors((prev) => ({ ...prev, contact_number: undefined }));
                        }}
                      />
                      {validationErrors.contact_number && <p className="mt-1 text-xs text-destructive">{validationErrors.contact_number}</p>}
                    </div>
                    <div>
                      <label className="admin-dialog-label">Email</label>
                      <input
                        type="email"
                        className={`input-field ${validationErrors.email ? 'border-destructive focus:ring-destructive' : ''}`}
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value });
                          setValidationErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                      />
                      {validationErrors.email && <p className="mt-1 text-xs text-destructive">{validationErrors.email}</p>}
                    </div>
                  </div>
                  <div className="mt-4"><label className="admin-dialog-label">Address</label><textarea rows={3} className="input-field" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
                </div>
                <div className="admin-dialog-section">
                  <h3 className="text-lg font-medium text-foreground mb-4">Employment Details</h3>
                  <div className="admin-dialog-grid-2">
                    <div>
                      <label className="admin-dialog-label">Start Date *</label>
                      <input
                        type="date"
                        required
                        className={`input-field ${validationErrors.start_date ? 'border-destructive focus:ring-destructive' : ''}`}
                        value={formData.start_date}
                        onChange={(e) => {
                          setFormData({ ...formData, start_date: e.target.value });
                          setValidationErrors((prev) => ({ ...prev, start_date: undefined }));
                        }}
                      />
                      {validationErrors.start_date && <p className="mt-1 text-xs text-destructive">{validationErrors.start_date}</p>}
                    </div>
                    <div>
                      <label className="admin-dialog-label">Monthly Salary (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        className={`input-field ${validationErrors.salary ? 'border-destructive focus:ring-destructive' : ''}`}
                        value={formData.salary}
                        onChange={(e) => {
                          setFormData({ ...formData, salary: e.target.value });
                          setValidationErrors((prev) => ({ ...prev, salary: undefined }));
                        }}
                      />
                      {validationErrors.salary && <p className="mt-1 text-xs text-destructive">{validationErrors.salary}</p>}
                    </div>
                  </div>
                </div>
                <div className="admin-dialog-section">
                  <h3 className="text-lg font-medium text-foreground mb-4">Emergency Contact</h3>
                  <div className="admin-dialog-grid-2">
                    <div><label className="admin-dialog-label">Emergency Contact Name</label><input type="text" className="input-field" value={formData.emergency_contact} onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })} /></div>
                    <div>
                      <label className="admin-dialog-label">Emergency Phone Number</label>
                      <input
                        type="tel"
                        className={`input-field ${validationErrors.emergency_phone ? 'border-destructive focus:ring-destructive' : ''}`}
                        value={formData.emergency_phone}
                        onChange={(e) => {
                          setFormData({ ...formData, emergency_phone: e.target.value });
                          setValidationErrors((prev) => ({ ...prev, emergency_phone: undefined }));
                        }}
                      />
                      {validationErrors.emergency_phone && <p className="mt-1 text-xs text-destructive">{validationErrors.emergency_phone}</p>}
                    </div>
                  </div>
                </div>
                <div className="admin-dialog-section">
                  <label className="admin-dialog-label">Notes</label>
                  <textarea rows={3} className="input-field" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional notes about the employee..." />
                </div>
              </AdminDialogBody>
                <AdminDialogFooter sticky>
                  <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
                  <Button type="submit" className="btn-primary">{editingEmployee ? 'Update Employee' : 'Add Employee'}</Button>
                </AdminDialogFooter>
              </form>
            </AdminDialogContent>
          </AdminDialog>
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-center w-12 h-12 bg-destructive/10 rounded-full mx-auto mb-4"><TrashIcon className="w-6 h-6 text-destructive" /></div>
              <h3 className="text-lg font-medium text-foreground text-center mb-2">Delete Employee</h3>
              <p className="text-muted-foreground text-center mb-6">Are you sure you want to delete "{deleteConfirm.name}"? This action cannot be undone.</p>
              <div className="flex justify-center space-x-3">
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

export default EmployeeManagement;
