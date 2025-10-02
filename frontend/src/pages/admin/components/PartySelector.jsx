import React, { useState, useEffect, useRef } from 'react';
import { 
  MagnifyingGlassIcon, 
  ChevronDownIcon, 
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { cn } from '../../../lib/utils';
import { useApiSearch } from '../../../hooks/useApiSearch';
import AddVendorModal from './AddVendorModal';

const PartySelector = ({ 
  selectedParty, 
  onPartyChange, 
  partyType = '', // 'vendor', 'customer', or '' for all
  error, 
  placeholder = "Search for a party...",
  className = "" 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Use API search for parties
  const {
    results: searchResults,
    loading,
    error: searchError
  } = useApiSearch(
    '/api/admin/expenses/search/parties',
    searchTerm,
    {
      debounceDelay: 300,
      minSearchLength: 0, // Changed from 1 to 0 to show results by default
      limit: 20,
      filters: partyType ? { party_type: partyType } : {},
      enabled: isOpen // Only search when dropdown is open
    }
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handlePartySelect = (party) => {
    onPartyChange(party);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClearSelection = () => {
    onPartyChange(null);
    setSearchTerm('');
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setIsOpen(false); // Close the dropdown
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleVendorAdded = (vendor) => {
    // Refresh search results by clearing and re-setting search term
    // This will trigger the useApiSearch hook to refetch data
    const currentSearch = searchTerm;
    setSearchTerm('');
    setTimeout(() => setSearchTerm(currentSearch), 100);

    // Auto-select the newly added vendor if it matches the search
    if (vendor && vendor.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      handlePartySelect(vendor);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getBalanceColor = (balance) => {
    if (!balance) return 'text-muted-foreground';
    return balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-600' : 'text-muted-foreground';
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Selected Party Display / Search Input */}
      <div
        className={cn(
          "w-full px-3 py-2 border rounded-lg cursor-pointer transition-colors",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary",
          error ? "border-red-500" : "border-border hover:border-primary/50",
          isOpen && "ring-2 ring-primary"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedParty ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <BuildingOfficeIcon className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{selectedParty.name}</p>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  {selectedParty.contact_person && (
                    <span>{selectedParty.contact_person}</span>
                  )}
                  {selectedParty.balance !== undefined && (
                    <span className={cn("font-medium", getBalanceColor(selectedParty.balance))}>
                      {formatCurrency(selectedParty.balance)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearSelection();
                }}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                ×
              </button>
              <ChevronDownIcon 
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  isOpen && "transform rotate-180"
                )} 
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <MagnifyingGlassIcon className="w-5 h-5 text-muted-foreground" />
            <span className="text-muted-foreground">{placeholder}</span>
            <ChevronDownIcon 
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform ml-auto",
                isOpen && "transform rotate-180"
              )} 
            />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Search parties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Parties list */}
          <div className="max-h-60 overflow-y-auto">
            {loading && (
              <div className="p-4 flex items-center justify-center">
                <ArrowPathIcon className="w-5 h-5 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            )}

            {!loading && searchError && (
              <div className="p-4 text-center text-red-500">
                <p className="text-sm">Error loading parties: {searchError}</p>
              </div>
            )}

            {!loading && !searchError && searchResults.length > 0 ? (
              searchResults.map((party) => (
                <button
                  key={party.id}
                  type="button"
                  className="w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-b-0"
                  onClick={() => handlePartySelect(party)}
                >
                  <div className="flex items-center space-x-3">
                    <BuildingOfficeIcon className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{party.name}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        {party.contact_person && (
                          <span className="text-sm text-muted-foreground">
                            {party.contact_person}
                          </span>
                        )}
                        {party.phone_number && (
                          <span className="text-sm text-muted-foreground">
                            {party.phone_number}
                          </span>
                        )}
                      </div>
                      
                      {/* Balance and recent activity */}
                      <div className="flex items-center justify-between mt-2">
                        {party.current_balance !== undefined && (
                          <div className="flex items-center space-x-1">
                            <CurrencyDollarIcon className="w-4 h-4 text-muted-foreground" />
                            <span className={cn("text-sm font-medium", getBalanceColor(party.current_balance))}>
                              {formatCurrency(party.current_balance)}
                            </span>
                          </div>
                        )}
                        
                        {party.last_transaction_date && (
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <ClockIcon className="w-3 h-3" />
                            <span>
                              Last: {new Date(party.last_transaction_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            ) : !loading && !searchError && searchTerm && (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">
                  {searchTerm.length < 1 ? 'Type to search parties...' : 'No parties found matching your search.'}
                </p>
              </div>
            )}

            {/* Removed the "Type to search" message when no search term - now shows all parties by default */}
          </div>

          {/* Add new party option */}
          {searchTerm && !loading && searchResults.length === 0 && (
            <div className="p-3 border-t border-border">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                onClick={handleOpenModal}
              >
                + Add new party "{searchTerm}"
              </button>
            </div>
          )}
        </div>
      )}

      {/* AddVendorModal for adding new vendors */}
      <AddVendorModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onVendorAdded={handleVendorAdded}
        defaultName={searchTerm}
        mode="add"
        apiBaseUrl={API_BASE_URL}
      />
    </div>
  );
};

export default PartySelector;