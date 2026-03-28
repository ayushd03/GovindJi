import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useCart } from '../context/CartContext';
import paymentAPI from '../services/paymentApi';

function PaymentVerify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();

  const [status, setStatus] = useState('verifying');
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [error, setError] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const pollCountRef = useRef(0);
  const timerRef = useRef(null);
  const maxPolls = 30;

  const clearPaymentSession = useCallback(() => {
    localStorage.removeItem('currentTransactionId');
    localStorage.removeItem('currentOrderId');
  }, []);

  const verifyPayment = useCallback(async () => {
    try {
      const txnId = searchParams.get('txnId') || localStorage.getItem('currentTransactionId');

      if (!txnId) {
        setStatus('failed');
        setError('No transaction ID found for this payment attempt.');
        return;
      }

      const response = await paymentAPI.checkPaymentStatus(txnId);

      if (!response.success) {
        setStatus('failed');
        setError('Failed to verify payment status.');
        return;
      }

      setTransactionDetails(response.transaction);

      if (response.transaction.status === 'COMPLETED') {
        setStatus('success');
        clearCart();
        clearPaymentSession();
        return;
      }

      if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(response.transaction.status)) {
        setStatus('failed');
        clearPaymentSession();
        setError(
          response.transaction.status === 'EXPIRED'
            ? 'Payment session expired. Please place the order again.'
            : 'Payment failed. Please try again.'
        );
        return;
      }

      pollCountRef.current += 1;
      setPollCount(pollCountRef.current);

      if (pollCountRef.current < maxPolls) {
        timerRef.current = setTimeout(verifyPayment, 2000);
        return;
      }

      setStatus('failed');
      setError('Payment verification timed out. Please check your orders page.');
    } catch (verificationError) {
      setStatus('failed');
      setError(verificationError.response?.data?.error || 'Failed to verify payment.');
    }
  }, [clearCart, clearPaymentSession, searchParams]);

  useEffect(() => {
    verifyPayment();
    return () => clearTimeout(timerRef.current);
  }, [verifyPayment]);

  const retryPayment = async () => {
    const orderId = localStorage.getItem('currentOrderId');
    if (!orderId) {
      navigate('/checkout');
      return;
    }
    try {
      const paymentResponse = await paymentAPI.initiatePayment(orderId, {}, 'PHONEPE');
      if (paymentResponse.success && paymentResponse.paymentUrl) {
        localStorage.setItem('currentTransactionId', paymentResponse.merchantTransactionId);
        window.location.href = paymentResponse.paymentUrl;
      } else {
        clearPaymentSession();
        navigate('/checkout');
      }
    } catch {
      clearPaymentSession();
      navigate('/checkout');
    }
  };

  const progressWidth = `${Math.min((pollCount / maxPolls) * 100, 100)}%`;

  return (
    <div className="page-shell-soft py-8">
      <div className="page-container">
        <div className="mx-auto max-w-3xl surface-section overflow-hidden">
          <div className="border-b bg-[#23442a] px-6 py-5 text-white sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <ShieldCheckIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Order Payment</p>
                <h1 className="mt-1 font-heading text-2xl font-semibold">Payment verification</h1>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8">
            {status === 'verifying' && (
              <div className="space-y-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#23442a]/8">
                  <ArrowPathIcon className="h-10 w-10 animate-spin text-[#23442a]" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">Confirming your payment</h2>
                  <p className="mt-3 text-base leading-7 text-muted-foreground">
                    Please stay on this page while we verify the payment response and attach it to your order.
                  </p>
                </div>
                <div className="mx-auto max-w-xl rounded-2xl border bg-muted/25 p-5 text-left">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">Verification progress</span>
                    <span className="text-muted-foreground">
                      {pollCount}/{maxPolls}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[#23442a] transition-all duration-300" style={{ width: progressWidth }} />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Do not close this window or use the browser back button during payment verification.
                  </p>
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircleIcon className="h-10 w-10 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">Payment successful</h2>
                  <p className="mt-3 text-base leading-7 text-muted-foreground">
                    Your payment has been confirmed and the order is now in process.
                  </p>
                </div>

                {transactionDetails && (
                  <div className="mx-auto grid max-w-2xl gap-4 rounded-2xl border bg-muted/20 p-5 text-left sm:grid-cols-2">
                    <div className="surface-card-muted p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Order ID</p>
                      <p className="mt-2 break-all text-sm font-semibold text-foreground">{transactionDetails.orderId}</p>
                    </div>
                    <div className="surface-card-muted p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Transaction ID</p>
                      <p className="mt-2 break-all text-sm font-semibold text-foreground">
                        {transactionDetails.merchantTransactionId}
                      </p>
                    </div>
                    <div className="surface-card-muted p-4 sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Amount Paid</p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        ₹{parseFloat(transactionDetails.amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <button onClick={() => navigate('/orders')} className="store-button-primary">
                    View My Orders
                  </button>
                  <button onClick={() => navigate('/products')} className="store-button-secondary">
                    Continue Shopping
                  </button>
                </div>
              </div>
            )}

            {status === 'failed' && (
              <div className="space-y-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50">
                  <ExclamationTriangleIcon className="h-10 w-10 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">Payment could not be confirmed</h2>
                  <p className="mt-3 text-base leading-7 text-muted-foreground">
                    {error || 'We could not process your payment. Please try again.'}
                  </p>
                </div>

                {transactionDetails?.merchantTransactionId && (
                  <div className="mx-auto max-w-xl rounded-2xl border bg-muted/20 p-5 text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Transaction ID</p>
                    <p className="mt-2 break-all text-sm font-semibold text-foreground">
                      {transactionDetails.merchantTransactionId}
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left">
                  <h3 className="text-sm font-semibold text-amber-900">Need help?</h3>
                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    If money was deducted from your account, it is usually refunded automatically within 5-7 business days.
                  </p>
                </div>

                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <button onClick={retryPayment} className="store-button-primary">
                    Try Again
                  </button>
                  <button onClick={() => navigate('/orders')} className="store-button-secondary">
                    View Orders
                  </button>
                  <button onClick={() => navigate('/products')} className="store-button-secondary">
                    Back to Products
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentVerify;
