import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { deliveryAPI, ordersAPI } from '../services/api';
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyRupeeIcon,
  HashtagIcon,
  MapPinIcon,
  PhoneIcon,
  ShoppingBagIcon,
  TruckIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import {
  formatDeliveryCurrency,
  formatDeliveryRange,
  getDeliveryModeLabel,
} from '../utils/deliveryUtils';
import { formatShippingAddress } from '../utils/orderUtils';

const statusStyles = {
  completed: {
    className: 'store-status-pill store-status-pill-success',
    icon: CheckCircleIcon,
    text: 'Delivered',
  },
  processing: {
    className: 'store-status-pill store-status-pill-warning',
    icon: ClockIcon,
    text: 'Processing',
  },
  shipped: {
    className: 'store-status-pill store-status-pill-info',
    icon: TruckIcon,
    text: 'Shipped',
  },
  cancelled: {
    className: 'store-status-pill store-status-pill-danger',
    icon: XCircleIcon,
    text: 'Cancelled',
  },
  default: {
    className: 'store-status-pill store-status-pill-neutral',
    icon: ClockIcon,
    text: 'Pending',
  },
};

const formatOrderId = (id) => `#${id.slice(0, 8).toUpperCase()}`;

const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const formatCurrency = (value) => `₹${Number.parseFloat(value || 0).toFixed(2)}`;
const formatShipmentStatus = (status = '') => (
  status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
);

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shipmentsByOrderId, setShipmentsByOrderId] = useState({});

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        if (user?.id) {
          const response = await ordersAPI.getUserOrders(user.id);
          setOrders(response.data);
        }
      } catch (err) {
        setError('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  useEffect(() => {
    if (orders.length === 0) {
      setShipmentsByOrderId({});
      return;
    }

    const trackableOrders = orders.filter((order) => order.has_shipment || order.tracking_url);
    if (trackableOrders.length === 0) {
      setShipmentsByOrderId({});
      return;
    }

    let isActive = true;

    Promise.allSettled(
      trackableOrders.map((order) => deliveryAPI.trackOrder(order.id))
    ).then((results) => {
      if (!isActive) {
        return;
      }

      const nextShipments = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.data?.shipment) {
          nextShipments[trackableOrders[index].id] = result.value.data.shipment;
        }
      });
      setShipmentsByOrderId(nextShipments);
    });

    return () => {
      isActive = false;
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="page-shell-soft py-8">
        <div className="page-container">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#23442a]" />
              <p className="text-lg text-muted-foreground">Loading your orders...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell-soft py-8">
        <div className="page-container">
          <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
            <XCircleIcon className="mx-auto mb-4 h-12 w-12 text-rose-400" />
            <p className="text-lg font-medium text-rose-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-soft py-6">
      <div className="page-container space-y-5">
        <div className="page-header-block p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#23442a]/8">
                <ShoppingBagIcon className="h-5 w-5 text-[#23442a]" />
              </div>
              <div>
                <p className="page-eyebrow">My Orders</p>
                <h1 className="page-title mt-2 text-[2rem] sm:text-[2.4rem]">Track and manage your orders</h1>
                <p className="page-description mt-2">
                  Delivery status, shipping cost, ETA, and order value in one compact view.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <div className="surface-card-muted min-w-[112px] px-3.5 py-3 text-center">
                <div className="text-xl font-semibold text-foreground">{orders.length}</div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Total</div>
              </div>
              <div className="surface-card-muted min-w-[112px] px-3.5 py-3 text-center">
                <div className="text-xl font-semibold text-emerald-700">
                  {orders.filter((order) => order.status === 'completed').length}
                </div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Delivered</div>
              </div>
              <div className="surface-card-muted min-w-[112px] px-3.5 py-3 text-center">
                <div className="text-xl font-semibold text-sky-700">
                  {orders.filter((order) => ['processing', 'shipped'].includes(order.status)).length}
                </div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Active</div>
              </div>
            </div>
          </div>
        </div>

        {orders.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="admin-empty-state border-solid bg-card px-8 py-12">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ShoppingBagIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="mb-3 text-2xl font-semibold text-foreground">No orders found</h2>
            <p className="mx-auto mb-7 max-w-md text-muted-foreground">
              You haven&apos;t placed any orders yet. When you do, they&apos;ll show up here with delivery details and status updates.
            </p>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
              <Link to="/products" className="store-button-primary rounded-full">
                <ShoppingBagIcon className="mr-2 h-5 w-5" />
                Start Shopping
              </Link>
            </motion.div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => {
              const statusConfig = statusStyles[order.status] || statusStyles.default;
              const StatusIcon = statusConfig.icon;
              const shipment = shipmentsByOrderId[order.id];
              const shippingFee = Number.parseFloat(order.shipping_fee || 0);
              const subtotalAmount = Number.parseFloat(
                order.subtotal_amount || (Number.parseFloat(order.total_amount || 0) - shippingFee)
              );
              const deliveryMode = shipment?.shipping_mode || order.delivery_mode || order.delivery_quote?.mode || 'Surface';
              const deliveryEta = shipment?.estimated_delivery_date
                ? formatDate(shipment.estimated_delivery_date)
                : formatDeliveryRange(
                    order.delivery_quote?.estimated_delivery_start,
                    order.delivery_quote?.estimated_delivery_end
                  );
              const deliveryStatusLabel = shipment?.status
                ? formatShipmentStatus(shipment.status)
                : getDeliveryModeLabel(deliveryMode);

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="surface-card overflow-hidden transition-all duration-300 hover:shadow-md"
                >
                  <div className="border-b bg-muted/20 px-5 py-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#23442a]/8">
                          <HashtagIcon className="h-5 w-5 text-[#23442a]" />
                        </div>
                        <div className="min-w-0">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                            <h3 className="text-lg font-semibold text-foreground">{formatOrderId(order.id)}</h3>
                            <div className={statusConfig.className}>
                              <StatusIcon className="mr-1.5 h-4 w-4" />
                              {statusConfig.text}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="h-4 w-4" />
                              <span>Ordered {formatDate(order.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <ShoppingBagIcon className="h-4 w-4" />
                              <span>
                                {order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-left xl:text-right">
                        <div className="flex items-center text-xl font-semibold text-foreground xl:justify-end">
                          <CurrencyRupeeIcon className="mr-1 h-5 w-5" />
                          {parseFloat(order.total_amount).toFixed(2)}
                        </div>
                        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Total paid</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.95fr)_minmax(0,1.35fr)_220px]">
                      <div>
                        <div className="surface-card-muted p-4">
                          <h4 className="mb-3 flex items-center text-base font-semibold text-foreground">
                            <MapPinIcon className="mr-2 h-[18px] w-[18px] text-[#23442a]" />
                            Delivery Address
                          </h4>
                          {order.shipping_address ? (
                            <div className="space-y-2">
                              <p className="text-sm leading-relaxed text-slate-700">{formatShippingAddress(order.shipping_address)}</p>
                              {order.customer_phone && (
                                <div className="flex items-center gap-2 border-t border-border/70 pt-2">
                                  <PhoneIcon className="h-4 w-4 text-[#23442a]" />
                                  <span className="text-sm font-medium text-slate-700">{order.customer_phone}</span>
                                </div>
                              )}
                              <div className="mt-3 border-t border-border/70 pt-3">
                                <h5 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Delivery summary</h5>
                                <div className="mt-3 space-y-2 text-sm">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">Mode</span>
                                    <span className="font-medium text-slate-700">{getDeliveryModeLabel(deliveryMode)}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">Shipping fee</span>
                                    <span className="font-medium text-slate-700">{formatDeliveryCurrency(shippingFee)}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">ETA</span>
                                    <span className="text-right font-medium text-slate-700">{deliveryEta}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">Status</span>
                                    <span className="text-right font-medium text-slate-700">{deliveryStatusLabel}</span>
                                  </div>
                                  {shipment?.current_location && (
                                    <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-slate-600">
                                      Latest update: {shipment.current_location}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="italic text-muted-foreground">No address provided</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="flex items-center text-base font-semibold text-foreground">
                            <ShoppingBagIcon className="mr-2 h-[18px] w-[18px] text-[#23442a]" />
                            Order items
                          </h4>
                          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {order.order_items?.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 p-3 transition-colors duration-200 hover:bg-muted/35"
                            >
                              <div className="flex-1">
                                <h5 className="mb-1 text-sm font-semibold text-foreground">{item.products?.name || 'Product'}</h5>
                                {item.product_variants?.variant_name && (
                                  <p className="mb-1 text-sm text-muted-foreground">{item.product_variants.variant_name}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                  <span>Qty: {item.quantity}</span>
                                  <span>•</span>
                                  <div className="flex items-center">
                                    <CurrencyRupeeIcon className="mr-1 h-4 w-4" />
                                    <span>{parseFloat(item.price).toFixed(2)} each</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center text-base font-semibold text-foreground">
                                  <CurrencyRupeeIcon className="mr-1 h-[18px] w-[18px]" />
                                  {(parseFloat(item.price) * item.quantity).toFixed(2)}
                                </div>
                                <span className="text-xs text-muted-foreground">Subtotal</span>
                              </div>
                            </div>
                          ))}
                        </div>

                      </div>

                      <div>
                        <div className="surface-card-muted p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Order summary</p>
                          <div className="mt-3 space-y-2.5 text-sm">
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Subtotal</span>
                              <span className="font-medium text-foreground">{formatCurrency(subtotalAmount)}</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Shipping</span>
                              <span className="font-medium text-foreground">{formatDeliveryCurrency(shippingFee)}</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>ETA</span>
                              <span className="text-right font-medium text-foreground">{deliveryEta}</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Status</span>
                              <span className="text-right font-medium text-foreground">{deliveryStatusLabel}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-border/70 pt-2 text-sm font-semibold text-foreground">
                              <span>Total paid</span>
                              <span>{formatCurrency(order.total_amount)}</span>
                            </div>
                          </div>

                          {(order.tracking_url || shipment?.awb_number) && (
                            <a
                              href={order.tracking_url || `https://www.delhivery.com/track/package/${shipment.awb_number}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[#23442a]/15 bg-white px-4 py-2 text-sm font-semibold text-[#23442a] transition-colors hover:bg-[#23442a]/5"
                            >
                              Track shipment
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {order.notes && (
                      <div className="mt-4 border-t border-border pt-4">
                        <h4 className="mb-2 text-base font-semibold text-foreground">Order notes</h4>
                        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-slate-700">{order.notes}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
