import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import paymentAPI from '../services/paymentApi';
import './PaymentVerify.css';

/**
 * Payment Verification Page
 * Polls payment status and shows success/failure state
 */
function PaymentVerify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();

  const [status, setStatus] = useState('verifying'); // verifying, success, failed
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [error, setError] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const maxPolls = 30; // Poll for max 60 seconds (30 * 2 seconds)

  useEffect(() => {
    verifyPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyPayment = async () => {
    try {
      // Get transaction ID from URL or localStorage
      const txnId = searchParams.get('txnId') || localStorage.getItem('currentTransactionId');

      if (!txnId) {
        setStatus('failed');
        setError('No transaction ID found');
        return;
      }

      console.log('Verifying payment for transaction:', txnId);

      // Check payment status
      const response = await paymentAPI.checkPaymentStatus(txnId);

      if (response.success) {
        setTransactionDetails(response.transaction);

        if (response.transaction.status === 'COMPLETED') {
          setStatus('success');
          clearCart();

          // Clean up localStorage
          localStorage.removeItem('currentTransactionId');
          localStorage.removeItem('currentOrderId');

          console.log('Payment verified successfully');
        } else if (response.transaction.status === 'FAILED') {
          setStatus('failed');
          setError('Payment failed. Please try again.');
        } else {
          // Still pending, poll again after 2 seconds
          if (pollCount < maxPolls) {
            setPollCount(pollCount + 1);
            setTimeout(verifyPayment, 2000);
          } else {
            // Timeout - payment is taking too long
            setStatus('failed');
            setError('Payment verification timed out. Please check your orders page.');
          }
        }
      } else {
        setStatus('failed');
        setError('Failed to verify payment status');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setStatus('failed');
      setError(error.response?.data?.error || 'Failed to verify payment');
    }
  };

  if (status === 'verifying') {
    return (
      <div className="payment-verify-page">
        <div className="verify-container">
          <div className="spinner-wrapper">
            <div className="spinner"></div>
          </div>
          <h2>Verifying Payment</h2>
          <p className="verify-message">Please wait while we confirm your payment with PhonePe.</p>
          <div className="progress-indicator">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min((pollCount / maxPolls) * 100, 100)}%` }}></div>
            </div>
            <p className="poll-info">Checking status... ({pollCount}/{maxPolls})</p>
          </div>
          <p className="note">Do not close this window or press the back button.</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="payment-verify-page">
        <div className="verify-container success">
          <div className="icon-wrapper success-icon">
            <svg className="checkmark" viewBox="0 0 52 52">
              <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
          </div>
          <h2>Payment Successful!</h2>
          <p className="success-message">Your order has been confirmed and is being processed.</p>

          {transactionDetails && (
            <div className="transaction-details">
              <div className="detail-row">
                <span className="detail-label">Order ID</span>
                <span className="detail-value">{transactionDetails.orderId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Transaction ID</span>
                <span className="detail-value">{transactionDetails.merchantTransactionId}</span>
              </div>
              <div className="detail-row highlight">
                <span className="detail-label">Amount Paid</span>
                <span className="detail-value">₹{parseFloat(transactionDetails.amount).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="action-buttons">
            <button onClick={() => navigate('/orders')} className="btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H2v14h7V5z"/>
                <path d="M16 5h7v14h-7V5z"/>
                <path d="M7 12h10"/>
              </svg>
              View My Orders
            </button>
            <button onClick={() => navigate('/products')} className="btn-secondary">
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="payment-verify-page">
        <div className="verify-container failed">
          <div className="icon-wrapper failed-icon">
            <svg className="crossmark" viewBox="0 0 52 52">
              <circle className="crossmark-circle" cx="26" cy="26" r="25" fill="none"/>
              <path className="crossmark-cross" fill="none" d="M16 16 L36 36 M36 16 L16 36"/>
            </svg>
          </div>
          <h2>Payment Failed</h2>
          <p className="error-message">{error || 'We could not process your payment. Please try again.'}</p>

          {transactionDetails && (
            <div className="transaction-details">
              <div className="detail-row">
                <span className="detail-label">Transaction ID</span>
                <span className="detail-value">{transactionDetails.merchantTransactionId}</span>
              </div>
            </div>
          )}

          <div className="help-section">
            <h4>Need Help?</h4>
            <p>If money was deducted from your account, it will be refunded within 5-7 business days.</p>
          </div>

          <div className="action-buttons">
            <button onClick={() => navigate('/checkout')} className="btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
              Try Again
            </button>
            <button onClick={() => navigate('/orders')} className="btn-secondary">
              View Orders
            </button>
            <button onClick={() => navigate('/products')} className="btn-tertiary">
              Back to Products
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default PaymentVerify;
