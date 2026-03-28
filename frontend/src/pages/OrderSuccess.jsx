import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircleIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';

const OrderSuccess = () => {
  const location = useLocation();
  const order = location.state?.order;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="page-shell-soft py-8">
      <div className="page-container">
        <div className="mx-auto max-w-3xl surface-section overflow-hidden">
          <div className="border-b bg-[#23442a] px-6 py-5 text-white sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Order Placed</p>
            <h1 className="mt-2 font-heading text-3xl font-semibold">Your order is confirmed</h1>
          </div>

          <div className="px-6 py-8 sm:px-8">
            <div className="space-y-8 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircleIcon className="h-10 w-10 text-emerald-600" />
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-foreground">Order placed successfully</h2>
                <p className="mt-3 text-base leading-7 text-muted-foreground">
                  Thank you for your order. We will keep you updated as the payment and fulfillment progress.
                </p>
              </div>

              {order && (
                <div className="grid gap-4 rounded-2xl border bg-muted/20 p-5 text-left sm:grid-cols-2">
                  <div className="surface-card-muted p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Order ID</p>
                    <p className="mt-2 break-all text-sm font-semibold text-foreground">{order.id}</p>
                  </div>
                  <div className="surface-card-muted p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total Amount</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      ₹{parseFloat(order.total_amount || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="surface-card-muted p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Payment Method</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {order.payment_method || 'Cash on Delivery'}
                    </p>
                  </div>
                  <div className="surface-card-muted p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{order.status || 'Pending'}</p>
                  </div>
                </div>
              )}

              <div className="surface-card-muted flex items-start gap-3 p-5 text-left">
                <ShoppingBagIcon className="mt-0.5 h-5 w-5 text-[#23442a]" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">What happens next</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    You can track the status from your orders page. If online payment was used, the payment verification screen will keep the final status in sync with your order.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/products" className="store-button-primary">
                  Continue Shopping
                </Link>
                <Link to="/orders" className="store-button-secondary">
                  View My Orders
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
