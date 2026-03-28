const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const paymentService = require('../services/payment/PaymentService');
const deliveryService = require('../services/delivery/DeliveryService');
const orderRecoveryService = require('../services/order/OrderRecoveryService');
const { authenticateToken } = require('../middleware/authMiddleware');
const { createBackendSupabaseClient } = require('../config/supabaseClient');

const getPaymentFailureStatus = (state = '') => {
  const normalizedState = String(state || '').toUpperCase();

  if (normalizedState === 'EXPIRED') {
    return 'EXPIRED';
  }

  if (['FAILED', 'CANCELLED', 'PAYMENT_ERROR'].includes(normalizedState)) {
    return 'FAILED';
  }

  return null;
};

const getPaymentErrorMessage = (error, fallback = 'Payment initiation failed') => (
  error?.error ||
  error?.message ||
  fallback
);

const ACTIVE_TRANSACTION_STATUSES = ['INITIATED', 'PENDING'];
const TERMINAL_TRANSACTION_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'];

const updateTransaction = async (supabase, merchantTransactionId, updates) => {
  await supabase
    .from('payment_transactions')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('merchant_transaction_id', merchantTransactionId);
};

const getInactiveOrderMessage = (order) => {
  if (!order) {
    return 'Order not found';
  }

  if (order.payment_status === 'PAID') {
    return 'Order is already marked as paid';
  }

  if (order.status) {
    return `Order is already ${order.status}`;
  }

  return 'Order can no longer accept payment';
};

/**
 * POST /api/payments/initiate
 * Initiate a payment transaction
 */
