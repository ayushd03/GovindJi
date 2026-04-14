import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClockIcon,
  CreditCardIcon,
  MapPinIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useDeliveryOptions, getStoredDeliveryPincode, normalizeDeliveryPincode } from '../hooks/useDeliveryOptions';
import { ordersAPI } from '../services/api';
import paymentAPI from '../services/paymentApi';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import {
  formatDeliveryCurrency,
  formatDeliveryRange,
  getDeliveryModeLabel,
  getSelectedDeliveryOption,
} from '../utils/deliveryUtils';

const paymentOptions = [
  {
    id: 'phonepe',
    title: 'UPI / Card / Net Banking',
    description: 'Fast online checkout with payment verification.',
  },
  {
    id: 'cod',
    title: 'Cash on Delivery',
    description: 'Pay when the order arrives at your doorstep.',
  },
];

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
    zipCode: getStoredDeliveryPincode(),
    paymentMethod: 'phonepe',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDeliveryMode, setSelectedDeliveryMode] = useState('');
  const cartSubtotal = getCartTotal();
  const {
    data: deliveryOptionsData,
    loading: deliveryOptionsLoading,
    error: deliveryOptionsError,
  } = useDeliveryOptions({
    pincode: formData.zipCode,
    subtotal: cartSubtotal,
    enabled: cartItems.length > 0,
  });
  const selectedDeliveryOption = getSelectedDeliveryOption(
    deliveryOptionsData?.options,
    selectedDeliveryMode
  );
  const shippingFee = Number.parseFloat(selectedDeliveryOption?.fee || 0);
  const orderTotal = cartSubtotal + shippingFee;
  const codUnavailable = Boolean(
    deliveryOptionsData?.serviceability_checked &&
    deliveryOptionsData?.cod_available === false
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!deliveryOptionsData?.options?.length) {
      setSelectedDeliveryMode('');
      return;
    }

    setSelectedDeliveryMode((currentMode) => {
      const hasCurrentMode = deliveryOptionsData.options.some((option) => option.mode === currentMode);
      if (hasCurrentMode) {
        return currentMode;
      }

      return deliveryOptionsData.default_mode || deliveryOptionsData.options[0].mode;
    });
  }, [deliveryOptionsData]);

  useEffect(() => {
    if (codUnavailable && formData.paymentMethod === 'cod') {
      setFormData((prev) => ({ ...prev, paymentMethod: 'phonepe' }));
    }
  }, [codUnavailable, formData.paymentMethod]);

  const handleChange = (event) => {
    const value = event.target.name === 'zipCode'
      ? normalizeDeliveryPincode(event.target.value)
      : event.target.value;

    setFormData((prev) => ({
      ...prev,
      [event.target.name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    let createdOrder = null;
    let orderId = null;

    if (formData.zipCode.length !== 6) {
      setError('Enter a valid 6-digit pincode to view delivery options.');
      return;
    }

    if (deliveryOptionsLoading) {
      setError('Delivery options are still loading. Please wait a moment and try again.');
      return;
    }

    if (deliveryOptionsData?.serviceability_checked && !deliveryOptionsData?.serviceable) {
      setError(deliveryOptionsData?.message || 'Delivery is not available to this pincode.');
      return;
    }

    if (!selectedDeliveryOption) {
      setError('Choose a delivery option before placing the order.');
      return;
    }

    if (codUnavailable && formData.paymentMethod === 'cod') {
      setError('Cash on Delivery is unavailable for this pincode. Please choose online payment.');
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        payment_method: formData.paymentMethod.toUpperCase(),
        customer_phone: formData.phone,
        customer_email: formData.email,
        shipping_address: {
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.zipCode,
        },
        delivery_mode: selectedDeliveryOption.mode,
        items: cartItems.map((item) => ({
          product_id: item.originalId || item.id,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
        })),
      };

      const response = await ordersAPI.create(orderData);
      createdOrder = response.data?.order || response.data;
      orderId = createdOrder?.id;

      if (!orderId) {
        throw new Error('Failed to create order - no order ID returned');
      }

      if (formData.paymentMethod === 'phonepe') {
        const paymentResponse = await paymentAPI.initiatePayment(
          orderId,
          {
            phone: formData.phone,
            email: formData.email,
          },
          'PHONEPE'
        );

        if (!paymentResponse.success || !paymentResponse.paymentUrl) {
          throw new Error('Failed to initiate payment');
        }

        localStorage.setItem('currentTransactionId', paymentResponse.merchantTransactionId);
        localStorage.setItem('currentOrderId', orderId);
        window.location.href = paymentResponse.paymentUrl;
        return;
      }

      clearCart();
      navigate('/order-success', { state: { order: createdOrder } });
    } catch (err) {
      if (formData.paymentMethod === 'phonepe' && orderId) {
        try {
          await ordersAPI.releaseUnpaid(orderId);
        } catch (releaseError) {
          console.error('Unable to release unpaid order after checkout failure:', releaseError);
        }
      }
      setError(err.response?.data?.error || 'Failed to process checkout. Please try again.');
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="page-shell-soft pt-6 pb-14">
        <div className="page-container">
          <div className="mx-auto max-w-3xl page-header-block text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#23442a]/8">
              <ShoppingBagIcon className="h-7 w-7 text-[#23442a]" />
            </div>
            <p className="page-eyebrow">Checkout</p>
            <h1 className="page-title mt-3">Your cart is empty</h1>
            <p className="page-description mx-auto">
              Add a few products before you checkout. Once items are in your cart, your shipping and payment summary will appear here.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/products" className="store-button-primary">
                Browse Products
              </Link>
              <Link to="/" className="store-button-secondary">
                Back to Home
              </Link>
            </div>
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
            <div>
              <p className="page-eyebrow">Secure Checkout</p>
              <h1 className="page-title mt-2 text-[2rem] sm:text-[2.4rem]">Complete your order</h1>
              <p className="page-description">
                Confirm delivery, payment, and order totals in one tighter flow.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <div className="surface-card-muted min-w-[172px] px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <ShieldCheckIcon className="h-[18px] w-[18px] text-[#23442a]" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Secure Checkout</p>
                    <p className="text-xs text-muted-foreground">Encrypted payment flow</p>
                  </div>
                </div>
              </div>
              <div className="surface-card-muted min-w-[172px] px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <TruckIcon className="h-[18px] w-[18px] text-[#23442a]" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedDeliveryOption ? getDeliveryModeLabel(selectedDeliveryOption.mode) : 'Delivery options'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedDeliveryOption
                        ? `${formatDeliveryCurrency(selectedDeliveryOption.fee)} • ${formatDeliveryRange(
                            selectedDeliveryOption.estimated_delivery_start,
                            selectedDeliveryOption.estimated_delivery_end
                          )}`
                        : 'Enter your pincode to view fees and ETA'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="surface-card-muted min-w-[152px] px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <ShoppingBagIcon className="h-[18px] w-[18px] text-[#23442a]" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{cartItems.length} items</p>
                    <p className="text-xs text-muted-foreground">Ready to place</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.32fr)_360px]">
          <section className="surface-card overflow-hidden">
            <div className="border-b px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#23442a]/8">
                  <MapPinIcon className="h-5 w-5 text-[#23442a]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Shipping information</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We will use these details for delivery and order updates.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-5 sm:px-6">
              {error && (
                <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-foreground">
                      First Name *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-foreground">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-2 block text-sm font-medium text-foreground">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="address" className="mb-2 block text-sm font-medium text-foreground">
                    Address *
                  </label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                    className="input-field"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="city" className="mb-2 block text-sm font-medium text-foreground">
                      City *
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className="mb-2 block text-sm font-medium text-foreground">
                      State *
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="zipCode" className="mb-2 block text-sm font-medium text-foreground">
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      required
                      className="input-field"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Delivery options load automatically once the pincode is complete.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="surface-card-muted p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <TruckIcon className="h-[18px] w-[18px] text-[#23442a]" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground">Delivery method</h3>
                        <p className="text-sm text-muted-foreground">
                          Compare speed and charges before placing the order.
                        </p>
                      </div>
                    </div>

                    {formData.zipCode.length < 6 ? (
                      <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 px-3.5 py-3 text-sm text-muted-foreground">
                        Enter a valid pincode to load delivery speed, charges, and ETA.
                      </div>
                    ) : deliveryOptionsLoading ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-3.5 py-3 text-sm text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-[#23442a]" />
                        Checking delivery availability and ETA...
                      </div>
                    ) : deliveryOptionsError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700">
                        {deliveryOptionsError}
                      </div>
                    ) : deliveryOptionsData?.serviceability_checked && !deliveryOptionsData?.serviceable ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700">
                        {deliveryOptionsData?.message || 'Delivery is not available for this pincode.'}
                      </div>
                    ) : deliveryOptionsData?.options?.length ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-border/70 bg-background/70 px-3.5 py-3 text-sm text-muted-foreground">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-semibold text-foreground">
                                {deliveryOptionsData?.city
                                  ? `${deliveryOptionsData.city}, ${deliveryOptionsData.state}`
                                  : `Pincode ${deliveryOptionsData.pincode}`}
                              </p>
                              <p className="mt-1">
                                Dispatch target: {deliveryOptionsData.pickup_slot?.pickup_date || 'Next working slot'}
                              </p>
                            </div>
                            {deliveryOptionsData?.reason && (
                              <p className="text-xs">{deliveryOptionsData.reason}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                          {deliveryOptionsData.options.map((option) => {
                            const isSelected = selectedDeliveryOption?.mode === option.mode;

                            return (
                              <label
                                key={option.mode}
                                className={`flex cursor-pointer items-start gap-3 rounded-[1.25rem] border px-3.5 py-3.5 transition-colors ${
                                  isSelected
                                    ? 'border-[#23442a]/30 bg-white shadow-sm'
                                    : 'border-border/70 bg-transparent hover:bg-white/70'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="deliveryMode"
                                  value={option.mode}
                                  checked={isSelected}
                                  onChange={() => setSelectedDeliveryMode(option.mode)}
                                  className="mt-0.5 h-4 w-4 border-border text-[#23442a] focus:ring-[#23442a]"
                                />
                                <div className="flex-1">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">{option.label}</p>
                                      <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                                    </div>
                                    <div className="text-left sm:text-right">
                                      <p className="text-sm font-semibold text-foreground">
                                        {formatDeliveryCurrency(option.fee)}
                                      </p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {formatDeliveryRange(
                                          option.estimated_delivery_start,
                                          option.estimated_delivery_end
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                                    <span className="rounded-full bg-muted px-2.5 py-1">
                                      Dispatch {option.estimated_dispatch_date}
                                    </span>
                                    <span className="rounded-full bg-muted px-2.5 py-1">
                                      {option.transit_min_days}-{option.transit_max_days} day transit
                                    </span>
                                    {option.free_shipping_applied && (
                                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                                        Free shipping applied
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 px-3.5 py-3 text-sm text-muted-foreground">
                        No delivery options are available yet for this pincode.
                      </div>
                    )}
                  </div>

                  <div className="surface-card-muted p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <CreditCardIcon className="h-[18px] w-[18px] text-[#23442a]" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground">Payment method</h3>
                        <p className="text-sm text-muted-foreground">
                          Choose the option that works best for this order.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {paymentOptions.map((option) => {
                        const isSelected = formData.paymentMethod === option.id;
                        const isDisabled = option.id === 'cod' && codUnavailable;
                        return (
                          <label
                            key={option.id}
                            className={`flex items-start gap-3 rounded-[1.25rem] border px-3.5 py-3.5 transition-colors ${
                              isDisabled
                                ? 'cursor-not-allowed border-border/50 bg-muted/30 opacity-60'
                                : 'cursor-pointer'
                            } ${
                              isSelected && !isDisabled
                                ? 'border-[#23442a]/30 bg-white shadow-sm'
                                : !isDisabled
                                  ? 'border-border/70 bg-transparent hover:bg-white/70'
                                  : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value={option.id}
                              checked={isSelected}
                              onChange={handleChange}
                              disabled={isDisabled}
                              className="mt-0.5 h-4 w-4 border-border text-[#23442a] focus:ring-[#23442a]"
                            />
                            <div>
                              <p className="text-sm font-semibold text-foreground">{option.title}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {isDisabled
                                  ? 'Cash on Delivery is unavailable for this pincode according to the delivery serviceability response.'
                                  : option.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {selectedDeliveryOption
                      ? `${getDeliveryModeLabel(selectedDeliveryOption.mode)} is selected for this order.`
                      : 'Choose a delivery option to continue.'}
                  </p>
                  <button
                    type="submit"
                    disabled={loading || deliveryOptionsLoading || !selectedDeliveryOption}
                    className="store-button-primary h-11 min-w-[210px] rounded-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading
                      ? 'Processing...'
                      : formData.paymentMethod === 'phonepe'
                        ? 'Proceed to Payment'
                        : 'Place Order'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section className="surface-card overflow-hidden">
              <div className="border-b px-5 py-4">
                <h3 className="text-lg font-semibold text-foreground">Order summary</h3>
                <p className="mt-1 text-sm text-muted-foreground">A quick review before you place the order.</p>
              </div>
              <div className="px-5 py-4">
                {selectedDeliveryOption && (
                  <div className="mb-4 rounded-2xl border border-border/70 bg-muted/20 p-3.5">
                    <div className="flex items-start gap-3">
                      <ClockIcon className="mt-0.5 h-5 w-5 text-[#23442a]" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {getDeliveryModeLabel(selectedDeliveryOption.mode)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Estimated arrival {formatDeliveryRange(
                            selectedDeliveryOption.estimated_delivery_start,
                            selectedDeliveryOption.estimated_delivery_end
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-2.5">
                      {getImageUrl(item.image_url, 'product') ? (
                        <img
                          src={getImageUrl(item.image_url, 'product')}
                          alt={item.name}
                          onError={(event) => handleImageError(event, 'product')}
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-xl">📦</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-semibold text-foreground">{item.name}</h4>
                        {item.size && (
                          <p className="mt-1 text-xs font-medium text-muted-foreground">{item.size}</p>
                        )}
                        <p className="mt-1 text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-right text-sm font-semibold text-foreground">
                        ₹{(parseFloat(item.price) * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-2.5 border-t pt-4 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-medium text-foreground">₹{cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{selectedDeliveryOption ? getDeliveryModeLabel(selectedDeliveryOption.mode) : 'Shipping'}</span>
                    <span className={`font-medium ${shippingFee > 0 ? 'text-foreground' : 'text-emerald-700'}`}>
                      {selectedDeliveryOption ? formatDeliveryCurrency(shippingFee) : 'Enter pincode'}
                    </span>
                  </div>
                  {selectedDeliveryOption && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Estimated delivery</span>
                      <span className="font-medium text-foreground">
                        {formatDeliveryRange(
                          selectedDeliveryOption.estimated_delivery_start,
                          selectedDeliveryOption.estimated_delivery_end
                        )}
                      </span>
                    </div>
                  )}
                  {selectedDeliveryOption?.free_shipping_applied && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                      Free surface shipping applied for this order subtotal.
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t pt-3 text-base font-semibold text-foreground">
                    <span>Total</span>
                    <span>₹{orderTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="surface-card-muted p-4">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="mt-0.5 h-5 w-5 text-[#23442a]" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Trusted checkout</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Payment verification, order tracking, and delivery updates stay available after purchase.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
