import React from 'react';
import { 
  CurrencyDollarIcon,
  BuildingOfficeIcon,
  UserIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { Card, CardContent } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';

const CATEGORIES = [
  {
    id: 'quick_expense',
    name: 'Quick Expense',
    description: 'Simple expense entry for common transactions',
    icon: CurrencyDollarIcon,
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50 border-blue-200 text-blue-700',
    hoverColor: 'hover:bg-blue-100'
  },
  {
    id: 'vendor_payment',
    name: 'Vendor Payment',
    description: 'Multi-item payments with vendor support',
    icon: UserIcon,
    color: 'bg-green-500',
    lightColor: 'bg-green-50 border-green-200 text-green-700',
    hoverColor: 'hover:bg-green-100'
  },
  {
    id: 'vendor_order',
    name: 'Vendor Order',
    description: 'Multi-item purchase orders from vendors',
    icon: BuildingOfficeIcon,
    color: 'bg-purple-500',
    lightColor: 'bg-purple-50 border-purple-200 text-purple-700',
    hoverColor: 'hover:bg-purple-100'
  },
  {
    id: 'other_expense',
    name: 'Other Expense',
    description: 'Miscellaneous business expenses',
    icon: DocumentTextIcon,
    color: 'bg-orange-500',
    lightColor: 'bg-orange-50 border-orange-200 text-orange-700',
    hoverColor: 'hover:bg-orange-100'
  }
];

const CategorySelector = ({ selectedCategory, onCategoryChange }) => {
  const handleCategorySelect = (categoryId) => {
    onCategoryChange(categoryId);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-foreground mb-2">Select Expense Category</h3>
        <p className="text-sm text-muted-foreground">
          Choose the type of expense you want to record
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORIES.map((category) => {
          const IconComponent = category.icon;
          const isSelected = selectedCategory === category.id;
          
          return (
            <Card
              key={category.id}
              className={cn(
                "cursor-pointer transition-all duration-200 border-2",
                isSelected 
                  ? category.lightColor
                  : "border-border hover:border-primary/50",
                !isSelected && category.hoverColor
              )}
              onClick={() => handleCategorySelect(category.id)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    isSelected ? "bg-white shadow-sm" : "bg-muted"
                  )}>
                    <IconComponent 
                      className={cn(
                        "w-6 h-6",
                        isSelected ? "text-current" : "text-muted-foreground"
                      )} 
                    />
                  </div>
                  
                  <div>
                    <h4 className={cn(
                      "font-medium text-sm mb-1",
                      isSelected ? "text-current" : "text-foreground"
                    )}>
                      {category.name}
                    </h4>
                    <p className={cn(
                      "text-xs",
                      isSelected ? "text-current/80" : "text-muted-foreground"
                    )}>
                      {category.description}
                    </p>
                  </div>

                  {/* Special indicator for vendor payment multi-item support */}
                  {category.id === 'vendor_payment' && (
                    <div className="flex items-center justify-center">
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        isSelected 
                          ? "bg-white/50 text-current" 
                          : "bg-primary/10 text-primary"
                      )}>
                        Multi-vendor
                      </span>
                    </div>
                  )}

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-current"></div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default CategorySelector;