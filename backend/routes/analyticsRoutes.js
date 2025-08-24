const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const roleMiddleware = require('../middleware/roleMiddleware');
const { asyncHandler, logger, sendSuccess, sendError } = require('../middleware/errorHandler');
const ExcelJS = require('exceljs');

const router = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Enhanced Analytics API for Store Management
 */

// Expense Analytics
router.get('/expenses', 
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_ANALYTICS),
  asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;
    
    // Get expense summary
    const { data: expenses, error: expensesError } = await supabase
      .from('unified_transactions')
      .select('*')
      .gte('transaction_date', start_date)
      .lte('transaction_date', end_date)
      .eq('transaction_type', 'expense');

    if (expensesError) throw expensesError;

    // Calculate totals and breakdown by category
    const totalAmount = expenses.reduce((sum, exp) => sum + (parseFloat(exp.total_amount) || 0), 0);
    const totalCount = expenses.length;
    
    // Calculate daily average
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
    const dailyAverage = totalAmount / daysDiff;

    // Group by category
    const categoryBreakdown = {};
    expenses.forEach(exp => {
      const category = exp.expense_category || 'Uncategorized';
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { name: category, amount: 0, count: 0 };
      }
      categoryBreakdown[category].amount += parseFloat(exp.total_amount) || 0;
      categoryBreakdown[category].count += 1;
    });

    // Convert to array and add percentages
    const byCategory = Object.values(categoryBreakdown).map(cat => ({
      ...cat,
      percentage: totalAmount > 0 ? (cat.amount / totalAmount) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);

    // Payment method breakdown
    const paymentBreakdown = {};
    expenses.forEach(exp => {
      const method = exp.payment_method?.type || 'Unknown';
      if (!paymentBreakdown[method]) {
        paymentBreakdown[method] = { method, amount: 0, count: 0 };
      }
      paymentBreakdown[method].amount += parseFloat(exp.total_amount) || 0;
      paymentBreakdown[method].count += 1;
    });

    const byPaymentMethod = Object.values(paymentBreakdown);

    logger.info('Expense analytics retrieved', {
      user_id: req.user?.id,
      date_range: { start_date, end_date },
      total_amount: totalAmount,
      total_count: totalCount
    });

    sendSuccess(res, {
      total_amount: totalAmount,
      total_count: totalCount,
      daily_average: dailyAverage,
      by_category: byCategory,
      by_payment_method: byPaymentMethod,
      date_range: { start_date, end_date }
    }, 'Expense analytics retrieved successfully');
  }));

// Inventory Analytics
router.get('/inventory',
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_ANALYTICS),
  asyncHandler(async (req, res) => {
    // Get inventory summary from existing endpoint
    const { data: inventorySummary, error: inventoryError } = await supabase
      .from('products')
      .select(`
        id, name, stock_quantity, min_stock_level, price, unit,
        category:category_id(name)
      `)
      .eq('is_active', true);

    if (inventoryError) throw inventoryError;

    const totalProducts = inventorySummary.length;
    const totalValue = inventorySummary.reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.price || 0)), 0);
    const lowStock = inventorySummary.filter(p => (p.stock_quantity || 0) <= (p.min_stock_level || 0));
    const outOfStock = inventorySummary.filter(p => (p.stock_quantity || 0) <= 0);

    // Category breakdown
    const categoryBreakdown = {};
    inventorySummary.forEach(product => {
      const category = product.category?.name || 'Uncategorized';
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = {
          name: category,
          product_count: 0,
          total_value: 0,
          stock_quantity: 0
        };
      }
      categoryBreakdown[category].product_count += 1;
      categoryBreakdown[category].total_value += (product.stock_quantity || 0) * (product.price || 0);
      categoryBreakdown[category].stock_quantity += product.stock_quantity || 0;
    });

    const byCategory = Object.values(categoryBreakdown);

    logger.info('Inventory analytics retrieved', {
      user_id: req.user?.id,
      total_products: totalProducts,
      total_value: totalValue
    });

    sendSuccess(res, {
      total_products: totalProducts,
      total_value: totalValue,
      low_stock: lowStock.length,
      out_of_stock: outOfStock.length,
      by_category: byCategory,
      low_stock_items: lowStock.slice(0, 10), // Top 10 low stock items
      high_value_items: inventorySummary
        .sort((a, b) => ((b.stock_quantity || 0) * (b.price || 0)) - ((a.stock_quantity || 0) * (a.price || 0)))
        .slice(0, 10)
    }, 'Inventory analytics retrieved successfully');
  }));

