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
import { useApiSearch, prefetchApiSearch } from '../../../hooks/useApiSearch';
import AddVendorModal from './AddVendorModal';
import { getBalanceTextColor } from '../../../utils/financeColors';

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

  // Prefetch initial parties (vendors/customers) on mount for instant dropdown open
  useEffect(() => {
    prefetchApiSearch('/api/admin/expenses/search/parties', {
      limit: 20,
      filters: partyType ? { party_type: partyType } : {}
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyType]);

  // Use API search for parties
  const {
    results: searchResults,
    loading,
    error: searchError,
    hasMore,
    loadMore,
    loadingMore
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

  const getBalanceColor = (balance) => getBalanceTextColor(balance);

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Selected Party Display / Search Input */}
      <div
        className={cn(
          "w-full px-2 py-1.5 border rounded-md cursor-pointer transition-colors text-sm",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary",
          error ? "border-red-500" : "border-border hover:border-primary/50",
          isOpen && "ring-2 ring-primary"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2">
          <MagnifyingGlassIcon className="w-4 h-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder={selectedParty ? selectedParty.name : placeholder}
            value={isOpen ? searchTerm : (selectedParty?.name || '')}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
          />
          {selectedParty && (
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
          )}
          <ChevronDownIcon 
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              isOpen && "transform rotate-180"
            )} 
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-72 overflow-hidden">
          {/* Parties list with infinite scroll */}
          <div 
            className="max-h-60 overflow-y-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
                if (hasMore && !loading && !loadingMore) {
                  loadMore();
                }
              }
            }}
          >
            {loading && (
              <div className="p-3 flex items-center justify-center text-xs text-muted-foreground">
                <ArrowPathIcon className="w-4 h-4 animate-spin text-primary mr-2" />
                Searching...
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
                  className="w-full px-3 py-2 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-b-0 text-sm"
                  onClick={() => handlePartySelect(party)}
                >
                  <div className="flex items-center space-x-2">
                    <BuildingOfficeIcon className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{party.name}</p>
                      <div className="flex items-center space-x-3 mt-0.5 text-xs text-muted-foreground">
                        {party.contact_person && (
                          <span>{party.contact_person}</span>
                        )}
                        {party.phone_number && (
                          <span>{party.phone_number}</span>
                        )}
                      </div>
                      
                      {/* Balance and recent activity */}
                      <div className="flex items-center justify-between mt-1">
                        {party.current_balance !== undefined && (
                          <div className="flex items-center space-x-1">
                            <CurrencyDollarIcon className="w-3 h-3 text-muted-foreground" />
                            <span className={cn("text-xs font-medium", getBalanceColor(party.current_balance))}>
                              {formatCurrency(party.current_balance)}
                            </span>
                          </div>
                        )}
                        
                        {party.last_transaction_date && (
                          <div className="flex items-center space-x-1 text-[11px] text-muted-foreground">
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
              <div className="p-3 text-center text-muted-foreground text-sm">
                <p>
                  {searchTerm.length < 1 ? 'Type to search parties...' : 'No parties found matching your search.'}
                </p>
              </div>
            )}
            {loadingMore && (
              <div className="p-2 flex items-center justify-center text-xs text-muted-foreground">Loading more…</div>
            )}

            {/* Removed the "Type to search" message when no search term - now shows all parties by default */}
          </div>

          {/* Add new party option */}
          {searchTerm && !loading && searchResults.length === 0 && (
            <div className="p-2 border-t border-border">
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-md transition-colors"
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