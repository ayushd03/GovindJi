const express = require('express');
const router = express.Router();

// Note: authenticateAdmin middleware should be imported from your auth middleware
// const { authenticateAdmin } = require('../middleware/auth');

// Temporary middleware for development - replace with actual admin auth
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    // Initialize supabase client
    if (!req.supabase) {
      const { createClient } = require('@supabase/supabase-js');
      req.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
          global: {
            headers: { Authorization: `Bearer ${token}` }
          }
        }
      );
    }

    // Get user from token
    const { data: { user }, error } = await req.supabase.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await req.supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

/**
 * GET /api/admin/payments
 * Get all payment transactions with filtering
 */
router.get('/payments', authenticateAdmin, async (req, res) => {
  try {
    const { status, payment_method, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = req.supabase
      .from('payment_transactions')
      .select(`
        *,
        orders (
          id,
          total_amount,
          status,
          customer_email,
          customer_phone
        ),
        users (
          id,
          email,
          name
        )
      `, { count: 'exact' })
      .order('initiated_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (payment_method) {
      query = query.eq('payment_method', payment_method);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Admin payments fetch error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch payments' });
    }

    res.json({
      success: true,
      payments: data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Admin payments error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/payments/stats/summary
 * Get payment statistics
 */
router.get('/payments/stats/summary', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('payment_transactions')
      .select('status, amount, payment_method, initiated_at');

    if (error) {
      return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }

    // Calculate statistics
    const stats = {
      total_transactions: data.length,
      completed: data.filter(t => t.status === 'COMPLETED').length,
      failed: data.filter(t => t.status === 'FAILED').length,
      pending: data.filter(t => t.status === 'PENDING').length,
      total_amount: data
        .filter(t => t.status === 'COMPLETED')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0),
      by_method: {},
      today: {
        transactions: 0,
        amount: 0
      }
    };

    // Group by payment method
    data.forEach(t => {
      if (!stats.by_method[t.payment_method]) {
        stats.by_method[t.payment_method] = {
          count: 0,
          amount: 0
        };
      }
      stats.by_method[t.payment_method].count++;
      if (t.status === 'COMPLETED') {
        stats.by_method[t.payment_method].amount += parseFloat(t.amount);
      }
    });

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    data.forEach(t => {
      if (t.initiated_at.startsWith(today)) {
        stats.today.transactions++;
        if (t.status === 'COMPLETED') {
          stats.today.amount += parseFloat(t.amount);
        }
      }
    });

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Payment stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/payments/:id
 * Get payment transaction details
 */
router.get('/payments/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await req.supabase
      .from('payment_transactions')
      .select(`
        *,
        orders (
          *,
          order_items (
            *,
            products (*)
          )
        ),
        users (*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    res.json({ success: true, payment: data });
  } catch (error) {
    console.error('Payment details error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
