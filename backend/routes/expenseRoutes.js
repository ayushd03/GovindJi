const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const roleMiddleware = require('../middleware/roleMiddleware');
const { asyncHandler, logger, sendSuccess, sendError } = require('../middleware/errorHandler');

const router = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Import transaction type validation from config
const { validateTransactionFields: validateTxnFields, getTransactionTypeById } = require('../config/transactionTypes');

/**
 * Expense Management API
 * Handles all expense-related transactions
 */

// Main expense transaction endpoint
router.post('/', 
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.MANAGE_EXPENSES),
  asyncHandler(async (req, res) => {
    let transaction;
    let createdRecords = {}; // Initialize at the top to avoid undefined errors
    
    try {
      const {
        transaction_type,
        description,
        total_amount,
        transaction_date,
        payment_method,
        parties = [],
        items = [],
        tax_info = {},
        notes,
        attachments = [],
        expense_category,
        expected_delivery_date,
        payment_terms,
        priority,
        reference_number
      } = req.body;

      // Validate request
      const validation = await validateSimplifiedExpenseTransaction(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          errors: validation.errors,
          message: 'Validation failed'
        });
      }

      // Generate reference number
      const { data: refData, error: refError } = await supabase
        .rpc('generate_reference_number', { transaction_type: 'expense' });
      
      if (refError) throw refError;
      const referenceNumber = refData;

      let status = 'completed';

      // Process transaction based on simplified structure
      if (expense_category === 'Vendor Order') {
        // Handle vendor order with items and multiple vendors
        createdRecords = await processVendorOrderExpense({
          description,
          items,
          parties, // Pass parties for vendor orders
          tax_info,
          transaction_date,
          payment_method,
          notes,
          expected_delivery_date,
          payment_terms,
          priority,
          created_by: req.user.id
        });
        status = 'processing'; // Vendor orders start as processing
      } else if (expense_category === 'Vendor Payment') {
        // Handle vendor payment
        createdRecords = await processVendorPayment({
          description,
          total_amount,
          transaction_date,
          payment_method,
          party: parties[0], // Required party for vendor payments
          notes,
          reference_number,
          created_by: req.user.id
        });
        status = 'completed'; // Vendor payments are completed immediately
      } else {
        // Handle regular expense
        createdRecords = await processRegularExpense({
          expense_category,
          description,
          total_amount,
          transaction_date,
          payment_method,
          party: parties[0], // Optional party for regular expenses
          notes,
          reference_number,
          created_by: req.user.id
        });
      }

      // Create unified transaction record
      const { data: unifiedTransaction, error: utError } = await supabase
        .from('unified_transactions')
        .insert({
          transaction_type: 'expense',
          reference_number: referenceNumber,
          total_amount,
          description,
          transaction_date,
          notes,
          status,
          expense_category,
          expected_delivery_date,
          payment_terms,
          priority,
          expense_id: createdRecords.expense_id || null,
          purchase_order_id: createdRecords.purchase_order_id || null,
          party_payment_id: createdRecords.party_payment_id || null,
          party_id: createdRecords.party_id || null,
          created_by: req.user.id
        })
        .select()
        .single();

      if (utError) throw utError;

      // Process attachments if any
      if (attachments.length > 0) {
        await processAttachments(unifiedTransaction.id, attachments);
      }

      // Return success response
      res.json({
        success: true,
        data: {
          transaction_id: unifiedTransaction.id,
          transaction_type: 'expense',
          reference_number: referenceNumber,
          total_amount,
          status,
          created_records: createdRecords
        },
        message: 'Transaction processed successfully'
      });

    } catch (error) {
      logger.error('Unified transaction error', error, {
        transaction_type: req.body.transaction_type,
        user_id: req.user?.id,
        request_body: req.body
      });
      
      // Attempt to rollback any created records using proper database function
      try {
        const { data: rollbackResult, error: rollbackError } = await supabase
          .rpc('rollback_expense_transaction', {
            p_expense_id: createdRecords.expense_id || null,
            p_purchase_order_id: createdRecords.purchase_order_id || null,
            p_party_payment_id: createdRecords.party_payment_id || null
          });
          
        if (rollbackError) {
          // If function doesn't exist, use manual cleanup
          if (rollbackError.code === 'PGRST202') {
            logger.warn('Database function not found, performing manual rollback', rollbackError);
            await manualRollback(createdRecords);
          } else {
            logger.error('Database rollback failed', rollbackError, {
              created_records: createdRecords
            });
          }
        } else {
          logger.info('Transaction rollback completed', rollbackResult, {
            created_records: createdRecords
          });
        }
      } catch (rollbackError) {
        logger.error('Rollback failed, attempting manual cleanup', rollbackError, {
          created_records: createdRecords
        });
        try {
          await manualRollback(createdRecords);
        } catch (manualRollbackError) {
          logger.error('Manual rollback also failed', manualRollbackError);
        }
      }

      throw error; // Let the asyncHandler and global error middleware handle it
    }
  }));