// Purchase Order Analytics
router.get('/purchases',
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_ANALYTICS),
  asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;

    const { data: purchaseOrders, error: poError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        party:party_id(name),
        purchase_order_items(*)
      `)
      .gte('order_date', start_date)
      .lte('order_date', end_date);

    if (poError) throw poError;

    const totalAmount = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.final_amount) || 0), 0);
    const totalCount = purchaseOrders.length;

    // Status breakdown
    const statusBreakdown = {};
    purchaseOrders.forEach(po => {
      const status = po.status || 'unknown';
      if (!statusBreakdown[status]) {
        statusBreakdown[status] = { status, count: 0, amount: 0 };
      }
      statusBreakdown[status].count += 1;
      statusBreakdown[status].amount += parseFloat(po.final_amount) || 0;
    });

    const byStatus = Object.values(statusBreakdown);

    // Vendor breakdown
    const vendorBreakdown = {};
    purchaseOrders.forEach(po => {
      const vendor = po.party?.name || 'Unknown';
      if (!vendorBreakdown[vendor]) {
        vendorBreakdown[vendor] = { vendor, count: 0, amount: 0 };
      }
      vendorBreakdown[vendor].count += 1;
      vendorBreakdown[vendor].amount += parseFloat(po.final_amount) || 0;
    });

    const byVendor = Object.values(vendorBreakdown)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // Top 10 vendors

    // Pending items count
    const pendingCount = purchaseOrders.filter(po => 
      ['confirmed', 'partial_received'].includes(po.status)
    ).length;

    logger.info('Purchase analytics retrieved', {
      user_id: req.user?.id,
      date_range: { start_date, end_date },
      total_amount: totalAmount,
      total_count: totalCount
    });

    sendSuccess(res, {
      total_amount: totalAmount,
      total_count: totalCount,
      by_status: byStatus,
      by_vendor: byVendor,
      pending_count: pendingCount,
      date_range: { start_date, end_date }
    }, 'Purchase analytics retrieved successfully');
  }));

// Vendor Analytics
router.get('/vendors',
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_ANALYTICS),
  asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;

    // Get active vendors with their transaction data
    const { data: vendors, error: vendorsError } = await supabase
      .from('parties')
      .select(`
        id, name, party_type, category, current_balance,
        purchase_orders!inner(final_amount, order_date, status)
      `)
      .eq('party_type', 'vendor')
      .eq('is_active', true)
      .gte('purchase_orders.order_date', start_date)
      .lte('purchase_orders.order_date', end_date);

    if (vendorsError) throw vendorsError;

    const totalActive = vendors.length;
    
    // Calculate vendor performance
    const vendorPerformance = vendors.map(vendor => {
      const orders = vendor.purchase_orders || [];
      const totalAmount = orders.reduce((sum, po) => sum + (parseFloat(po.final_amount) || 0), 0);
      const orderCount = orders.length;
      const completedOrders = orders.filter(po => po.status === 'received').length;
      const completionRate = orderCount > 0 ? (completedOrders / orderCount) * 100 : 0;

      return {
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        current_balance: vendor.current_balance,
        order_count: orderCount,
        total_amount: totalAmount,
        completion_rate: completionRate,
        average_order_value: orderCount > 0 ? totalAmount / orderCount : 0
      };
    }).sort((a, b) => b.total_amount - a.total_amount);

    logger.info('Vendor analytics retrieved', {
      user_id: req.user?.id,
      date_range: { start_date, end_date },
      total_active: totalActive
    });

    sendSuccess(res, {
      total_active: totalActive,
      vendor_performance: vendorPerformance.slice(0, 20), // Top 20 vendors
      top_vendors: vendorPerformance.slice(0, 5),
      date_range: { start_date, end_date }
    }, 'Vendor analytics retrieved successfully');
  }));

// Financial Summary Analytics
router.get('/financials',
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_ANALYTICS),
  asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;

    // Get all financial data
    const [expensesResult, purchasesResult, paymentsResult] = await Promise.all([
      supabase
        .from('unified_transactions')
        .select('total_amount, transaction_date')
        .eq('transaction_type', 'expense')
        .gte('transaction_date', start_date)
        .lte('transaction_date', end_date),
      supabase
        .from('purchase_orders')
        .select('final_amount, order_date')
        .gte('order_date', start_date)
        .lte('order_date', end_date),
      supabase
        .from('party_payments')
        .select('amount, payment_date')
        .gte('payment_date', start_date)
        .lte('payment_date', end_date)
    ]);

    if (expensesResult.error) throw expensesResult.error;
    if (purchasesResult.error) throw purchasesResult.error;
    if (paymentsResult.error) throw paymentsResult.error;

    const totalExpenses = expensesResult.data.reduce((sum, exp) => sum + (parseFloat(exp.total_amount) || 0), 0);
    const totalPurchases = purchasesResult.data.reduce((sum, po) => sum + (parseFloat(po.final_amount) || 0), 0);
    const totalPayments = paymentsResult.data.reduce((sum, pay) => sum + (parseFloat(pay.amount) || 0), 0);

    // Daily trends (last 30 days)
    const dailyTrends = {};
    const last30Days = Array.from({length: 30}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    });

    last30Days.forEach(date => {
      dailyTrends[date] = {
        date,
        expenses: 0,
        purchases: 0,
        payments: 0
      };
    });

    expensesResult.data.forEach(exp => {
      const date = exp.transaction_date;
      if (dailyTrends[date]) {
        dailyTrends[date].expenses += parseFloat(exp.total_amount) || 0;
      }
    });

    purchasesResult.data.forEach(po => {
      const date = po.order_date;
      if (dailyTrends[date]) {
        dailyTrends[date].purchases += parseFloat(po.final_amount) || 0;
      }
    });

    paymentsResult.data.forEach(pay => {
      const date = pay.payment_date.split('T')[0]; // Extract date part
      if (dailyTrends[date]) {
        dailyTrends[date].payments += parseFloat(pay.amount) || 0;
      }
    });

    const trends = Object.values(dailyTrends).sort((a, b) => new Date(a.date) - new Date(b.date));

    logger.info('Financial analytics retrieved', {
      user_id: req.user?.id,
      date_range: { start_date, end_date },
      total_expenses: totalExpenses,
      total_purchases: totalPurchases
    });

    sendSuccess(res, {
      total_expenses: totalExpenses,
      total_purchases: totalPurchases,
      total_payments: totalPayments,
      net_outflow: totalExpenses + totalPurchases - totalPayments,
      daily_trends: trends,
      date_range: { start_date, end_date }
    }, 'Financial analytics retrieved successfully');
  }));

// Export comprehensive report
router.get('/comprehensive/export',
  roleMiddleware.requirePermission(roleMiddleware.ADMIN_PERMISSIONS.VIEW_ANALYTICS),
  asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;

    // Create new workbook
    const workbook = new ExcelJS.Workbook();
    
    // Add metadata
    workbook.creator = 'GovindJi Dry Fruits Store Management';
    workbook.created = new Date();
    
    // Get all data in parallel
    const [expensesResult, inventoryResult, purchasesResult] = await Promise.all([
      supabase
        .from('unified_transactions')
        .select('*')
        .eq('transaction_type', 'expense')
        .gte('transaction_date', start_date)
        .lte('transaction_date', end_date)
        .order('transaction_date', { ascending: false }),
      supabase
        .from('products')
        .select('id, name, stock_quantity, min_stock_level, price, unit, category:category_id(name)')
        .eq('is_active', true),
      supabase
        .from('purchase_orders')
        .select('*, party:party_id(name)')
        .gte('order_date', start_date)
        .lte('order_date', end_date)
        .order('order_date', { ascending: false })
    ]);

    // Expenses Sheet
    const expenseSheet = workbook.addWorksheet('Expenses');
    expenseSheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Payment Method', key: 'payment_method', width: 15 },
      { header: 'Reference', key: 'reference', width: 20 }
    ];
    
    expensesResult.data.forEach(expense => {
      expenseSheet.addRow({
        date: expense.transaction_date,
        description: expense.description,
        category: expense.expense_category,
        amount: parseFloat(expense.total_amount) || 0,
        payment_method: expense.payment_method?.type || 'Unknown',
        reference: expense.reference_number
      });
    });

    // Inventory Sheet
    const inventorySheet = workbook.addWorksheet('Inventory');
    inventorySheet.columns = [
      { header: 'Product Name', key: 'name', width: 25 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Current Stock', key: 'stock', width: 15 },
      { header: 'Min Level', key: 'min_level', width: 15 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Price', key: 'price', width: 15 },
      { header: 'Total Value', key: 'total_value', width: 15 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    inventoryResult.data.forEach(product => {
      const currentStock = product.stock_quantity || 0;
      const minLevel = product.min_stock_level || 0;
      const status = currentStock <= 0 ? 'Out of Stock' : 
                    currentStock <= minLevel ? 'Low Stock' : 'In Stock';
      
      inventorySheet.addRow({
        name: product.name,
        category: product.category?.name || 'Uncategorized',
        stock: currentStock,
        min_level: minLevel,
        unit: product.unit,
        price: parseFloat(product.price) || 0,
        total_value: currentStock * (parseFloat(product.price) || 0),
        status: status
      });
    });

    // Purchase Orders Sheet
    const purchaseSheet = workbook.addWorksheet('Purchase Orders');
    purchaseSheet.columns = [
      { header: 'PO Number', key: 'po_number', width: 20 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Vendor', key: 'vendor', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];

    purchasesResult.data.forEach(po => {
      purchaseSheet.addRow({
        po_number: po.po_number,
        date: po.order_date,
        vendor: po.party?.name || 'Unknown',
        status: po.status,
        amount: parseFloat(po.final_amount) || 0,
        notes: po.notes
      });
    });

    // Style headers
    [expenseSheet, inventorySheet, purchaseSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F3FF' }
      };
    });

    // Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=store-report-${start_date}-${end_date}.xlsx`);

    // Write to response
    await workbook.xlsx.write(res);
    
    logger.info('Comprehensive report exported', {
      user_id: req.user?.id,
      date_range: { start_date, end_date }
    });
    
    res.end();
  }));

module.exports = router;