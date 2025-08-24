import React, { useState, useEffect, useCallback } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import {
  CurrencyDollarIcon,
  BuildingOfficeIcon,
  UserIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { Toaster } from '../../components/ui/toaster';

// Import sub-components
import UnifiedExpenseForm from './components/UnifiedExpenseForm';
import TransactionSummary from './components/TransactionSummary';

const ExpenseManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dependencies, setDependencies] = useState({
    parties: [],
    products: [],
    categories: []
  });
  const [validationSchemas, setValidationSchemas] = useState({});
  const [draftData, setDraftData] = useState({});
  
  // Main transaction state
  const [transactionData, setTransactionData] = useState({
    transaction_type: 'expense',
    description: '',
    total_amount: 0,
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: { type: '', details: {} },
    parties: [],
    items: [],
    tax_info: { tax_rate: 0, discount_rate: 0 },
    notes: '',
    attachments: [],
    expense_category: '' // This will replace the top-level category selection
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [lastSavedDraft, setLastSavedDraft] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Toast helper functions
  const showSuccess = (message) => toast({ 
    title: "Success", 
    description: message, 
    variant: "success", 
    duration: 3000 
  });
  
  const showError = (message) => toast({ 
    title: "Error", 
    description: message, 
    variant: "destructive", 
    duration: 5000 
  });


  // API helper function
  const apiCall = useCallback(async (endpoint, options = {}) => {
    const token = localStorage.getItem('authToken');
    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    console.log(`Making API call to: ${API_BASE_URL}${endpoint}`);
    console.log('Token:', token ? `${token.substring(0, 20)}...` : 'No token');
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...defaultOptions,
        ...options
      });

      console.log('API response status:', response.status);
      console.log('API response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API error data:', errorData);
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('API response success, data length:', JSON.stringify(data).length);
      return data;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }, [API_BASE_URL]);

  // Load dependencies on component mount
  useEffect(() => {
    const loadDependencies = async () => {
      setLoading(true);
      try {
        console.log('Making API call to load dependencies...');
        const response = await apiCall('/api/admin/expenses/dependencies');
        console.log('Raw API response:', response);
        
        // Extract the data from the wrapped response
        const deps = response.data || response;
        console.log('Dependencies loaded successfully:', {
          parties: deps.parties?.length || 0,
          products: deps.products?.length || 0,
          categories: deps.categories?.length || 0,
          vendors: deps.parties?.filter(p => p.party_type === 'vendor').length || 0,
          extractedDeps: deps
        });
        setDependencies(deps);
        
        // Load validation schemas for the simplified expense system
        const schemas = {};
        try {
          const schema = await apiCall(`/api/admin/expenses/schema/expense`);
          schemas.expense = schema;
        } catch (error) {
          console.warn(`Failed to load schema for expense:`, error);
        }
        setValidationSchemas(schemas);
        
      } catch (error) {
        console.error('Failed to load dependencies:', error);
        console.error('Error details:', error);
        showError('Failed to load required data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    console.log('ExpenseManagement component mounting, will load dependencies...');
    loadDependencies();
  }, [apiCall]);

  // Auto-save draft functionality
  useEffect(() => {
    const saveDraft = () => {
      if (transactionData.description || transactionData.total_amount > 0 || transactionData.items.length > 0) {
        const draftKey = `expense_draft_simplified`;
        const draftToSave = {
          ...transactionData,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem(draftKey, JSON.stringify(draftToSave));
        setLastSavedDraft(new Date());
      }
    };

    const timer = setTimeout(saveDraft, 2000); // Auto-save after 2 seconds of inactivity
    return () => clearTimeout(timer);
  }, [transactionData]);

  // Load draft on component mount
  useEffect(() => {
    const loadDraft = () => {
      const draftKey = `expense_draft_simplified`;
      const savedDraft = localStorage.getItem(draftKey);
      
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          // Only load if it's recent (within last 24 hours)
          const draftAge = new Date() - new Date(draft.timestamp);
          if (draftAge < 24 * 60 * 60 * 1000) {
            setDraftData(draft);
          } else {
            localStorage.removeItem(draftKey);
          }
        } catch (error) {
          localStorage.removeItem(draftKey);
        }
      }
    };

    loadDraft();
  }, []);

  // Real-time validation
  const validateTransaction = useCallback(async (data) => {
    try {
      const response = await apiCall('/api/admin/expenses/validate', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      // The validation data is nested in response.data
      const validationResult = response.data || response;
      
      setValidationErrors(validationResult.errors || {});
      return validationResult.isValid;
    } catch (error) {
      console.warn('Validation failed:', error);
      return false;
    }
  }, [apiCall]);

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (transactionData.description || transactionData.total_amount > 0) {
        validateTransaction(transactionData);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [transactionData, validateTransaction]);


  // Handle form data updates
  const updateTransactionData = (updates) => {
    setTransactionData(prev => {
      const newData = { ...prev, ...updates };
      
      // Recalculate total amount based on items
      if (updates.items || updates.tax_info) {
        newData.total_amount = calculateTotalAmount(newData.items, newData.tax_info);
      }
      
      return newData;
    });
  };

  // Calculate total amount from items and tax info
  const calculateTotalAmount = (items = [], taxInfo = {}) => {
    const itemsTotal = items.reduce((sum, item) => {
      const itemTotal = (item.quantity || 0) * (item.unit_price || 0);
      const discountAmount = itemTotal * ((item.discount_rate || 0) / 100);
      return sum + itemTotal - discountAmount;
    }, 0);

    const taxAmount = itemsTotal * ((taxInfo.tax_rate || 0) / 100);
    const globalDiscountAmount = itemsTotal * ((taxInfo.discount_rate || 0) / 100);
    
    return Math.max(0, itemsTotal + taxAmount - globalDiscountAmount);
  };

  // Submit transaction
  const handleSubmit = async () => {
    setSubmitting(true);
    
    try {
      // Final validation
      const isValid = await validateTransaction(transactionData);
      if (!isValid) {
        showError('Please fix validation errors before submitting.');
        return;
      }

      // Submit transaction
      const result = await apiCall('/api/admin/expenses', {
        method: 'POST',
        body: JSON.stringify(transactionData)
      });

      // Clear draft and form
      const draftKey = `expense_draft_simplified`;
      localStorage.removeItem(draftKey);
      setLastSavedDraft(null);
      
      // Reset form
      setTransactionData({
        transaction_type: 'expense',
        description: '',
        total_amount: 0,
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: { type: '', details: {} },
        parties: [],
        items: [],
        tax_info: { tax_rate: 0, discount_rate: 0 },
        notes: '',
        attachments: [],
        expense_category: ''
      });

      showSuccess(`Transaction submitted successfully! Reference: ${result.reference_number}`);

    } catch (error) {
      console.error('Submit error:', error);
      showError(error.message || 'Failed to submit transaction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Load draft data
  const loadDraftData = () => {
    if (draftData.timestamp) {
      setTransactionData(draftData);
      setDraftData({});
      showSuccess('Draft loaded successfully!');
    }
  };

  // Render loading state
  if (loading) {
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
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Expense Management</CardTitle>
                <p className="text-muted-foreground text-sm mt-1">
                  Simplified expense tracking with vendor order support
                </p>
              </div>
              
              {/* Draft indicator */}
              {lastSavedDraft && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-2 sm:mt-0">
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                  <span>Draft saved {lastSavedDraft.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Draft notification */}
        {draftData.timestamp && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-orange-800">Draft Available</p>
                    <p className="text-sm text-orange-600">
                      You have an unsaved draft from {new Date(draftData.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button onClick={loadDraftData} variant="outline" size="sm">
                  Load Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Simplified Expense Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CurrencyDollarIcon className="w-5 h-5" />
                  <span>Add New Expense</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enter expense details and select vendor orders when needed
                </p>
              </CardHeader>
              <CardContent>
                <UnifiedExpenseForm
                  transactionData={transactionData}
                  updateTransactionData={updateTransactionData}
                  dependencies={dependencies}
                  validationErrors={validationErrors}
                  validationSchema={validationSchemas.expense}
                />
              </CardContent>
            </Card>
          </div>

          {/* Summary sidebar */}
          <div className="space-y-6">
            <TransactionSummary 
              transactionData={transactionData}
              validationErrors={validationErrors}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </div>
        </div>

        <Toaster />
      </div>
    </PermissionGuard>
  );
};

export default ExpenseManagement;