// Get transaction schema for a specific type
router.get('/schema/:type', 
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    
    const schema = getTransactionSchema(type);
    
    logger.info('Transaction schema retrieved', {
      type,
      user_id: req.user?.id
    });
    
    sendSuccess(res, schema, 'Schema retrieved successfully');
  }));

// Get dependencies (parties, products, etc.) for transaction creation
router.get('/dependencies', 
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    // Fetch parties (vendors/customers)
    const { data: parties, error: partiesError } = await supabase
      .from('parties')
      .select('id, name, party_type, category, current_balance, contact_person')
      .eq('is_active', true)
      .order('name');

    if (partiesError) throw partiesError;

    // Fetch employees
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, name, role, contact_number')
      .eq('is_active', true)
      .order('name');

    if (employeesError) throw employeesError;

    // Fetch products for autocomplete
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, unit, sku, category_id, description')
      .eq('is_active', true)
      .order('name');

    if (productsError) throw productsError;

    // Fetch categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (categoriesError) throw categoriesError;

    const dependencies = {
      parties,
      employees,
      products,
      categories,
      transaction_types: ['cash', 'upi', 'cheque'],
      expense_categories: [
        'Store Utilities', 'Office Supplies', 'Marketing', 'Maintenance', 
        'Transportation', 'Miscellaneous', 'Vendor Order', 'Vendor Payment', 'Employee Payout'
      ]
    };

    sendSuccess(res, dependencies, 'Dependencies retrieved successfully');
  }));

// Search parties (vendors, customers) with pagination and filters
router.get('/search/parties', 
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const { 
      q = '', 
      party_type = '', 
      limit = 10, 
      offset = 0 
    } = req.query;

    // Validate limit to prevent abuse
    const maxLimit = 50;
    const parsedLimit = Math.min(parseInt(limit) || 10, maxLimit);
    const parsedOffset = parseInt(offset) || 0;

    // Build the query
    let query = supabase
      .from('parties')
      .select('id, name, party_type, contact_person, phone_number, current_balance, email, address, category')
      .eq('is_active', true);

    // Add search filter if provided
    if (q.trim()) {
      query = query.or(`name.ilike.%${q}%,contact_person.ilike.%${q}%,phone_number.ilike.%${q}%,email.ilike.%${q}%`);
    }

    // Add party type filter if provided
    if (party_type) {
      query = query.eq('party_type', party_type);
    }

    // Add pagination and ordering
    query = query
      .order('name')
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    const { data: parties, error, count } = await query;

    if (error) throw error;

    // Get total count for pagination
    let countQuery = supabase
      .from('parties')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (q.trim()) {
      countQuery = countQuery.or(`name.ilike.%${q}%,contact_person.ilike.%${q}%,phone_number.ilike.%${q}%,email.ilike.%${q}%`);
    }

    if (party_type) {
      countQuery = countQuery.eq('party_type', party_type);
    }

    const { count: totalCount } = await countQuery;

    const result = {
      parties: parties || [],
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: totalCount || 0,
        hasMore: (parsedOffset + parsedLimit) < (totalCount || 0)
      }
    };

    sendSuccess(res, result, 'Parties retrieved successfully');
  }));

// Search products with pagination and filters
router.get('/search/products', 
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const { 
      q = '', 
      category_id = '', 
      limit = 10, 
      offset = 0 
    } = req.query;

    // Validate limit to prevent abuse
    const maxLimit = 50;
    const parsedLimit = Math.min(parseInt(limit) || 10, maxLimit);
    const parsedOffset = parseInt(offset) || 0;

    // Build the query
    let query = supabase
      .from('products')
      .select('id, name, price, unit, sku, category_id, description')
      .eq('is_active', true);

    // Add search filter if provided
    if (q.trim()) {
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Add category filter if provided
    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    // Add pagination and ordering
    query = query
      .order('name')
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    const { data: products, error } = await query;

    if (error) throw error;

    // Get total count for pagination
    let countQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (q.trim()) {
      countQuery = countQuery.or(`name.ilike.%${q}%,sku.ilike.%${q}%,description.ilike.%${q}%`);
    }

    if (category_id) {
      countQuery = countQuery.eq('category_id', category_id);
    }

    const { count: totalCount } = await countQuery;

    const result = {
      products: products || [],
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: totalCount || 0,
        hasMore: (parsedOffset + parsedLimit) < (totalCount || 0)
      }
    };

    sendSuccess(res, result, 'Products retrieved successfully');
  }));

// Validate transaction data
router.post('/validate', 
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const validation = await validateSimplifiedExpenseTransaction(req.body);
    
    if (!validation.isValid) {
      logger.warn('Transaction validation failed', null, {
        errors: validation.errors,
        expense_category: req.body.expense_category,
        user_id: req.user?.id
      });
    }
    
    sendSuccess(res, validation, 'Transaction validation completed');
  }));

