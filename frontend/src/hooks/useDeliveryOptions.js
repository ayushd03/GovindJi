import { useEffect, useState } from 'react';
import { deliveryAPI } from '../services/api';

export const DELIVERY_PINCODE_STORAGE_KEY = 'deliveryPincode';

export const normalizeDeliveryPincode = (value = '') => String(value).replace(/\D/g, '').slice(0, 6);

export const getStoredDeliveryPincode = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeDeliveryPincode(window.localStorage.getItem(DELIVERY_PINCODE_STORAGE_KEY) || '');
};

export const storeDeliveryPincode = (value) => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeDeliveryPincode(value);
  if (normalized.length === 6) {
    window.localStorage.setItem(DELIVERY_PINCODE_STORAGE_KEY, normalized);
  }
};

export const useDeliveryOptions = ({ pincode, subtotal = 0, enabled = true }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const normalizedPincode = normalizeDeliveryPincode(pincode);

    if (!enabled || normalizedPincode.length !== 6) {
      setData(null);
      setError('');
      setLoading(false);
      return undefined;
    }

    let isActive = true;
    setLoading(true);
    setError('');

    deliveryAPI.getOptions(normalizedPincode, subtotal)
      .then((response) => {
        if (!isActive) {
          return;
        }

        setData(response.data);
        storeDeliveryPincode(normalizedPincode);
      })
      .catch((requestError) => {
        if (!isActive) {
          return;
        }

        setData(null);
        setError(requestError.response?.data?.error || 'Unable to load delivery options right now.');
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [enabled, pincode, subtotal]);

  return { data, loading, error };
};
