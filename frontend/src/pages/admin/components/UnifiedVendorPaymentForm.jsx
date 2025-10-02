import React, { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { useToast } from '../../../hooks/useToast';
import PartySelector from './PartySelector';
import PaymentMethodSelector from './PaymentMethodSelector';
import {
  PlusIcon,
  TrashIcon,
  ClipboardDocumentListIcon,
  CurrencyRupeeIcon,
  ArrowPathIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const defaultRow = (party = null) => ({
  party,
  amount: '',
  payment_date: new Date().toISOString().split('T')[0],
  payment_method: { type: '', details: {} },
  reference_number: '',
  notes: ''
});

const formatCurrency = (amount) => {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(val);
};

const UnifiedVendorPaymentForm = forwardRef(({
  preSelectedParty = null,
  lockParty = false,
  initialRows = 1,
  onCancel,
  onSuccess,
  renderActions = true
}, ref) => {
  const { toast } = useToast();
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const [rows, setRows] = useState(() => {
    const count = Math.max(1, initialRows);
    if (preSelectedParty) {
      return Array.from({ length: count }, () => defaultRow(preSelectedParty));
    }
    return [defaultRow()];
  });
  const [submitting, setSubmitting] = useState(false);
  const [rowErrors, setRowErrors] = useState({});

  useEffect(() => {
    if (preSelectedParty && rows.length > 0) {
      setRows((prev) => prev.map((r) => ({ ...r, party: preSelectedParty })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectedParty]);

  const totalAmount = useMemo(
    () => rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
    [rows]
  );

  const updateRow = (index, updates) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const addRow = (prefill = null) => {
    setRows((prev) => [...prev, prefill ? { ...prefill } : defaultRow(preSelectedParty || null)]);
  };

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const duplicateRow = (index) => {
    setRows((prev) => {
      const row = prev[index];
      const clone = {
        ...row,
        reference_number: row.reference_number || '',
        notes: row.notes || ''
      };
      return [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)];
    });
  };

  const validate = () => {
    const errors = {};
    rows.forEach((r, idx) => {
      const e = {};
      if (!r.party?.id && !r.party?.party_id) e.party = 'Party is required';
      if (!r.amount || isNaN(Number(r.amount)) || Number(r.amount) <= 0)
        e.amount = 'Positive amount required';
      if (!r.payment_date) e.payment_date = 'Date is required';
      if (!r.payment_method?.type) e.payment_method = 'Payment method is required';
      if (r.payment_method?.type === 'cheque') {
        if (!r.payment_method.details?.cheque_number) e.cheque_number = 'Cheque number required';
        if (!r.payment_method.details?.release_date) e.release_date = 'Release date required';
      }
      if (Object.keys(e).length) errors[idx] = e;
    });
    setRowErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast({
        title: 'Validation failed',
        description: 'Please fix highlighted errors before submitting.',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('authToken');
      const payload = {
        payments: rows.map((r) => ({
          party_id: r.party?.id || r.party?.party_id,
          payment_type: 'payment',
          amount: Number(r.amount),
          payment_date: r.payment_date,
          transaction_type_id: r.payment_method.type,
          transaction_fields: {
            ...r.payment_method.details,
            reference_number: r.payment_method.details?.reference_number || r.reference_number || undefined
          },
          reference_number: r.reference_number || null,
          notes: r.notes || null
        }))
      };

      const res = await fetch(`${API_BASE_URL}/api/admin/party-payments/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create payments');

      const createdCount = data?.created?.length || 0;
      const errorCount = data?.errors?.length || 0;

      if (createdCount > 0) {
        toast({
          title: 'Payments saved',
          description: `${createdCount} payment(s) created${errorCount ? `, ${errorCount} failed` : ''}.`,
          variant: 'success'
        });
      }

      if (errorCount) {
        // Map errors back to rows for inline display
        const errs = {};
        (data.errors || []).forEach((err) => {
          errs[err.index] = { api: err.error };
        });
        setRowErrors(errs);
        toast({
          title: 'Some payments failed',
          description: 'Please review inline errors and try again.',
          variant: 'destructive'
        });
      }

      if (createdCount && onSuccess) onSuccess(data);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  useImperativeHandle(ref, () => ({
    submit: handleSubmit
  }));

  return (
    <div className={`space-y-4 ${renderActions ? 'pb-24' : ''}`}>
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Payments</p>
                <p className="text-lg font-semibold">{rows.length}</p>
              </div>
              <ClipboardDocumentListIcon className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="text-lg font-semibold">{formatCurrency(totalAmount)}</p>
              </div>
              <CurrencyRupeeIcon className="w-6 h-6 text-info" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Actions</p>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant="outline" onClick={() => addRow()}>
                    <PlusIcon className="w-4 h-4 mr-1" /> Add Row
                  </Button>
                </div>
              </div>
              <DocumentTextIcon className="w-6 h-6 text-secondary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rows */}
      <div className="space-y-3 relative z-0">
        {rows.map((row, index) => (
          <Card key={index}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Payment #{index + 1}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 py-3 px-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">Vendor *</label>
                  <PartySelector
                    selectedParty={row.party}
                    onPartyChange={(p) => updateRow(index, { party: p })}
                    partyType="vendor"
                    className={`${lockParty ? 'pointer-events-none opacity-75' : ''}`}
                    error={rowErrors[index]?.party}
                  />
                  {rowErrors[index]?.party && (
                    <p className="text-red-500 text-xs mt-1">{rowErrors[index].party}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm ${rowErrors[index]?.amount ? 'border-red-500' : 'border-border'}`}
                    value={row.amount}
                    onChange={(e) => updateRow(index, { amount: e.target.value })}
                    placeholder="0.00"
                  />
                  {rowErrors[index]?.amount && (
                    <p className="text-red-500 text-xs mt-1">{rowErrors[index].amount}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Date *</label>
                  <input
                    type="date"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm ${rowErrors[index]?.payment_date ? 'border-red-500' : 'border-border'}`}
                    value={row.payment_date}
                    onChange={(e) => updateRow(index, { payment_date: e.target.value })}
                  />
                  {rowErrors[index]?.payment_date && (
                    <p className="text-red-500 text-xs mt-1">{rowErrors[index].payment_date}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Payment Method *</label>
                <PaymentMethodSelector
                  paymentMethod={row.payment_method}
                  onPaymentMethodChange={(pm) => updateRow(index, { payment_method: pm })}
                  errors={{
                    ...(rowErrors[index]?.payment_method ? { type: rowErrors[index].payment_method } : {}),
                    ...(rowErrors[index]?.cheque_number ? { cheque_number: rowErrors[index].cheque_number } : {}),
                    ...(rowErrors[index]?.release_date ? { release_date: rowErrors[index].release_date } : {})
                  }}
                />
                {rowErrors[index]?.payment_method && (
                  <p className="text-red-500 text-xs mt-1">{rowErrors[index].payment_method}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Reference (optional)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    value={row.reference_number}
                    onChange={(e) => updateRow(index, { reference_number: e.target.value })}
                    placeholder="Receipt/UPI/Check reference"
                  />
                  {rowErrors[index]?.api && (
                    <p className="text-red-500 text-xs mt-1">{rowErrors[index].api}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    value={row.notes}
                    onChange={(e) => updateRow(index, { notes: e.target.value })}
                    placeholder="PO numbers or allocation notes"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">{formatCurrency(row.amount)}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => duplicateRow(index)}>Duplicate</Button>
                  <Button variant="destructive" size="sm" onClick={() => removeRow(index)} disabled={rows.length === 1}>
                    <TrashIcon className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {renderActions && (
        <>
          <div className="h-20"></div>
          <div className="sticky bottom-0 bg-card border-t border-border mt-2 py-3 px-3 flex items-center justify-end gap-2 z-20 shadow-md">
            <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              {submitting ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" /> Saving
                </>
              ) : (
                <>Save Payments</>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
});

export default UnifiedVendorPaymentForm;