// Get expense history with filters and pagination
router.get('/history',
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      payment_method = '',
      start_date,
      end_date,
      min_amount,
      max_amount
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query with payment details from party_payments
    let query = supabase
      .from('unified_transactions')
      .select(`
        *,
        payment:party_payments(payment_method, reference_number, release_date)
      `, { count: 'exact' })
      .eq('transaction_type', 'expense')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`description.ilike.%${search}%,reference_number.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('expense_category', category);
    }

    // Note: payment_method filtering done client-side after fetch (see below)

    if (start_date) {
      query = query.gte('transaction_date', start_date);
    }

    if (end_date) {
      query = query.lte('transaction_date', end_date);
    }

    if (min_amount) {
      query = query.gte('total_amount', parseFloat(min_amount));
    }

    if (max_amount) {
      query = query.lte('total_amount', parseFloat(max_amount));
    }

    // Apply pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: expenses, error, count } = await query;

    if (error) throw error;

    // Filter by payment method client-side if specified
    let filteredExpenses = expenses || [];
    if (payment_method && filteredExpenses.length > 0) {
      filteredExpenses = filteredExpenses.filter(expense =>
        expense.payment?.payment_method === payment_method
      );
    }

    logger.info('Expense history retrieved', {
      user_id: req.user?.id,
      page: parseInt(page),
      total_count: count,
      filtered_count: filteredExpenses.length,
      filters: { search, category, payment_method, start_date, end_date, min_amount, max_amount }
    });

    sendSuccess(res, {
      expenses: filteredExpenses,
      total: filteredExpenses.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(filteredExpenses.length / parseInt(limit))
    }, 'Expense history retrieved successfully');
  }));

// Export expenses to Excel
router.get('/export',
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const {
      search = '',
      category = '',
      payment_method = '',
      start_date,
      end_date,
      min_amount,
      max_amount
    } = req.query;

    // Build query (without pagination for export)
    let query = supabase
      .from('unified_transactions')
      .select(`
        *,
        payment:party_payments(payment_method, reference_number, release_date)
      `)
      .eq('transaction_type', 'expense')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply same filters as history endpoint
    if (search) {
      query = query.or(`description.ilike.%${search}%,reference_number.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('expense_category', category);
    }

    // Note: payment_method filtering done client-side after fetch (see below)

    if (start_date) {
      query = query.gte('transaction_date', start_date);
    }

    if (end_date) {
      query = query.lte('transaction_date', end_date);
    }

    if (min_amount) {
      query = query.gte('total_amount', parseFloat(min_amount));
    }

    if (max_amount) {
      query = query.lte('total_amount', parseFloat(max_amount));
    }

    const { data: expenses, error } = await query;

    if (error) throw error;

    // Filter by payment method client-side if specified
    let filteredExpenses = expenses || [];
    if (payment_method && filteredExpenses.length > 0) {
      filteredExpenses = filteredExpenses.filter(expense =>
        expense.payment?.payment_method === payment_method
      );
    }

    // Create Excel workbook
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expenses');

    // Define columns
    worksheet.columns = [
      { header: 'Date', key: 'transaction_date', width: 12 },
      { header: 'Reference', key: 'reference_number', width: 20 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Category', key: 'expense_category', width: 20 },
      { header: 'Amount', key: 'total_amount', width: 15 },
      { header: 'Payment Method', key: 'payment_method', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Created At', key: 'created_at', width: 20 }
    ];

    // Add data rows
    filteredExpenses.forEach(expense => {
      worksheet.addRow({
        transaction_date: expense.transaction_date,
        reference_number: expense.reference_number || '',
        description: expense.description,
        expense_category: expense.expense_category,
        total_amount: parseFloat(expense.total_amount) || 0,
        payment_method: expense.payment?.payment_method || 'Unknown',
        status: expense.status || 'completed',
        notes: expense.notes || '',
        created_at: new Date(expense.created_at).toLocaleString()
      });
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    };

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=expenses-${start_date || 'all'}-${end_date || new Date().toISOString().split('T')[0]}.xlsx`);

    // Write to response
    await workbook.xlsx.write(res);

    logger.info('Expenses exported', {
      user_id: req.user?.id,
      record_count: filteredExpenses.length,
      filters: { search, category, payment_method, start_date, end_date }
    });

    res.end();
  }));

// Get upcoming cheque clearances
router.get('/cheques/upcoming',
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const { days = 7 } = req.query;

    const { data: cheques, error } = await supabase
      .rpc('get_cheques_due_in_days', { days_ahead: parseInt(days) });

    if (error) throw error;

    logger.info('Upcoming cheques retrieved', {
      user_id: req.user?.id,
      days_ahead: days,
      count: cheques?.length || 0
    });

    sendSuccess(res, {
      cheques: cheques || [],
      days_ahead: parseInt(days),
      total_count: cheques?.length || 0,
      total_amount: cheques?.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0) || 0
    }, 'Upcoming cheques retrieved successfully');
  }));

// Get all cheques with filtering
router.get('/cheques',
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const {
      start_date,
      end_date,
      party_id,
      status = 'all' // 'all', 'pending', 'cleared'
    } = req.query;

    let query = supabase
      .from('party_payments')
      .select(`
        *,
        party:party_id(id, name, contact_person)
      `)
      .eq('payment_method', 'cheque')
      .order('release_date', { ascending: true });

    if (start_date) {
      query = query.gte('release_date', start_date);
    }

    if (end_date) {
      query = query.lte('release_date', end_date);
    }

    if (party_id) {
      query = query.eq('party_id', party_id);
    }

    if (status === 'pending') {
      query = query.gte('release_date', new Date().toISOString().split('T')[0]);
    } else if (status === 'cleared') {
      query = query.lt('release_date', new Date().toISOString().split('T')[0]);
    }

    const { data: cheques, error } = await query;

    if (error) throw error;

    logger.info('Cheques retrieved', {
      user_id: req.user?.id,
      filters: { start_date, end_date, party_id, status },
      count: cheques?.length || 0
    });

    sendSuccess(res, {
      cheques: cheques || [],
      total_count: cheques?.length || 0,
      total_amount: cheques?.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0) || 0
    }, 'Cheques retrieved successfully');
  }));

// Get transaction by ID (MUST BE LAST to avoid route conflicts)
router.get('/:id',
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validate ID format
    if (!id || id.trim() === '') {
      logger.warn('Invalid transaction ID provided', null, {
        provided_id: id,
        user_id: req.user?.id
      });
      return sendError(res, 'Transaction ID is required', 400);
    }

    const { data: transaction, error } = await supabase
      .from('unified_transactions')
      .select(`
        *,
        expense:expenses(*),
        purchase_order:purchase_orders(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Database error fetching transaction', error, {
        transaction_id: id,
        user_id: req.user?.id
      });
      throw error;
    }

    if (!transaction) {
      logger.warn('Transaction not found', null, {
        transaction_id: id,
        user_id: req.user?.id
      });
      return sendError(res, 'Transaction not found', 404);
    }

    // Manually fetch party information if party_id exists
    if (transaction.party_id) {
      try {
        const { data: partyData, error: partyError } = await supabase
          .from('parties')
          .select('*')
          .eq('id', transaction.party_id)
          .single();

        if (!partyError && partyData) {
          transaction.party = partyData;
        }
      } catch (partyFetchError) {
        logger.warn('Failed to fetch party information', partyFetchError, {
          transaction_id: id,
          party_id: transaction.party_id
        });
      }
    }

    // Manually fetch attachments for this transaction
    try {
      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from('transaction_attachments')
        .select('*')
        .eq('unified_transaction_id', id);

      if (!attachmentsError && attachmentsData) {
        transaction.attachments = attachmentsData;
      } else {
        transaction.attachments = [];
      }
    } catch (attachmentsFetchError) {
      logger.warn('Failed to fetch attachments', attachmentsFetchError, {
        transaction_id: id
      });
      transaction.attachments = [];
    }

    logger.info('Transaction retrieved successfully', {
      transaction_id: id,
      transaction_type: transaction.transaction_type,
      user_id: req.user?.id
    });

    sendSuccess(res, transaction, 'Transaction retrieved successfully');
  }));

