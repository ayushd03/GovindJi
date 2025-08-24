import React, { useState, useEffect } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import { Dialog, Transition } from '@headlessui/react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  XCircleIcon,
  CubeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [selectedStatus]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const url = selectedStatus 
        ? `${API_BASE_URL}/api/admin/orders?status=${selectedStatus}`
        : `${API_BASE_URL}/api/admin/orders`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        fetchOrders();
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-warning/10 text-warning-foreground';
      case 'processing': return 'bg-primary/10 text-primary';
      case 'shipped': return 'bg-secondary/10 text-secondary-foreground';
      case 'delivered': return 'bg-success/10 text-success';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-3 text-lg text-muted-foreground">Loading orders...</span>
      </div>
    );
  }

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_ORDERS}>
      <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Order Management</h1>
            <p className="mt-1 text-muted-foreground">Track and manage customer orders</p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <div className="relative">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <select 
                value={selectedStatus} 
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input-field pl-10 pr-4 py-2 border rounded-lg text-sm"
              >
                <option value="">All Orders</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
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
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-muted/50">
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
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-foreground">#{order.id.slice(0, 8)}</div></td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-foreground">{order.users?.name || 'Guest'}</div>
                            <div className="text-sm text-muted-foreground">{order.users?.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{formatDate(order.created_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{order.order_items?.length || 0} items</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">₹{order.total_amount}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border-0 focus:ring-2 focus:ring-primary ${getStatusColor(order.status)}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="btn-secondary inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                          >
                            <EyeIcon className="w-4 h-4 mr-1" />
                            View Details
                          </button>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y">
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
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className={`ml-2 px-2.5 py-1 rounded-full text-xs font-medium border-0 focus:ring-2 focus:ring-primary ${getStatusColor(order.status)}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                      <div>
                        <span className="text-muted-foreground">Date:</span>
                        <span className="ml-1 text-foreground font-medium">{new Date(order.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Items:</span>
                        <span className="ml-1 text-foreground font-medium">{order.order_items?.length || 0}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="ml-1 text-lg font-bold text-foreground">₹{order.total_amount}</span>
                      </div>
                    </div>
                    <div className="flex">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="w-full btn-secondary inline-flex items-center justify-center px-4 py-3 text-sm font-medium rounded-lg"
                      >
                        <EyeIcon className="w-4 h-4 mr-2" />
                        View Details
                      </button>
                    </div>
                  </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Order Details Modal */}
      <Transition show={!!selectedOrder} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setSelectedOrder(null)}>
          <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
          </Transition.Child>
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-2 sm:p-4 text-center sm:items-center">
              <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enterTo="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-card px-4 pb-4 pt-5 text-left shadow-xl transition-all w-full max-w-sm sm:max-w-2xl lg:max-w-4xl sm:my-8 sm:p-6">
                  <div className="absolute right-0 top-0 pr-3 pt-3 sm:pr-4 sm:pt-4">
                    <button type="button" className="rounded-md bg-card text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" onClick={() => setSelectedOrder(null)}>
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  {selectedOrder && (
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-foreground mb-6">Order Details - #{selectedOrder.id.slice(0, 8)}</Dialog.Title>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="text-md font-medium text-foreground mb-3">Order Information</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Order ID:</span><span className="font-medium">{selectedOrder.id}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Date:</span><span className="font-medium">{formatDate(selectedOrder.created_at)}</span></div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Status:</span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>{selectedOrder.status.toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Amount:</span><span className="font-medium text-lg">₹{selectedOrder.total_amount}</span></div>
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="text-md font-medium text-foreground mb-3">Customer Information</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Name:</span><span className="font-medium">{selectedOrder.users?.name || 'N/A'}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="font-medium">{selectedOrder.users?.email || 'N/A'}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Phone:</span><span className="font-medium">{selectedOrder.phone_number || 'N/A'}</span></div>
                            <div className="flex flex-col"><span className="text-muted-foreground mb-1">Address:</span><span className="font-medium text-xs">{selectedOrder.shipping_address || 'N/A'}</span></div>
                          </div>
                        </div>
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
                              {selectedOrder.order_items?.map(item => (
                                <tr key={item.id}>
                                  <td className="px-4 py-3 text-sm font-medium text-foreground">{item.products?.name || 'Unknown Product'}</td>
                                  <td className="px-4 py-3 text-sm text-foreground">{item.quantity}</td>
                                  <td className="px-4 py-3 text-sm text-foreground">₹{item.price}</td>
                                  <td className="px-4 py-3 text-sm font-medium text-foreground">₹{(item.quantity * item.price).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {selectedOrder.notes && (
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="text-md font-medium text-foreground mb-3">Order Notes</h4>
                          <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
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
      </div>
    </PermissionGuard>
  );
};

export default OrderManagement;
