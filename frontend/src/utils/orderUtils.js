/**
 * Format a shipping_address (object or string) into a display string.
 * Returns 'N/A' for falsy values.
 */
export function formatShippingAddress(address) {
  if (!address) return 'N/A';
  if (typeof address === 'string') return address;

  const parts = [
    address.name,
    address.address,
    address.city,
    address.state,
  ].filter(Boolean);

  const line = parts.join(', ');
  return address.pincode ? `${line} - ${address.pincode}` : line || 'N/A';
}