// Helper function: Validate expense transaction
async function validateExpenseTransaction(data) {
  const errors = {};
  let isValid = true;

  // Common validations
  if (!data.transaction_type) {
    errors.transaction_type = 'Transaction type is required';
    isValid = false;
  }
  
  // Accept 'expense' as the primary transaction type
  if (data.transaction_type && data.transaction_type !== 'expense') {
    errors.transaction_type = 'Invalid transaction type. Expected "expense"';
    isValid = false;
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.description = 'Description is required';
    isValid = false;
  }

  if (!data.total_amount || data.total_amount <= 0) {
    errors.total_amount = 'Total amount must be greater than 0';
    isValid = false;
  }

  if (!data.transaction_date) {
    errors.transaction_date = 'Transaction date is required';
    isValid = false;
  }

  // Payment method validation
  if (!data.payment_method || !data.payment_method.type) {
    errors.payment_method = 'Payment method is required';
    isValid = false;
  } else {
    const paymentValidation = validateTransactionFields(
      data.payment_method.type, 
      data.payment_method.details || {}
    );
    if (!paymentValidation.isValid) {
      errors.payment_method = paymentValidation.errors;
      isValid = false;
    }
  }

  // Expense category specific validations
  if (data.expense_category === 'Vendor Order') {
    if (!data.items || data.items.length === 0) {
      errors.items = 'At least one item is required for vendor orders';
      isValid = false;
    }
    // Validate items for vendor orders
    if (data.items) {
      data.items.forEach((item, index) => {
        if (!item.description || item.description.trim().length === 0) {
          errors[`items.${index}.description`] = 'Item description is required';
          isValid = false;
        }
        if (!item.quantity || item.quantity <= 0) {
          errors[`items.${index}.quantity`] = 'Quantity must be greater than 0';
          isValid = false;
        }
        if (!item.unit_price || item.unit_price < 0) {
          errors[`items.${index}.unit_price`] = 'Unit price must be 0 or greater';
          isValid = false;
        }
        // For vendor orders, each item should have a vendor assigned
        if (!item.vendor_id && !item.vendor_name) {
          errors[`items.${index}.vendor`] = 'Vendor selection required for this item';
          isValid = false;
        }
      });
    }
  }

  if (data.expense_category === 'Vendor Payment') {
    if (!data.parties || !data.parties[0] || !data.parties[0].party_id) {
      errors.parties = 'Vendor selection is required for vendor payments';
      isValid = false;
    }
  }

  return { isValid, errors };
}

