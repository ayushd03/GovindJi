// Centralized finance-related color helpers to enforce consistency across UI
// Semantics:
// - Positive balance (amount due to vendor) => red
// - Negative balance (credit/advance) => green
// - Zero/undefined => muted/neutral

export const getBalanceTextColor = (amount) => {
  if (amount === undefined || amount === null || Number(amount) === 0) {
    return 'text-muted-foreground';
  }
  return Number(amount) > 0 ? 'text-red-600' : 'text-green-600';
};

export const getBalancePillColors = (amount) => {
  if (amount === undefined || amount === null || Number(amount) === 0) {
    return 'bg-muted text-foreground';
  }
  return Number(amount) > 0
    ? 'bg-red-50 text-red-700 border border-red-200'
    : 'bg-green-50 text-green-700 border border-green-200';
};

export const getTransactionRowColors = (type) => {
  // type: 'po_created' (due) | 'payment' (credit)
  if (type === 'po_created') return 'bg-red-50 border-red-200';
  if (type === 'payment') return 'bg-green-50 border-green-200';
  return 'bg-muted/50 border-border';
};

export const getTransactionAmountText = (type) => {
  if (type === 'po_created') return 'text-red-600';
  if (type === 'payment') return 'text-green-600';
  return 'text-foreground';
};

export const getTransactionSubText = (type) => {
  if (type === 'po_created') return 'text-red-500';
  if (type === 'payment') return 'text-green-500';
  return 'text-muted-foreground';
};