router.post('/initiate', authenticateToken, async (req, res) => {
  let transaction = null;

  try {
    const { orderId, amount, customerInfo, paymentMethod = 'PHONEPE' } = req.body;

    console.log('Payment initiation request:', { orderId, amount, paymentMethod, userId: req.user.id });

    // Validate request
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: orderId'
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

    if (order.payment_status === 'PAID') {
      return res.status(400).json({
        success: false,
        error: 'This order has already been paid.'
      });
    }

    if (['cancelled', 'completed', 'delivered'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: 'This order can no longer accept payment. Please place a new order.'
      });
    }

    const orderAmount = Number.parseFloat(order.total_amount);
    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Order total is invalid for payment'
      });
    }

    if (amount && Number.parseFloat(amount) !== orderAmount) {
      console.warn('Ignoring client-sent payment amount in favor of order total', {
        orderId,
        clientAmount: amount,
        orderAmount,
        userId: req.user.id
      });
    }

    const { data: activeTransaction, error: activeTransactionError } = await req.supabase
      .from('payment_transactions')
      .select('merchant_transaction_id, status')
      .eq('order_id', orderId)
      .in('status', ACTIVE_TRANSACTION_STATUSES)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeTransactionError) {
      console.error('Active transaction lookup error:', activeTransactionError);
      return res.status(500).json({ success: false, error: 'Failed to validate payment state' });
    }

    if (activeTransaction) {
      return res.status(409).json({
        success: false,
        error: 'A payment attempt is already in progress for this order. Please complete or wait for that attempt to finish.'
      });
    }

    // Create payment transaction record
    const { data: createdTransaction, error: txError } = await req.supabase
      .from('payment_transactions')
      .insert({
        merchant_transaction_id: merchantTransactionId,
        order_id: orderId,
        user_id: req.user.id,
        amount: orderAmount,
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

    transaction = createdTransaction;

    console.log('Payment transaction created:', merchantTransactionId);

    // Initiate payment with gateway
    const paymentResponse = await paymentService.initiatePayment(paymentMethod, {
      amount: Math.round(orderAmount * 100), // Convert to paise
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

      await orderRecoveryService.cancelUnpaidOrder(orderId, {
        paymentStatus: 'FAILED',
      });

      console.error('Payment initiation failed:', paymentResponse.error);

      return res.status(500).json({
        success: false,
        error: paymentResponse.error
      });
    }
  } catch (error) {
    if (transaction?.merchant_transaction_id) {
      await req.supabase
        .from('payment_transactions')
        .update({
          status: 'FAILED',
          error_details: { error: getPaymentErrorMessage(error) },
          updated_at: new Date().toISOString()
        })
        .eq('merchant_transaction_id', transaction.merchant_transaction_id);
    }

    if (transaction?.order_id) {
      try {
        await orderRecoveryService.cancelUnpaidOrder(transaction.order_id, {
          paymentStatus: 'FAILED',
        });
      } catch (recoveryError) {
        console.error('Failed to recover order after payment initiation error:', recoveryError);
      }
    }

    console.error('Payment initiation error:', error);
    res.status(500).json({
      success: false,
      error: getPaymentErrorMessage(error, 'Internal server error')
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
    const supabase = createBackendSupabaseClient({
      preferServiceRole: true,
      allowAnonFallback: false
    });

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

    // Prevent double processing for already terminal transactions
    if (TERMINAL_TRANSACTION_STATUSES.includes(transaction.status)) {
      console.log('Transaction already processed:', transaction.status);
      return res.json({ success: true, message: 'Already processed' });
    }

    const currentOrder = await orderRecoveryService.getOrderWithItems(transaction.order_id);

    if (paymentSuccess) {
      if (currentOrder?.payment_status === 'PAID') {
        await updateTransaction(supabase, merchantTransactionId, {
          status: 'COMPLETED',
          phonepe_transaction_id: paymentData.transactionId,
          callback_response: paymentData,
          completed_at: transaction.completed_at || new Date().toISOString(),
          error_details: null
        });
      } else if (!orderRecoveryService.canAcceptPayment(currentOrder)) {
        await updateTransaction(supabase, merchantTransactionId, {
          status: 'FAILED',
          phonepe_transaction_id: paymentData.transactionId,
          callback_response: paymentData,
          error_details: {
            code: 'IGNORED_SUCCESS',
            message: getInactiveOrderMessage(currentOrder)
          }
        });

        console.warn('Ignoring payment success for inactive order during callback', {
          orderId: transaction.order_id,
          orderStatus: currentOrder?.status,
          paymentStatus: currentOrder?.payment_status
        });
      } else {
        await updateTransaction(supabase, merchantTransactionId, {
          status: 'COMPLETED',
          phonepe_transaction_id: paymentData.transactionId,
          callback_response: paymentData,
          completed_at: new Date().toISOString(),
          error_details: null
        });

        await supabase
          .from('orders')
          .update({
            payment_status: 'PAID',
            payment_method: 'PHONEPE',
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.order_id);

        try {
          const fulfillmentResult = await deliveryService.processOrderForFulfillment(transaction.order_id);
          if (!fulfillmentResult.success) {
            console.warn('Automatic fulfillment after payment callback completed with warnings:', fulfillmentResult);
          }
        } catch (deliveryError) {
          console.error('Automatic fulfillment after payment callback failed:', deliveryError);
        }
      }

      console.log('Order payment completed:', transaction.order_id);
    } else {
      await updateTransaction(supabase, merchantTransactionId, {
        status: 'FAILED',
        phonepe_transaction_id: paymentData.transactionId,
        callback_response: paymentData,
        error_details: {
          code: paymentCode,
          message: paymentData.message
        }
      });

      await orderRecoveryService.cancelUnpaidOrder(transaction.order_id, {
        paymentStatus: 'FAILED',
      });

      console.log('Order payment failed, order cancelled, stock restored:', transaction.order_id);
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
          const failureStatus = getPaymentFailureStatus(paymentState);
          const currentOrder = await orderRecoveryService.getOrderWithItems(transaction.order_id);

          // Update transaction based on PhonePe response
          if (paymentState === 'COMPLETED' && transaction.status !== 'COMPLETED') {
            if (currentOrder?.payment_status === 'PAID') {
              const completedAt = transaction.completed_at || new Date().toISOString();
              await updateTransaction(req.supabase, merchantTransactionId, {
                status: 'COMPLETED',
                completed_at: completedAt,
                payment_response: statusResponse.data,
                error_details: null
              });
              transaction.completed_at = completedAt;
            } else if (!orderRecoveryService.canAcceptPayment(currentOrder)) {
              await updateTransaction(req.supabase, merchantTransactionId, {
                status: 'FAILED',
                payment_response: statusResponse.data,
                error_details: {
                  state: 'IGNORED_SUCCESS',
                  message: getInactiveOrderMessage(currentOrder)
                }
              });

              console.warn('Ignoring payment success for inactive order during status sync', {
                orderId: transaction.order_id,
                orderStatus: currentOrder?.status,
                paymentStatus: currentOrder?.payment_status
              });
            } else {
              const completedAt = new Date().toISOString();
              await updateTransaction(req.supabase, merchantTransactionId, {
                status: 'COMPLETED',
                completed_at: completedAt,
                payment_response: statusResponse.data,
                error_details: null
              });
              transaction.completed_at = completedAt;

              await req.supabase
                .from('orders')
                .update({
                  payment_status: 'PAID',
                  updated_at: new Date().toISOString()
                })
                .eq('id', transaction.order_id);

              try {
                const fulfillmentResult = await deliveryService.processOrderForFulfillment(transaction.order_id);
                if (!fulfillmentResult.success) {
                  console.warn('Automatic fulfillment after payment status sync completed with warnings:', fulfillmentResult);
                }
              } catch (deliveryError) {
                console.error('Automatic fulfillment after payment status sync failed:', deliveryError);
              }
            }

            transaction.status = currentOrder?.payment_status === 'PAID' || orderRecoveryService.canAcceptPayment(currentOrder)
              ? 'COMPLETED'
              : 'FAILED';
            console.log(`Payment status updated to ${transaction.status}`);
          } else if (failureStatus && !['FAILED', 'EXPIRED'].includes(transaction.status)) {
            await updateTransaction(req.supabase, merchantTransactionId, {
              status: failureStatus,
              payment_response: statusResponse.data,
              error_details: {
                state: paymentState,
                message: statusResponse.data.message || 'Payment was not completed'
              }
            });

            await orderRecoveryService.cancelUnpaidOrder(transaction.order_id, {
              paymentStatus: failureStatus,
            });

            transaction.status = failureStatus;
            console.log(`Payment status updated to ${failureStatus}`);
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