// Helper function: Validate transaction fields based on type
function validateTransactionFields(type, fields) {
  return validateTxnFields(type, fields);
}

// Helper function: Process quick expense
async function processQuickExpense(data) {
  const category = data.party?.party_type === 'vendor' ? 'Vendor Payment' :
                  data.party?.party_type === 'employee' ? 'Employee Payout' :
                  'Miscellaneous';

  // First create party_payment record for payment tracking
  const { data: payment, error: paymentError } = await supabase
    .from('party_payments')
    .insert({
      party_id: data.party?.party_id || null,
      payment_type: 'payment',
      amount: data.total_amount,
      payment_date: data.transaction_date,
      payment_method: data.payment_method.type,
      reference_number: data.payment_method.details?.reference_number ||
                       data.payment_method.details?.cheque_number || null,
      release_date: data.payment_method.type === 'cheque' ?
                   (data.payment_method.details?.release_date || null) : null,
      notes: data.notes,
      created_by: data.created_by
    })
    .select()
    .single();

  if (paymentError) throw paymentError;

  // Then create expense record referencing the payment
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      amount: data.total_amount,
      description: data.description,
      category: category,
      vendor_id: data.party?.party_type === 'vendor' ? data.party.party_id : null,
      employee_id: data.party?.party_type === 'employee' ? data.party.party_id : null,
      party_payment_id: payment.id,
      expense_date: data.transaction_date,
      notes: data.notes,
      created_by: data.created_by
    })
    .select()
    .single();

  if (error) throw error;
  return { expense_id: expense.id, party_payment_id: payment.id };
}

// Helper function: Process vendor order
async function processVendorOrder(data) {
  // Calculate totals
  const subtotal = data.items.reduce((sum, item) => sum + (item.total_amount || (item.quantity * item.unit_price)), 0);
  const taxAmount = subtotal * (data.tax_info.tax_rate || 0) / 100;
  const discountAmount = subtotal * (data.tax_info.discount_rate || 0) / 100;
  const finalAmount = subtotal + taxAmount - discountAmount;

  // Generate PO number using the database function
  const { data: poNumber, error: poNumError } = await supabase
    .rpc('generate_reference_number', { transaction_type: 'vendor_order' });
  
  if (poNumError) throw poNumError;

  // Create purchase order
  const { data: purchaseOrder, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      po_number: poNumber,
      party_id: data.party.party_id,
      order_date: data.transaction_date,
      subtotal,
      tax_rate: data.tax_info.tax_rate || 0,
      tax_amount: taxAmount,
      discount_rate: data.tax_info.discount_rate || 0,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      status: 'confirmed',
      notes: data.notes,
      created_by: data.created_by
    })
    .select()
    .single();

  if (poError) throw poError;

  // Create purchase order items
  const itemsToInsert = data.items.map(item => ({
    purchase_order_id: purchaseOrder.id,
    product_id: item.product_id || null,
    item_name: item.item_name,
    description: item.description || '',
    category_id: item.category_id || null,
    item_hsn: item.item_hsn || '',
    sku: item.sku || '',
    quantity: item.quantity,
    unit: item.unit || 'kg',
    price_per_unit: item.unit_price,
    discount_percentage: item.discount_percentage || 0,
    tax_percentage: item.tax_percentage || 0,
    discount_amount: item.discount_amount || 0,
    tax_amount: item.tax_amount || 0,
    total_amount: item.total_amount || (item.quantity * item.unit_price),
    has_miscellaneous_expenses: item.has_miscellaneous_expenses || false,
    miscellaneous_amount: item.miscellaneous_amount || 0,
    miscellaneous_note: item.miscellaneous_note || ''
  }));

  const { error: itemsError } = await supabase
    .from('purchase_order_items')
    .insert(itemsToInsert);

  if (itemsError) throw itemsError;

  return { purchase_order_id: purchaseOrder.id };
}

