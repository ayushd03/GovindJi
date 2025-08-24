import React from 'react';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  UserIcon,
  TagIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

const TransactionSummary = ({ 
  transactionData, 
  validationErrors = {}, 
  onSubmit, 
  submitting = false 
}) => {
  const formatCurrency = (amount) => {
    if (!amount) return '₹0.00';
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 2 
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPaymentMethodDisplay = (paymentMethod) => {
    if (!paymentMethod?.type) return 'Not selected';
    
    const typeNames = {
      cash: 'Cash',
      upi: 'UPI',
      cheque: 'Cheque'
    };
    
    let display = typeNames[paymentMethod.type] || paymentMethod.type;
    
    if (paymentMethod.details) {
      if (paymentMethod.details.reference_number) {
        display += ` (${paymentMethod.details.reference_number})`;
      }
      if (paymentMethod.details.cheque_number) {
        display += ` (#${paymentMethod.details.cheque_number})`;
      }
    }
    
    return display;
  };

  const hasErrors = Object.keys(validationErrors).length > 0;
  const isComplete = transactionData.description && 
                   transactionData.total_amount > 0 && 
                   transactionData.payment_method?.type &&
                   transactionData.transaction_date;

  const getCompletionPercentage = () => {
    let completed = 0;
    const total = 5; // Total required fields
    
    if (transactionData.description) completed++;
    if (transactionData.total_amount > 0) completed++;
    if (transactionData.payment_method?.type) completed++;
    if (transactionData.transaction_date) completed++;
    if (transactionData.category || transactionData.items?.length > 0) completed++;
    
    return Math.round((completed / total) * 100);
  };

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Transaction Summary</span>
            <div className="flex items-center space-x-2">
              {isComplete ? (
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completion</span>
              <span className="font-medium">{getCompletionPercentage()}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${getCompletionPercentage()}%` }}
              />
            </div>
          </div>

          {/* Key details */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <CurrencyDollarIcon className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-semibold text-lg">
                  {formatCurrency(transactionData.total_amount)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <CalendarIcon className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {formatDate(transactionData.transaction_date)}
                </p>
              </div>
            </div>

            {transactionData.parties?.length > 0 && (
              <div className="flex items-center space-x-3">
                <UserIcon className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Party</p>
                  <p className="font-medium">
                    {transactionData.parties[0].name}
                  </p>
                </div>
              </div>
            )}

            {transactionData.category && (
              <div className="flex items-center space-x-3">
                <TagIcon className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">
                    {transactionData.category}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start space-x-3">
              <CurrencyDollarIcon className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <p className="font-medium">
                  {getPaymentMethodDisplay(transactionData.payment_method)}
                </p>
              </div>
            </div>
          </div>

          {/* Items summary for multi-item transactions */}
          {transactionData.items?.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-foreground mb-2">
                Items ({transactionData.items.length})
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {transactionData.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate">
                      {item.product_name || item.description}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {transactionData.description && (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <p className="text-sm font-medium">
                {transactionData.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {hasErrors && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-800">
              <ExclamationTriangleIcon className="w-5 h-5" />
              <span>Validation Errors</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(validationErrors).map(([field, error]) => (
                <div key={field} className="text-sm text-red-700">
                  <span className="font-medium capitalize">
                    {field.replace('_', ' ')}:
                  </span>{' '}
                  {error}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      <div className="space-y-3">
        <Button
          onClick={onSubmit}
          disabled={!isComplete || hasErrors || submitting}
          className={cn(
            "w-full py-3 font-medium transition-all",
            isComplete && !hasErrors
              ? "bg-primary hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {submitting ? (
            <>
              <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircleIcon className="w-4 h-4 mr-2" />
              Submit Transaction
            </>
          )}
        </Button>

        {!isComplete && (
          <p className="text-xs text-muted-foreground text-center">
            Complete all required fields to enable submission
          </p>
        )}
      </div>
    </div>
  );
};

export default TransactionSummary;