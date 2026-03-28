import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import { usePermissions } from '../../context/PermissionContext';
import { adminOrdersAPI, deliveryAPI } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatShippingAddress } from '../../utils/orderUtils';
import OrderFulfillmentPanel from './components/OrderFulfillmentPanel';
import { Dialog, Transition } from '@headlessui/react';
import {
  CubeIcon,
  EyeIcon,
  FunnelIcon,
  TruckIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const statusOptions = [
  { value: '', label: 'All Orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'completed', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' }
];

const normalizeStatusValue = (status = '') => (status === 'delivered' ? 'completed' : status);

const formatStatusLabel = (status = '') => {
  const normalized = normalizeStatusValue(status);
  if (normalized === 'completed') return 'Delivered';
  if (!normalized) return 'Pending';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatCourierStatusLabel = (status = '') => (
  status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
);

const formatCurrency = (amount) => `₹${Number.parseFloat(amount || 0).toFixed(2)}`;

const OrderManagement = () => {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(ADMIN_PERMISSIONS.MANAGE_ORDERS);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deliveryDetailsLoading, setDeliveryDetailsLoading] = useState(false);
  const [deliveryDetailsError, setDeliveryDetailsError] = useState('');
  const [selectedOrderReadiness, setSelectedOrderReadiness] = useState(null);
  const [selectedOrderShipment, setSelectedOrderShipment] = useState(null);
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [retryingPickup, setRetryingPickup] = useState(false);
  const [cancelDialogOrder, setCancelDialogOrder] = useState(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = selectedStatus ? { status: selectedStatus } : undefined;
      const response = await adminOrdersAPI.getAll(params);
      const nextOrders = response.data || [];
      setOrders(nextOrders);
      setSelectedOrder((prev) => {
        if (!prev) return prev;
        return nextOrders.find((order) => order.id === prev.id) || prev;
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Unable to load orders',
        description: error.response?.data?.error || 'Please refresh and try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const fetchDeliveryDetails = useCallback(async (orderId) => {
    if (!orderId) return;

    try {
      setDeliveryDetailsLoading(true);
      setDeliveryDetailsError('');

      const [readinessResponse, shipmentsResponse] = await Promise.all([
        adminOrdersAPI.getShipmentReadiness(orderId),
        deliveryAPI.getShipments({ order_id: orderId, limit: 1 })
      ]);

      setSelectedOrderReadiness(readinessResponse.data || null);
      setSelectedOrderShipment(shipmentsResponse.data?.shipments?.[0] || null);
    } catch (error) {
      console.error('Error fetching delivery details:', error);
      setDeliveryDetailsError(error.response?.data?.error || 'Unable to load delivery details right now.');
      setSelectedOrderReadiness(null);
      setSelectedOrderShipment(null);
    } finally {
      setDeliveryDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedOrder?.id) {
      setSelectedOrderReadiness(null);
      setSelectedOrderShipment(null);
      setDeliveryDetailsError('');
      return;
    }

    fetchDeliveryDetails(selectedOrder.id);
  }, [fetchDeliveryDetails, selectedOrder?.id]);

  const markCodCollected = async (orderId) => {
    try {
      const response = await adminOrdersAPI.markCodCollected(orderId);
      setSelectedOrder((prev) => (prev ? { ...prev, payment_status: response.data.payment_status } : prev));
      fetchOrders();
      toast({
        title: 'COD marked as collected',
        description: 'The payment status has been updated to paid.'
      });
    } catch (error) {
      console.error('Error marking COD collected:', error);
      toast({
        title: 'Unable to update COD status',
        description: error.response?.data?.error || 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      setCancellingOrder(true);
      await adminOrdersAPI.cancel(orderId);
      setSelectedOrder((prev) => (
        prev && prev.id === orderId
          ? { ...prev, status: 'cancelled' }
          : prev
      ));
      await Promise.all([fetchOrders(), fetchDeliveryDetails(orderId)]);
      setCancelDialogOrder(null);
      toast({
        title: 'Order cancelled',
        description: 'Stock has been restored and courier cancellation was attempted if needed.'
      });
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast({
        title: 'Unable to cancel order',
        description: error.response?.data?.error || 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setCancellingOrder(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await adminOrdersAPI.updateStatus(orderId, newStatus);
      setSelectedOrder((prev) => (
        prev && prev.id === orderId
          ? { ...prev, status: newStatus }
          : prev
      ));
      fetchOrders();
      if (newStatus === 'processing' || newStatus === 'completed') {
        fetchDeliveryDetails(orderId);
      }

      const warning = getFulfillmentWarning(response.data?.fulfillment);
      if (warning) {
        toast({
          title: 'Order updated with fulfillment warning',
          description: warning,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: 'Unable to update order',
        description: error.response?.data?.error || 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const createShipmentForOrder = async (orderId) => {
    try {
      setCreatingShipment(true);
      const response = await deliveryAPI.createShipment(orderId);
      const warning = response.data?.shipment_error || response.data?.pickup_error;
      setSelectedOrder((prev) => (
        prev
          ? {
              ...prev,
              has_shipment: true,
              tracking_url: response.data?.tracking_url || response.data?.shipment?.tracking_url || prev.tracking_url
            }
          : prev
      ));
      await Promise.all([fetchOrders(), fetchDeliveryDetails(orderId)]);

      if (warning) {
        toast({
          title: 'Shipment updated with pickup warning',
          description: warning,
          variant: 'destructive'
        });
        return;
      }

      const awbNumber = response.data?.shipment?.awb_number || response.data?.awb_number || '';
      toast({
        title: response.data?.shipment_created ? 'Shipment created' : 'Shipment refreshed',
        description: response.data?.pickup_scheduled
          ? `AWB ${awbNumber} is ready and pickup has been requested.`.trim()
          : `AWB ${awbNumber} has been created successfully.`.trim()
      });
    } catch (error) {
      console.error('Error creating shipment:', error);
      toast({
        title: 'Unable to create shipment',
        description: error.response?.data?.error || 'Please fix the shipment issues and try again.',
        variant: 'destructive'
      });
    } finally {
      setCreatingShipment(false);
    }
  };

  const retryPickupForOrder = async (orderId) => {
    try {
      setRetryingPickup(true);
      const response = await deliveryAPI.retryPickup(orderId);
      await Promise.all([fetchOrders(), fetchDeliveryDetails(orderId)]);

      if (!response.data?.success) {
        toast({
          title: 'Pickup retry failed',
          description: response.data?.pickup_error || 'Please review the courier configuration and try again.',
          variant: 'destructive'
        });
        return;
      }

      if (!response.data?.scheduled_count) {
        toast({
          title: 'Pickup already up to date',
          description: 'No manifested shipment is waiting for pickup on this order.'
        });
        return;
      }

      toast({
        title: response.data?.reused_existing_request ? 'Pickup linked' : 'Pickup requested',
        description: response.data?.pickup_date
          ? `Pickup is scheduled for ${formatPickupSlot(response.data.pickup_date, response.data.pickup_time)}.`
          : 'Pickup request recorded successfully.'
      });
    } catch (error) {
      console.error('Error retrying pickup:', error);
      toast({
        title: 'Unable to retry pickup',
        description: error.response?.data?.error || 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setRetryingPickup(false);
    }
  };

  const getStatusColor = (status) => {
    switch (normalizeStatusValue(status)) {
      case 'pending': return 'bg-warning/10 text-warning-foreground';
      case 'processing': return 'bg-primary/10 text-primary';
      case 'shipped': return 'bg-secondary/10 text-secondary-foreground';
      case 'completed': return 'bg-success/10 text-success';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getIssueTone = (severity) => (
    severity === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
  );

  const formatDate = (dateString) => (
    new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  );

  const formatPickupSlot = (date, time) => {
    if (!date) return 'Not scheduled';
    const value = time ? `${date}T${time}` : date;
    return new Date(value).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFulfillmentWarning = (fulfillment) => (
    fulfillment?.shipment_error ||
    fulfillment?.pickup_error ||
    ''
  );

  const handleOrderDetailsClose = () => {
    setSelectedOrder(null);
    setCancelDialogOrder(null);
  };

  const closeCancelDialog = () => {
    if (!cancellingOrder) {
      setCancelDialogOrder(null);
    }
  };

  const orderStats = useMemo(() => ({
    visible: orders.length,
    needsAction: orders.filter((order) => ['pending', 'processing'].includes(normalizeStatusValue(order.status))).length,
    codPending: orders.filter((order) => order.payment_method === 'COD' && order.payment_status !== 'PAID').length,
    shipped: orders.filter((order) => ['shipped', 'completed'].includes(normalizeStatusValue(order.status))).length
  }), [orders]);

  const deliveryPanelRequested = searchParams.get('panel') === 'delivery';
  const canCreateShipment = Boolean(
    canManage &&
    selectedOrder &&
    normalizeStatusValue(selectedOrder.status) === 'processing' &&
    !selectedOrderShipment &&
    selectedOrderReadiness?.ready
  );
  const canRetryPickup = Boolean(
    canManage &&
    selectedOrder &&
    selectedOrderShipment &&
    ['MANIFESTED', 'PENDING'].includes(selectedOrderShipment.status) &&
    !selectedOrderShipment.pickup_scheduled_date
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <span className="ml-3 text-lg text-muted-foreground">Loading orders...</span>
      </div>
    );
  }

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_ORDERS}>
      <div className="admin-page">
        <div className="admin-page-header">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="admin-page-title">Orders</h1>
              <p className="admin-page-description">Handle order updates, payment collection, and courier workflow from one place.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <FunnelIcon className="input-icon-left" />
                <select
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  className="input-field input-with-left-icon w-full min-w-[170px] pr-8 text-[13px]"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            {orderStats.visible} visible
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
            {orderStats.needsAction} need attention
          </span>
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
            {orderStats.codPending} COD pending
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            {orderStats.shipped} shipped/delivered
          </span>
        </div>

        <div className="mt-4">
          <OrderFulfillmentPanel initialOpen={deliveryPanelRequested} />
        </div>

        <div className="admin-section mt-6 overflow-hidden">
          {orders.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CubeIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground text-lg">No orders found</p>
              <p className="text-sm">
                {selectedStatus ? 'No orders with this status' : 'Orders will appear here when customers place them'}
              </p>
            </div>
          ) : (
            <>
              <div className="admin-table-wrap hidden xl:block">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Order ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Items</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-muted/50 transition-colors duration-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">#{order.id.slice(0, 8)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-foreground">{order.users?.name || 'Guest'}</div>
                            <div className="text-sm text-muted-foreground">{order.users?.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{formatDate(order.created_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{order.order_items?.length || 0} items</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{formatCurrency(order.total_amount)}</td>
                        <td className="whitespace-nowrap">
                          <select
                            value={normalizeStatusValue(order.status)}
                            onChange={(event) => updateOrderStatus(order.id, event.target.value)}
                            disabled={!canManage}
                            className={`inline-flex h-8 items-center rounded-full border-0 px-2.5 py-1 text-[11px] font-medium focus:ring-2 focus:ring-primary ${getStatusColor(order.status)} disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {statusOptions
                              .filter((option) => option.value)
                              .map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="btn-secondary inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium"
                          >
                            <EyeIcon className="h-4 w-4" />
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="xl:hidden divide-y">
                {orders.map((order) => (
                  <div key={order.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors duration-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-base sm:text-lg font-medium text-foreground">#{order.id.slice(0, 8)}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{order.users?.name || 'Guest'}</p>
                        {order.users?.email && <p className="text-xs text-muted-foreground truncate">{order.users.email}</p>}
                      </div>
                      <select
                        value={normalizeStatusValue(order.status)}
                        onChange={(event) => updateOrderStatus(order.id, event.target.value)}
                        disabled={!canManage}
                        className={`ml-2 h-8 rounded-full border-0 px-2.5 py-1 text-[11px] font-medium focus:ring-2 focus:ring-primary ${getStatusColor(order.status)} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {statusOptions
                          .filter((option) => option.value)
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                      <div>
                        <span className="text-muted-foreground">Date:</span>
                        <span className="ml-1 text-foreground font-medium">
                          {new Date(order.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Items:</span>
                        <span className="ml-1 text-foreground font-medium">{order.order_items?.length || 0}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <span className="ml-1 text-foreground font-medium">{formatStatusLabel(order.status)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total:</span>
                        <span className="ml-1 text-lg font-bold text-foreground">{formatCurrency(order.total_amount)}</span>
                      </div>
                    </div>
                    <div className="flex">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="w-full btn-secondary inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium"
                      >
                        <EyeIcon className="h-4 w-4" />
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <Transition show={!!selectedOrder} as={React.Fragment}>
          <Dialog as="div" className="relative z-50" onClose={handleOrderDetailsClose}>
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] transition-opacity" />
            </Transition.Child>

            <div className="fixed inset-0 z-10 overflow-y-auto">
              <div className="flex min-h-full items-end justify-center p-3 text-center sm:items-center sm:p-6">
                <Transition.Child
                  as={React.Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                  enterTo="opacity-100 translate-y-0 sm:scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                  <Dialog.Panel className="relative transform overflow-hidden rounded-3xl border bg-card px-4 pb-4 pt-5 text-left shadow-2xl transition-all w-full max-w-sm sm:max-w-2xl lg:max-w-4xl sm:my-8 sm:p-6">
                    <div className="absolute right-0 top-0 pr-3 pt-3 sm:pr-4 sm:pt-4">
                      <button
                        type="button"
                        className="rounded-md bg-card text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onClick={handleOrderDetailsClose}
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    {selectedOrder && (
                      <div>
                        <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-foreground mb-6">
                          Order Details - #{selectedOrder.id.slice(0, 8)}
                        </Dialog.Title>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                          <div className="bg-muted/50 rounded-lg p-4">
                            <h4 className="text-md font-medium text-foreground mb-3">Order Information</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-muted-foreground">Order ID:</span><span className="font-medium">{selectedOrder.id}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Date:</span><span className="font-medium">{formatDate(selectedOrder.created_at)}</span></div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                                  {formatStatusLabel(selectedOrder.status)}
                                </span>
                              </div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Total Amount:</span><span className="font-medium text-lg">{formatCurrency(selectedOrder.total_amount)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Payment Method:</span><span className="font-medium">{selectedOrder.payment_method || 'N/A'}</span></div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Payment Status:</span>
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${selectedOrder.payment_status === 'PAID' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-foreground'}`}>
                                    {selectedOrder.payment_status || 'N/A'}
                                  </span>
                                  {selectedOrder.payment_method === 'COD' && selectedOrder.payment_status !== 'PAID' && (
                                    <button
                                      onClick={() => markCodCollected(selectedOrder.id)}
                                      disabled={!canManage}
                                      className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Mark Collected
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-muted/50 rounded-lg p-4">
                            <h4 className="text-md font-medium text-foreground mb-3">Customer Information</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-muted-foreground">Name:</span><span className="font-medium">{selectedOrder.users?.name || 'N/A'}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="font-medium">{selectedOrder.users?.email || 'N/A'}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Phone:</span><span className="font-medium">{selectedOrder.customer_phone || 'N/A'}</span></div>
                              <div className="flex flex-col"><span className="text-muted-foreground mb-1">Address:</span><span className="font-medium text-xs">{formatShippingAddress(selectedOrder.shipping_address)}</span></div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 mb-6">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h4 className="text-md font-medium text-foreground">Delivery & courier</h4>
                              <p className="mt-1 text-sm text-muted-foreground">Keep shipment creation and pickup readiness visible before dispatch.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {canRetryPickup && (
                                <button
                                  type="button"
                                  onClick={() => retryPickupForOrder(selectedOrder.id)}
                                  disabled={retryingPickup}
                                  className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <TruckIcon className="h-4 w-4" />
                                  {retryingPickup ? 'Retrying pickup...' : 'Retry pickup'}
                                </button>
                              )}
                              {canCreateShipment && (
                                <button
                                  type="button"
                                  onClick={() => createShipmentForOrder(selectedOrder.id)}
                                  disabled={creatingShipment}
                                  className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <TruckIcon className="h-4 w-4" />
                                  {creatingShipment ? 'Creating...' : 'Create shipment'}
                                </button>
                              )}
                            </div>
                          </div>

                          {deliveryDetailsLoading ? (
                            <div className="flex items-center gap-3 py-6">
                              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
                              <span className="text-sm text-muted-foreground">Loading delivery details...</span>
                            </div>
                          ) : deliveryDetailsError ? (
                            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                              {deliveryDetailsError}
                            </div>
                          ) : (
                            <div className="mt-4 space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">Shipment status</p>
                                      <p className="mt-1 text-sm text-muted-foreground">
                                        {selectedOrderShipment ? formatCourierStatusLabel(selectedOrderShipment.status) : 'Shipment not created yet'}
                                      </p>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedOrderShipment ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                      {selectedOrderShipment ? formatCourierStatusLabel(selectedOrderShipment.status) : 'Pending'}
                                    </span>
                                  </div>
                                  <div className="mt-4 space-y-2 text-sm">
                                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">AWB</span><span className="font-medium">{selectedOrderShipment?.awb_number || 'Not available'}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Pickup</span><span className="text-right font-medium">{formatPickupSlot(selectedOrderShipment?.pickup_scheduled_date, selectedOrderShipment?.pickup_scheduled_time)}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Tracking</span><span className="text-right font-medium">{selectedOrder.tracking_url ? 'Available' : 'Not available'}</span></div>
                                  </div>
                                  {selectedOrderShipment?.pickup_error && (
                                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                      {selectedOrderShipment.pickup_error}
                                    </div>
                                  )}
                                  {selectedOrder.tracking_url && (
                                    <a
                                      href={selectedOrder.tracking_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
                                    >
                                      Open tracking link
                                    </a>
                                  )}
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">Manifest readiness</p>
                                      <p className="mt-1 text-sm text-muted-foreground">
                                        {selectedOrderReadiness?.ready
                                          ? 'Order has the basic details needed for shipment creation.'
                                          : 'Review the missing data before manifesting this order.'}
                                      </p>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedOrderReadiness?.ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                      {selectedOrderReadiness?.ready ? 'Ready' : 'Action needed'}
                                    </span>
                                  </div>
                                  <div className="mt-4 space-y-2 text-sm">
                                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Total weight</span><span className="font-medium">{selectedOrderReadiness?.total_weight_grams ? `${selectedOrderReadiness.total_weight_grams} g` : 'Not available'}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Errors</span><span className="font-medium">{selectedOrderReadiness?.summary?.error_count || 0}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Warnings</span><span className="font-medium">{selectedOrderReadiness?.summary?.warning_count || 0}</span></div>
                                  </div>
                                </div>
                              </div>

                              {selectedOrderReadiness?.issues?.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {selectedOrderReadiness.issues.map((issue, index) => (
                                    <div
                                      key={`${issue.type}-${index}`}
                                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${getIssueTone(issue.severity)}`}
                                    >
                                      {issue.product ? `${issue.product}: ` : ''}{issue.message}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {!selectedOrderShipment && normalizeStatusValue(selectedOrder.status) !== 'processing' && (
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-muted-foreground">
                                  Move the order to <span className="font-medium text-foreground">Processing</span> when it is packed and ready. Shipment creation automation starts from there.
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mb-6">
                          <h4 className="text-md font-medium text-foreground mb-3">Order Items</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y border rounded-lg">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Price</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                                </tr>
                              </thead>
                              <tbody className="bg-card divide-y">
                                {selectedOrder.order_items?.map((item) => (
                                  <tr key={item.id}>
                                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                                      {item.products?.name || 'Unknown Product'}
                                      {item.product_variants?.variant_name && (
                                        <div className="text-xs text-muted-foreground font-normal mt-0.5">{item.product_variants.variant_name}</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-foreground">{item.quantity}</td>
                                    <td className="px-4 py-3 text-sm text-foreground">{formatCurrency(item.price)}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-foreground">{formatCurrency(item.quantity * item.price)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {selectedOrder.notes && (
                          <div className="bg-muted/50 rounded-lg p-4 mb-4">
                            <h4 className="text-md font-medium text-foreground mb-3">Order Notes</h4>
                            <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                          </div>
                        )}

                        {!['cancelled', 'completed', 'delivered'].includes(normalizeStatusValue(selectedOrder.status)) && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setCancelDialogOrder(selectedOrder)}
                              disabled={!canManage}
                              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <XCircleIcon className="w-4 h-4 mr-2" />
                              Cancel Order
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        <Transition show={!!cancelDialogOrder} as={React.Fragment}>
          <Dialog as="div" className="relative z-[60]" onClose={closeCancelDialog}>
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-[2px]" />
            </Transition.Child>

            <div className="fixed inset-0 z-[60] overflow-y-auto">
              <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center">
                <Transition.Child
                  as={React.Fragment}
                  enter="ease-out duration-200"
                  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                  enterTo="opacity-100 translate-y-0 sm:scale-100"
                  leave="ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md overflow-hidden rounded-3xl border border-rose-100 bg-card p-5 text-left shadow-2xl sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                        <XCircleIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Dialog.Title as="h3" className="text-lg font-semibold text-foreground">
                          Cancel order #{cancelDialogOrder?.id?.slice(0, 8)}?
                        </Dialog.Title>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Stock for this order will be restored. If a Delhivery shipment exists, the system will also try to cancel it.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Use this only when the order should not continue to packing or dispatch.
                    </div>

                    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={closeCancelDialog}
                        disabled={cancellingOrder}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Keep order
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelDialogOrder?.id && cancelOrder(cancelDialogOrder.id)}
                        disabled={cancellingOrder}
                        className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancellingOrder ? 'Cancelling...' : 'Cancel order'}
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </PermissionGuard>
  );
};

export default OrderManagement;