// Helper function: Process vendor payment
async function processVendorPayment(data) {
  const { data: payment, error } = await supabase
    .from('party_payments')
    .insert({
      party_id: data.party.party_id,
      payment_type: 'payment', // This is a debit transaction for the vendor
      amount: data.total_amount,
      payment_date: data.transaction_date,
      payment_method: data.payment_method.type,
      reference_number: data.payment_method.details?.reference_number ||
                       data.payment_method.details?.cheque_number ||
                       data.reference_number || null,
      release_date: data.payment_method.type === 'cheque' ?
                   (data.payment_method.details?.release_date || null) : null,
      notes: `${data.description}${data.notes ? ' | ' + data.notes : ''}`,
      created_by: data.created_by
    })
    .select()
    .single();

  if (error) throw error;

  // Update party balance using database function
  try {
    const { data: newBalance, error: balanceError } = await supabase
      .rpc('calculate_party_current_balance', { party_id: data.party.party_id });

    if (!balanceError && newBalance !== null) {
      await supabase
        .from('parties')
        .update({ current_balance: newBalance })
        .eq('id', data.party.party_id);
    }
  } catch (balanceUpdateError) {
    console.warn('Vendor balance update warning:', balanceUpdateError.message);
    // Don't fail the transaction for balance update issues
  }

  return { 
    party_payment_id: payment.id,
    party_id: data.party.party_id
  };
}

// Helper function: Process other expense
async function processOtherExpense(data) {
  // First create party_payment record for payment tracking
  const { data: payment, error: paymentError } = await supabase
    .from('party_payments')
    .insert({
      party_id: null, // No party for miscellaneous expenses
      payment_type: 'payment',
      amount: data.total_amount,
      payment_date: data.transaction_date,
      payment_method: data.payment_method.type,
      reference_number: data.payment_method.details?.reference_number ||
                       data.payment_method.details?.cheque_number || null,
      release_date: data.payment_method.type === 'cheque' ?
                   (data.payment_method.details?.release_date || null) : null,
      notes: data.notes,
      created_by: data.created_by
    })
    .select()
    .single();

  if (paymentError) throw paymentError;

  // Then create expense record referencing the payment
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      amount: data.total_amount,
      description: data.description,
      category: 'Miscellaneous',
      party_payment_id: payment.id,
      expense_date: data.transaction_date,
      notes: data.notes,
      created_by: data.created_by
    })
    .select()
    .single();

  if (error) throw error;
  return { expense_id: expense.id, party_payment_id: payment.id };
}

// Helper function: Process attachments
async function processAttachments(transactionId, attachments) {
  if (!attachments || attachments.length === 0) return;

  const attachmentsToInsert = attachments.map(att => ({
    unified_transaction_id: transactionId,
    file_name: att.file_name,
    file_url: att.file_url,
    file_type: att.file_type || 'other',
    file_size: att.file_size || null,
    mime_type: att.mime_type || null
  }));

  const { error } = await supabase
    .from('transaction_attachments')
    .insert(attachmentsToInsert);

  if (error) throw error;
}

// Helper function: Get transaction schema
function getTransactionSchema(type) {
  const schemas = {
    expense: {
      required: ['description', 'expense_category', 'transaction_date', 'payment_method'],
      optional: ['notes', 'parties', 'items', 'tax_info', 'expected_delivery_date', 'payment_terms', 'priority', 'reference_number'],
      expense_categories: [
        'Store Utilities',
        'Office Supplies', 
        'Marketing',
        'Maintenance',
        'Transportation',
        'Miscellaneous',
        'Vendor Order'
      ],
      vendor_order_specific: {
        required: ['items'],
        optional: ['expected_delivery_date', 'payment_terms', 'priority'],
        items_min: 1,
        items_max: 1000
      },
      regular_expense_specific: {
        required: ['total_amount'],
        optional: ['parties', 'reference_number']
      }
    }
  };

  if (!schemas[type]) {
    throw new Error(`Unknown transaction type: ${type}`);
  }

  return schemas[type];
}

// Helper function: Manual rollback (fallback when database function doesn't exist)
async function manualRollback(createdRecords) {
  const rollbackPromises = [];

  if (createdRecords.expense_id) {
    rollbackPromises.push(
      supabase.from('expenses').delete().eq('id', createdRecords.expense_id)
    );
  }

  if (createdRecords.purchase_order_id) {
    rollbackPromises.push(
      supabase.from('purchase_order_items').delete().eq('purchase_order_id', createdRecords.purchase_order_id),
      supabase.from('purchase_orders').delete().eq('id', createdRecords.purchase_order_id)
    );
  }

  if (createdRecords.party_payment_id) {
    rollbackPromises.push(
      supabase.from('party_payments').delete().eq('id', createdRecords.party_payment_id)
    );
  }

  await Promise.all(rollbackPromises);
}

