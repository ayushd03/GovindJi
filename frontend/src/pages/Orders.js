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
  CurrencyRupeeIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <ShoppingBagIcon className="h-8 w-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          </div>
          <p className="text-gray-600">Track and manage your order history</p>
        </div>
        
        {orders.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center"
          >
            <ShoppingBagIcon className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">No orders yet</h2>
            <p className="text-gray-600 mb-8 max-w-sm mx-auto">
              When you place orders, they'll appear here for easy tracking and management.
            </p>
            <motion.a 
              href="/products" 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
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
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
                >
                  {/* Order Header */}
                  <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            Order {formatOrderId(order.id)}
                          </h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <CalendarIcon className="h-4 w-4 text-gray-400" />
                            <p className="text-sm text-gray-600">{formatDate(order.created_at)}</p>
                          </div>
                        </div>
                      </div>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusConfig.color}`}>
                        <StatusIcon className="h-4 w-4 mr-1.5" />
                        {statusConfig.text}
                      </div>
                    </div>
                  </div>
                  
                  {/* Order Items */}
                  <div className="px-6 py-4">
                    <div className="space-y-4">
                      {order.order_items?.map((item, itemIndex) => (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 mb-1">
                              {item.products?.name || 'Product'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              Quantity: {item.quantity}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center text-lg font-semibold text-gray-900">
                              <CurrencyRupeeIcon className="h-5 w-5" />
                              {parseFloat(item.price).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Order Footer */}
                  <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? 's' : ''}
                      </div>
                      <div className="flex items-center text-xl font-bold text-gray-900">
                        <span className="text-sm font-medium text-gray-600 mr-2">Total:</span>
                        <CurrencyRupeeIcon className="h-6 w-6" />
                        {parseFloat(order.total_amount).toFixed(2)}
                      </div>
                    </div>
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