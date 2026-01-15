import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ordersAPI } from '../services/api';
import { 
  ShoppingBagIcon, 
  ClockIcon, 
  TruckIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  CalendarIcon,
  CurrencyRupeeIcon,
  MapPinIcon,
  PhoneIcon,
  HashtagIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  const getStatusConfig = (status) => {
    switch (status) {
      case 'completed': 
        return { 
          color: 'bg-green-100 text-green-800 border-green-200', 
          icon: CheckCircleIcon,
          text: 'Delivered'
        };
      case 'processing': 
        return { 
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
          icon: ClockIcon,
          text: 'Processing'
        };
      case 'shipped': 
        return { 
          color: 'bg-blue-100 text-blue-800 border-blue-200', 
          icon: TruckIcon,
          text: 'Shipped'
        };
      case 'cancelled': 
        return { 
          color: 'bg-red-100 text-red-800 border-red-200', 
          icon: XCircleIcon,
          text: 'Cancelled'
        };
      default: 
        return { 
          color: 'bg-gray-100 text-gray-800 border-gray-200', 
          icon: ClockIcon,
          text: 'Pending'
        };
    }
  };

  const formatOrderId = (id) => {
    return `#${id.slice(0, 8).toUpperCase()}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">Loading your orders...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <XCircleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-700 text-lg font-medium">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <ShoppingBagIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Order History</h1>
                  <p className="text-gray-600">Track and manage your orders</p>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{orders.length}</div>
                  <div className="text-sm text-gray-500">Total Orders</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {orders.filter(order => order.status === 'completed').length}
                  </div>
                  <div className="text-sm text-gray-500">Delivered</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {orders.filter(order => ['processing', 'shipped'].includes(order.status)).length}
                  </div>
                  <div className="text-sm text-gray-500">Active</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {orders.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBagIcon className="h-10 w-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No orders found</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              You haven't placed any orders yet. When you do, they'll appear here with detailed tracking information and delivery addresses.
            </p>
            <motion.a 
              href="/products" 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-sm"
            >
              <ShoppingBagIcon className="h-5 w-5 mr-2" />
              Start Shopping
            </motion.a>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {orders.map((order, index) => {
              const statusConfig = getStatusConfig(order.status);
              const StatusIcon = statusConfig.icon;
              
              return (
                <motion.div 
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300"
                >
                  {/* Order Header - Redesigned */}
                  <div className="bg-gradient-to-r from-indigo-50 via-white to-purple-50 px-6 py-5 border-b border-gray-100">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <HashtagIcon className="h-6 w-6 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-900">
                              {formatOrderId(order.id)}
                            </h3>
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusConfig.color}`}>
                              <StatusIcon className="h-4 w-4 mr-1.5" />
                              {statusConfig.text}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <CalendarIcon className="h-4 w-4" />
                              <span>Ordered {formatDate(order.created_at)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <BuildingOfficeIcon className="h-4 w-4" />
                              <span>{order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        <div className="flex items-center text-2xl font-bold text-gray-900">
                          <CurrencyRupeeIcon className="h-6 w-6 mr-1" />
                          {parseFloat(order.total_amount).toFixed(2)}
                        </div>
                        <span className="text-sm font-medium text-gray-500">Total Amount</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Shipping Information */}
                      <div className="lg:col-span-1">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                          <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                            <MapPinIcon className="h-5 w-5 text-blue-600 mr-2" />
                            Delivery Address
                          </h4>
                          {order.shipping_address ? (
                            <div className="space-y-2">
                              <p className="text-gray-700 leading-relaxed">
                                {typeof order.shipping_address === 'object'
                                  ? `${order.shipping_address.firstName} ${order.shipping_address.lastName}, ${order.shipping_address.address}, ${order.shipping_address.city}, ${order.shipping_address.state} ${order.shipping_address.zipCode}`
                                  : order.shipping_address
                                }
                              </p>
                              {order.phone_number && (
                                <div className="flex items-center space-x-2 pt-2 border-t border-blue-200">
                                  <PhoneIcon className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-gray-700">{order.phone_number}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-gray-500 italic">No address provided</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Order Items */}
                      <div className="lg:col-span-2">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <ShoppingBagIcon className="h-5 w-5 text-gray-600 mr-2" />
                          Order Details
                        </h4>
                        <div className="space-y-3">
                          {order.order_items?.map((item, itemIndex) => (
                            <div 
                              key={item.id} 
                              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors duration-200"
                            >
                              <div className="flex-1">
                                <h5 className="font-semibold text-gray-900 mb-1">
                                  {item.products?.name || 'Product'}
                                </h5>
                                <div className="flex items-center space-x-4 text-sm text-gray-600">
                                  <span>Qty: {item.quantity}</span>
                                  <span>•</span>
                                  <div className="flex items-center">
                                    <CurrencyRupeeIcon className="h-4 w-4 mr-1" />
                                    <span>{parseFloat(item.price).toFixed(2)} each</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center text-lg font-bold text-gray-900">
                                  <CurrencyRupeeIcon className="h-5 w-5 mr-1" />
                                  {(parseFloat(item.price) * item.quantity).toFixed(2)}
                                </div>
                                <span className="text-xs text-gray-500">Subtotal</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Order Notes */}
                    {order.notes && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">Order Notes</h4>
                        <p className="text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          {order.notes}
                        </p>
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