// Helper function: Rollback transaction - now uses proper database function
// The rollback logic has been moved to the database function 'rollback_expense_transaction'
// for atomic operations and better data consistency

// New Helper function: Process vendor order expense (simplified structure)
async function processVendorOrderExpense(data) {
  // Calculate totals (no global tax/discount - handled at item level)
  const finalAmount = data.items.reduce((sum, item) => sum + (item.total || (item.quantity * item.unit_price)), 0);

  // Get primary vendor from parties or items
  let primaryVendorId = null;
  if (data.parties && data.parties.length > 0) {
    primaryVendorId = data.parties[0].party_id;
  } else if (data.items && data.items.length > 0 && data.items[0].vendor_id) {
    primaryVendorId = data.items[0].vendor_id;
  }

  if (!primaryVendorId) {
    throw new Error('Vendor selection is required for vendor orders');
  }

  // Generate PO number using the database function
  const { data: poNumber, error: poNumError } = await supabase
    .rpc('generate_reference_number', { transaction_type: 'vendor_order' });
  
  if (poNumError) throw poNumError;

  // Create purchase order with party_id
  const { data: purchaseOrder, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      po_number: poNumber,
      party_id: primaryVendorId, // Associate with primary vendor
      order_date: data.transaction_date,
      subtotal: finalAmount,
      tax_rate: 0,
      tax_amount: 0,
      discount_rate: 0,
      discount_amount: 0,
      final_amount: finalAmount,
      total_amount: finalAmount, // Ensure total_amount is set
      status: 'confirmed',
      notes: data.notes,
      expected_delivery_date: data.expected_delivery_date,
      payment_terms: data.payment_terms,
      priority: data.priority || 'normal',
      created_by: data.created_by
    })
    .select()
    .single();

  if (poError) throw poError;

  // Create purchase order items with vendor assignments
  const itemsToInsert = data.items.map(item => ({
    purchase_order_id: purchaseOrder.id,
    product_id: item.product_id || null,
    item_name: item.product_name || item.item_name,
    description: item.description || '',
    quantity: item.quantity,
    unit: item.unit || 'piece',
    price_per_unit: item.unit_price,
    discount_percentage: item.discount_rate || 0,
    total_amount: item.total,
    vendor_id: item.vendor_id || primaryVendorId, // Use item vendor or primary vendor
    vendor_name: item.vendor_name || null
  }));

  const { error: itemsError } = await supabase
    .from('purchase_order_items')
    .insert(itemsToInsert);

  if (itemsError) throw itemsError;

  // If immediate payment was made, create a payment entry
  // Note: We do NOT create adjustment entries for purchase orders - the purchase_orders table itself tracks the debt
  const hasValidPaymentMethod = data.payment_method &&
                                data.payment_method.type !== null &&
                                data.payment_method.type !== undefined &&
                                typeof data.payment_method.type === 'string' &&
                                data.payment_method.type.trim() !== '' &&
                                data.payment_method.type !== 'none';

  if (hasValidPaymentMethod) {
    const { data: paymentDebit, error: debitError } = await supabase
      .from('party_payments')
      .insert({
        party_id: primaryVendorId,
        payment_type: 'payment',
        amount: finalAmount,
        payment_date: data.transaction_date,
        payment_method: data.payment_method.type,
        reference_number: data.payment_method.details?.reference_number ||
                         data.payment_method.details?.cheque_number || poNumber,
        release_date: data.payment_method.type === 'cheque' ?
                     (data.payment_method.details?.release_date || null) : null,
        notes: `Payment for PO: ${poNumber} - ${data.description}`,
        created_by: data.created_by
      })
      .select()
      .single();

    if (debitError) throw debitError;
  }

  // Update party current balance using database function
  try {
    const { data: newBalance, error: balanceError } = await supabase
      .rpc('calculate_party_current_balance', { party_id: primaryVendorId });

    if (!balanceError && newBalance !== null) {
      // Update the party record with the calculated balance
      await supabase
        .from('parties')
        .update({ current_balance: newBalance })
        .eq('id', primaryVendorId);
    }
  } catch (balanceUpdateError) {
    console.warn('Party balance update warning:', balanceUpdateError.message);
    // Don't fail the transaction for balance update issues
  }

  return { 
    purchase_order_id: purchaseOrder.id,
    total_amount: finalAmount,
    party_id: primaryVendorId
  };
}

