const express = require('express');
const router = express.Router();
const roleMiddleware = require('../middleware/roleMiddleware');
const { extractAuthToken } = require('../middleware/authMiddleware');
const { createBackendSupabaseClient } = require('../config/supabaseClient');
const { parsePageLimit, buildPagePagination } = require('../utils/pagination');

const attachScopedSupabase = (req, res, next) => {
  try {
    if (!req.supabase) {
      const token = extractAuthToken(req);
      req.supabase = createBackendSupabaseClient({
        options: {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
          global: token
            ? {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            : undefined,
        },
      });
    }

    next();
  } catch (error) {
    console.error('Admin payments supabase attach error:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize payment admin session' });
  }
};

router.use(roleMiddleware.authenticateAdmin, attachScopedSupabase);

/**
 * GET /api/admin/payments
 * Get all payment transactions with filtering
 */
router.get('/payments', async (req, res) => {
  try {
    const { status, payment_method } = req.query;
    const { page, limit, offset } = parsePageLimit(req.query, {
      defaultLimit: 50,
      minLimit: 1,
      maxLimit: 200
    });

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
      .range(offset, offset + limit - 1);

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

    const pagination = buildPagePagination({
      total: count || 0,
      page,
      limit
    });

    res.json({
      success: true,
      payments: data || [],
      pagination
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
router.get('/payments/stats/summary', async (req, res) => {
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
router.get('/payments/:id', async (req, res) => {
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
