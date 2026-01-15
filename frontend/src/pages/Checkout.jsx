import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ordersAPI } from '../services/api';
import paymentAPI from '../services/paymentApi';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import './Checkout.css';

const Checkout = () => {
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    paymentMethod: 'phonepe',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const orderTotal = getCartTotal();

      // Create order data
      const orderData = {
        total_amount: orderTotal,
        status: 'pending',
        payment_method: formData.paymentMethod.toUpperCase(),
        payment_status: 'PENDING',
        customer_phone: formData.phone,
        customer_email: formData.email,
        shipping_address: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode
        },
        items: cartItems.map(item => ({
          product_id: item.originalId || item.id,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      console.log('Creating order with data:', JSON.stringify(orderData, null, 2));
      console.log('Selected payment method:', formData.paymentMethod);

      const response = await ordersAPI.create(orderData);

      // Extract order ID from response (nested in order property)
      const orderId = response.data?.order?.id || response.data?.id;

      if (!orderId) {
        console.error('Order creation response:', response.data);
        throw new Error('Failed to create order - no order ID returned');
      }

      console.log('Order created successfully:', orderId);

      // Handle payment based on method
      if (formData.paymentMethod === 'phonepe') {
        // Initiate PhonePe payment
        const paymentResponse = await paymentAPI.initiatePayment(
          orderId,
          orderTotal,
          {
            phone: formData.phone,
            email: formData.email
          },
          'PHONEPE'
        );

        if (paymentResponse.success && paymentResponse.paymentUrl) {
          // Store transaction ID in localStorage for verification page
          localStorage.setItem('currentTransactionId', paymentResponse.merchantTransactionId);
          localStorage.setItem('currentOrderId', orderId);

          // Redirect to PhonePe payment page
          window.location.href = paymentResponse.paymentUrl;
        } else {
          throw new Error('Failed to initiate payment');
        }
      } else if (formData.paymentMethod === 'cod') {
        // COD flow - clear cart and navigate to success
        clearCart();
        navigate('/order-success', { state: { order: response.data.order || response.data } });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process checkout. Please try again.');
      console.error('Checkout error:', err);
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="checkout-page">
      <div className="container">
        <h1>Checkout</h1>
        
        <div className="checkout-content">
          <div className="checkout-form">
            <h2>Shipping Information</h2>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name *</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name *</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">Address *</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="city">City *</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="state">State *</label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="zipCode">ZIP Code *</label>
                  <input
                    type="text"
                    id="zipCode"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="payment-section">
                <h3>Payment Method</h3>
                <div className="payment-options">
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="phonepe"
                      checked={formData.paymentMethod === 'phonepe'}
                      onChange={handleChange}
                    />
                    <span>PhonePe / UPI / Card / Net Banking</span>
                  </label>
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={formData.paymentMethod === 'cod'}
                      onChange={handleChange}
                    />
                    <span>Cash on Delivery</span>
                  </label>
                </div>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  Selected: {formData.paymentMethod.toUpperCase()}
                </p>
              </div>

              <button
                type="submit"
                className="place-order-btn"
                disabled={loading}
              >
                {loading ? 'Processing...' :
                 formData.paymentMethod === 'phonepe' ? 'Proceed to Payment' : 'Place Order'}
              </button>
            </form>
          </div>

          <div className="order-summary">
            <h3>Order Summary</h3>
            
            <div className="order-items">
              {cartItems.map(item => (
                <div key={item.id} className="order-item">
                  {getImageUrl(item.image_url, 'product') ? (
                    <img 
                      src={getImageUrl(item.image_url, 'product')} 
                      alt={item.name}
                      onError={(e) => handleImageError(e, 'product')}
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 flex items-center justify-center rounded">
                      <div className="text-gray-400 text-center">
                        <div className="text-lg">📦</div>
                      </div>
                    </div>
                  )}
                  <div className="item-info">
                    <h4>{item.name}</h4>
                    <p>Qty: {item.quantity}</p>
                  </div>
                  <div className="item-price">
                    ₹{(parseFloat(item.price) * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="summary-totals">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>₹{getCartTotal().toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping:</span>
                <span>Free</span>
              </div>
              <div className="summary-row total">
                <span>Total:</span>
                <span>₹{getCartTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;