// New Helper function: Process regular expense (simplified structure)
async function processRegularExpense(data) {
  // First create party_payment record for payment tracking
  const { data: payment, error: paymentError } = await supabase
    .from('party_payments')
    .insert({
      party_id: data.party?.id || null,
      payment_type: 'payment',
      amount: data.total_amount,
      payment_date: data.transaction_date,
      payment_method: data.payment_method.type || 'cash',
      reference_number: data.payment_method.details?.reference_number ||
                       data.payment_method.details?.cheque_number ||
                       data.reference_number || null,
      release_date: data.payment_method.type === 'cheque' ?
                   (data.payment_method.details?.release_date || null) : null,
      notes: data.notes,
      created_by: data.created_by
    })
    .select()
    .single();

  if (paymentError) throw paymentError;

  // Then create expense record referencing the payment
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      amount: data.total_amount,
      description: data.description,
      category: data.expense_category,
      vendor_id: data.party?.id || null,
      party_payment_id: payment.id,
      expense_date: data.transaction_date,
      notes: data.notes,
      created_by: data.created_by
    })
    .select()
    .single();

  if (error) throw error;

  // Update party balance if this expense is associated with a vendor
  if (data.party?.id && data.party?.party_type === 'vendor') {
    try {
      const { data: newBalance, error: balanceError } = await supabase
        .rpc('calculate_party_current_balance', { party_id: data.party.id });

      if (!balanceError && newBalance !== null) {
        await supabase
          .from('parties')
          .update({ current_balance: newBalance })
          .eq('id', data.party.id);
      }
    } catch (balanceUpdateError) {
      console.warn('Vendor balance update warning:', balanceUpdateError.message);
      // Don't fail the transaction for balance update issues
    }
  }

  return {
    expense_id: expense.id,
    party_payment_id: payment.id,
    party_id: data.party?.id || null
  };
}

// New Helper function: Validate simplified expense transaction
async function validateSimplifiedExpenseTransaction(data) {
  const errors = {};
  let isValid = true;

  // Required fields
  if (!data.description || data.description.trim() === '') {
    errors.description = 'Description is required';
    isValid = false;
  }

  if (!data.expense_category || data.expense_category.trim() === '') {
    errors.expense_category = 'Expense category is required';
    isValid = false;
  }

  if (!data.transaction_date) {
    errors.transaction_date = 'Transaction date is required';
    isValid = false;
  }

  // Payment method validation will be handled per category below

  // Validate vendor order specific requirements
  if (data.expense_category === 'Vendor Order') {
    if (!data.items || data.items.length === 0) {
      errors.items = 'At least one item is required for vendor orders';
      isValid = false;
    } else {
      // Validate each item
      data.items.forEach((item, index) => {
        if (!item.product_name && !item.item_name) {
          errors[`items.${index}.item_name`] = 'Item name is required';
          isValid = false;
        }
        if (!item.quantity || item.quantity <= 0) {
          errors[`items.${index}.quantity`] = 'Valid quantity is required';
          isValid = false;
        }
        if (!item.unit_price || item.unit_price < 0) {
          errors[`items.${index}.unit_price`] = 'Valid unit price is required';
          isValid = false;
        }
      });
    }
    
    // For vendor orders, payment method is optional
    const hasValidPaymentMethod = data.payment_method &&
                                  data.payment_method.type !== null &&
                                  data.payment_method.type !== undefined &&
                                  typeof data.payment_method.type === 'string' &&
                                  data.payment_method.type.trim() !== '' &&
                                  data.payment_method.type !== 'none';

    if (hasValidPaymentMethod) {
      // Validate payment method only if provided
      const paymentValidation = validateTxnFields(
        data.payment_method.type,
        data.payment_method.details || {}
      );
      if (!paymentValidation.isValid) {
        errors.payment_method = paymentValidation.errors;
        isValid = false;
      }
    }
  } else if (data.expense_category === 'Vendor Payment') {
    // Vendor payment specific validations
    if (!data.parties || !data.parties[0] || !data.parties[0].party_id) {
      errors.parties = 'Vendor selection is required for vendor payments';
      isValid = false;
    }
    
    if (!data.total_amount || data.total_amount <= 0) {
      errors.total_amount = 'Payment amount must be greater than 0';
      isValid = false;
    }
    
    // Payment method is required for vendor payments
    if (!data.payment_method || !data.payment_method.type) {
      errors.payment_method = 'Payment method is required for vendor payments';
      isValid = false;
    }
  } else {
    // Regular expense - amount is required
    if (!data.total_amount || data.total_amount <= 0) {
      errors.total_amount = 'Valid amount is required';
      isValid = false;
    }
  }
  
  // Validate payment method for non-vendor-order transactions
  if (data.expense_category !== 'Vendor Order') {
    const hasValidPaymentMethod = data.payment_method &&
                                  data.payment_method.type !== null &&
                                  data.payment_method.type !== undefined &&
                                  typeof data.payment_method.type === 'string' &&
                                  data.payment_method.type.trim() !== '' &&
                                  data.payment_method.type !== 'none';

    if (hasValidPaymentMethod) {
      const paymentValidation = validateTxnFields(
        data.payment_method.type,
        data.payment_method.details || {}
      );
      if (!paymentValidation.isValid) {
        errors.payment_method = paymentValidation.errors;
        isValid = false;
      }
    }
  }

  return { isValid, errors };
}

module.exports = router;