const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const paymentService = require('../services/payment/PaymentService');

// Note: authenticateToken middleware should be imported from your auth middleware
// const { authenticateToken } = require('../middleware/auth');

// Temporary middleware for development - replace with actual auth
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    // Initialize supabase client if not already done
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

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

/**
 * POST /api/payments/initiate
 * Initiate a payment transaction
 */
router.post('/initiate', authenticateToken, async (req, res) => {
  try {
    const { orderId, amount, customerInfo, paymentMethod = 'PHONEPE' } = req.body;

    console.log('Payment initiation request:', { orderId, amount, paymentMethod, userId: req.user.id });

    // Validate request
    if (!orderId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, amount'
      });
    }

    // Generate unique merchant transaction ID
    const merchantTransactionId = `TXN_${Date.now()}_${uuidv4().split('-')[0]}`;

    // Get order details
    const { data: order, error: orderError } = await req.supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', req.user.id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Create payment transaction record
    const { data: transaction, error: txError } = await req.supabase
      .from('payment_transactions')
      .insert({
        merchant_transaction_id: merchantTransactionId,
        order_id: orderId,
        user_id: req.user.id,
        amount: amount,
        currency: 'INR',
        payment_method: paymentMethod,
        status: 'INITIATED',
        redirect_url: `${process.env.FRONTEND_URL}/payment/verify`,
        callback_url: `${process.env.BACKEND_URL}/api/payments/callback`
      })
      .select()
      .single();

    if (txError) {
      console.error('Transaction creation error:', txError);
      return res.status(500).json({ success: false, error: 'Failed to create transaction' });
    }

    console.log('Payment transaction created:', merchantTransactionId);

    // Initiate payment with gateway
    const paymentResponse = await paymentService.initiatePayment(paymentMethod, {
      amount: Math.round(amount * 100), // Convert to paise
      merchantTransactionId: merchantTransactionId,
      orderId: orderId,
      redirectUrl: `${process.env.FRONTEND_URL}/payment/verify?txnId=${merchantTransactionId}`,
      callbackUrl: `${process.env.BACKEND_URL}/api/payments/callback`,
      customerInfo: {
        userId: req.user.id,
        phone: customerInfo?.phone || order.customer_phone,
        email: customerInfo?.email || order.customer_email
      }
    });

    if (paymentResponse.success) {
      // Update transaction with payment URL and PhonePe transaction ID
      await req.supabase
        .from('payment_transactions')
        .update({
          phonepe_transaction_id: paymentResponse.phonepeTransactionId,
          payment_response: paymentResponse.response,
          status: 'PENDING',
          updated_at: new Date().toISOString()
        })
        .eq('merchant_transaction_id', merchantTransactionId);

      console.log('Payment initiated successfully:', paymentResponse.paymentUrl);

      return res.json({
        success: true,
        paymentUrl: paymentResponse.paymentUrl,
        merchantTransactionId: merchantTransactionId
      });
    } else {
      // Update transaction as failed
      await req.supabase
        .from('payment_transactions')
        .update({
          status: 'FAILED',
          error_details: { error: paymentResponse.error },
          updated_at: new Date().toISOString()
        })
        .eq('merchant_transaction_id', merchantTransactionId);

      console.error('Payment initiation failed:', paymentResponse.error);

      return res.status(500).json({
        success: false,
        error: paymentResponse.error
      });
    }
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/payments/callback
 * Receive payment status callback from PhonePe
 */
router.post('/callback', async (req, res) => {
  try {
    const payload = req.body;
    const headers = req.headers;

    console.log('Received payment callback');

    // Initialize Supabase for callback handling
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for callback
    );

    // Verify callback signature
    const verification = await paymentService.verifyCallback('PHONEPE', payload, headers);

    if (!verification.valid) {
      console.error('Invalid callback signature');
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }

    const paymentData = verification.data;
    const merchantTransactionId = paymentData.merchantTransactionId;
    const paymentSuccess = paymentData.success;
    const paymentCode = paymentData.code;

    console.log('Callback data:', { merchantTransactionId, paymentSuccess, paymentCode });

    // Get transaction from database
    const { data: transaction, error: txError } = await supabase
      .from('payment_transactions')
      .select('*, orders(*)')
      .eq('merchant_transaction_id', merchantTransactionId)
      .single();

    if (txError || !transaction) {
      console.error('Transaction not found:', merchantTransactionId);
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // Prevent double processing
    if (transaction.status === 'COMPLETED') {
      console.log('Transaction already processed');
      return res.json({ success: true, message: 'Already processed' });
    }

    // Update payment transaction
    const newStatus = paymentSuccess ? 'COMPLETED' : 'FAILED';
    const updateData = {
      status: newStatus,
      phonepe_transaction_id: paymentData.transactionId,
      callback_response: paymentData,
      updated_at: new Date().toISOString()
    };

    if (paymentSuccess) {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.error_details = {
        code: paymentCode,
        message: paymentData.message
      };
    }

    await supabase
      .from('payment_transactions')
      .update(updateData)
      .eq('merchant_transaction_id', merchantTransactionId);

    // Update order payment status
    if (paymentSuccess) {
      await supabase
        .from('orders')
        .update({
          payment_status: 'PAID',
          payment_method: 'PHONEPE',
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.order_id);

      console.log('Order payment completed:', transaction.order_id);
    } else {
      await supabase
        .from('orders')
        .update({
          payment_status: 'FAILED',
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.order_id);

      console.log('Order payment failed:', transaction.order_id);
    }

    res.json({ success: true, message: 'Callback processed' });
  } catch (error) {
    console.error('Callback processing error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/payments/status/:merchantTransactionId
 * Check payment status
 */
router.get('/status/:merchantTransactionId', authenticateToken, async (req, res) => {
  try {
    const { merchantTransactionId } = req.params;

    console.log('Checking payment status for:', merchantTransactionId);

    // Get transaction from database
    const { data: transaction, error: txError } = await req.supabase
      .from('payment_transactions')
      .select('*, orders(*)')
      .eq('merchant_transaction_id', merchantTransactionId)
      .single();

    if (txError || !transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // Verify user owns this transaction
    if (transaction.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // If status is still pending, check with PhonePe
    if (transaction.status === 'PENDING' || transaction.status === 'INITIATED') {
      try {
        const statusResponse = await paymentService.checkPaymentStatus(
          transaction.payment_method,
          merchantTransactionId
        );

        if (statusResponse.success && statusResponse.data) {
          const paymentState = statusResponse.data.state;

          // Update transaction based on PhonePe response
          if (paymentState === 'COMPLETED' && transaction.status !== 'COMPLETED') {
            await req.supabase
              .from('payment_transactions')
              .update({
                status: 'COMPLETED',
                completed_at: new Date().toISOString(),
                payment_response: statusResponse.data,
                updated_at: new Date().toISOString()
              })
              .eq('merchant_transaction_id', merchantTransactionId);

            await req.supabase
              .from('orders')
              .update({
                payment_status: 'PAID',
                updated_at: new Date().toISOString()
              })
              .eq('id', transaction.order_id);

            transaction.status = 'COMPLETED';
            console.log('Payment status updated to COMPLETED');
          }
        }
      } catch (statusError) {
        console.error('Status check error:', statusError);
        // Continue with existing status if check fails
      }
    }

    res.json({
      success: true,
      transaction: {
        merchantTransactionId: transaction.merchant_transaction_id,
        orderId: transaction.order_id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        paymentMethod: transaction.payment_method,
        createdAt: transaction.initiated_at,
        completedAt: transaction.completed_at
      }
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
