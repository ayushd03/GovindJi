import React, { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import './ExpensesCalendar.css';

// Placeholder calendar shell: renders a simple grid until FullCalendar is added
// Fetches expenses for the provided dateRange and renders day buckets

const toLocalYMD = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseYMD = (ymd) => {
  if (!ymd || typeof ymd !== 'string' || ymd.trim() === '') {
    console.error('Invalid date string:', ymd);
    return null;
  }
  const [y, m, d] = ymd.split('-').map((v) => parseInt(v, 10));
  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    console.error('Invalid date components:', ymd);
    return null;
  }
  return new Date(y, (m || 1) - 1, d || 1);
};

const ExpensesCalendar = ({ scope, dateRange, onRangeChange, filters, onSelectExpense, onTitleChange }) => {
  const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  const [events, setEvents] = useState([]);
  const [dayItems, setDayItems] = useState(new Map()); // date -> { products: [...], pos: [...], otherExpenses: [...], payments: [...] }
  const [loading, setLoading] = useState(false);
  const [detailDay, setDetailDay] = useState(null); // iso date string for modal
  const [detailPO, setDetailPO] = useState(null); // purchase order for modal
  const calendarRef = useRef(null);
  const onTitleChangeRef = useRef(onTitleChange);
  const lastFetchedRange = useRef(null); // Track last fetched range to prevent duplicates
  const datesSetTimeoutRef = useRef(null); // Debounce datesSet callback

  // Use the actual visible date range from the calendar (includes previous/next month dates)
  const effectiveRange = useMemo(() => dateRange, [dateRange]);

  // Keep ref updated
  useEffect(() => {
    onTitleChangeRef.current = onTitleChange;
  }, [onTitleChange]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (datesSetTimeoutRef.current) {
        clearTimeout(datesSetTimeoutRef.current);
      }
    };
  }, []);

  // Expose navigation methods and update title
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const title = calendarApi.view.title;
      
      // Call onTitleChange with navigation methods
      if (onTitleChangeRef.current) {
        onTitleChangeRef.current(title, {
          prev: () => {
            calendarApi.prev();
            const newTitle = calendarApi.view.title;
            if (onTitleChangeRef.current) {
              onTitleChangeRef.current(newTitle);
            }
          },
          next: () => {
            calendarApi.next();
            const newTitle = calendarApi.view.title;
            if (onTitleChangeRef.current) {
              onTitleChangeRef.current(newTitle);
            }
          },
          today: () => {
            calendarApi.today();
            const newTitle = calendarApi.view.title;
            if (onTitleChangeRef.current) {
              onTitleChangeRef.current(newTitle);
            }
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Update title when calendar view changes
  useEffect(() => {
    if (calendarRef.current && onTitleChangeRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const title = calendarApi.view.title;
      onTitleChangeRef.current(title);
    }
  }, [dateRange, scope]);

  useEffect(() => {
    const fetchForRange = async () => {
      // Check if we've already fetched this exact range to prevent duplicate calls
      const rangeKey = `${effectiveRange.start_date}-${effectiveRange.end_date}`;
      if (lastFetchedRange.current === rangeKey) {
        console.log('Skipping duplicate fetch for range:', rangeKey);
        return;
      }

      console.log('Fetching data for range:', effectiveRange.start_date, 'to', effectiveRange.end_date);
      lastFetchedRange.current = rangeKey;
      
      setLoading(true);
      try {
        const authToken = localStorage.getItem('authToken');

        // 1) Fetch unified transactions for the range (to keep non-PO expenses/payments)
        const txnParams = new URLSearchParams({
          page: '1',
          limit: '500',
          ...(filters.searchTerm && { search: filters.searchTerm }),
          ...(filters.selectedCategory && { category: filters.selectedCategory }),
          ...(filters.selectedPaymentMethod && { payment_method: filters.selectedPaymentMethod }),
          ...(effectiveRange.start_date && { start_date: effectiveRange.start_date }),
          ...(effectiveRange.end_date && { end_date: effectiveRange.end_date })
        });
        const txnRes = await fetch(`${apiBaseUrl}/api/admin/expenses/history?${txnParams.toString()}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const txnPayload = await txnRes.json();
        const txnItems = (txnPayload.data || txnPayload).expenses || [];

        // 2) Fetch purchase orders for the same range (to show products)
        const poParams = new URLSearchParams({
          page: '1',
          limit: '500',
          ...(effectiveRange.start_date && { start_date: effectiveRange.start_date }),
          ...(effectiveRange.end_date && { end_date: effectiveRange.end_date })
        });
        let poItems = [];
        try {
          const poRes = await fetch(`${apiBaseUrl}/api/admin/purchase-orders?${poParams.toString()}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (poRes.ok) {
            const poPayload = await poRes.json();
            // server returns either {data, total,...} or array
            const list = Array.isArray(poPayload) ? poPayload : (poPayload.data || poPayload.purchase_orders || []);
            poItems = list || [];
          }
        } catch {}

        // Group items by date and create product-focused events
        const eventsByDate = new Map();
        
        // Process POs to extract products - normalize dates
        poItems.forEach((po) => {
          if (!po.order_date) {
            console.warn('PO missing order_date:', po);
            return;
          }
          const parsedDate = parseYMD(po.order_date);
          if (!parsedDate) {
            console.warn('PO has invalid order_date:', po.order_date, po);
            return;
          }
          const date = toLocalYMD(parsedDate); // Normalize date
          if (!eventsByDate.has(date)) {
            eventsByDate.set(date, { products: [], pos: [], otherExpenses: [], totalAmount: 0 });
          }
          const dayData = eventsByDate.get(date);
          dayData.pos.push(po);
          dayData.totalAmount += Number(po.final_amount || po.total_amount || 0);
          
          (po.purchase_order_items || []).forEach((item) => {
            dayData.products.push({
              name: item.item_name,
              quantity: item.quantity,
              unit: item.unit,
              amount: Number(item.total_amount || 0),
              po_number: po.po_number,
              vendor_name: po?.party?.name,
              po_id: po.id
            });
          });
        });
        
        // Process other expenses/payments - normalize dates
        txnItems
          .filter((e) => e.expense_category !== 'Vendor Order')
          .forEach((e) => {
            if (!e.transaction_date) {
              console.warn('Transaction missing transaction_date:', e);
              return;
            }
            const parsedDate = parseYMD(e.transaction_date);
            if (!parsedDate) {
              console.warn('Transaction has invalid transaction_date:', e.transaction_date, e);
              return;
            }
            const date = toLocalYMD(parsedDate); // Normalize date
            if (!eventsByDate.has(date)) {
              eventsByDate.set(date, { products: [], pos: [], otherExpenses: [], totalAmount: 0 });
            }
            const dayData = eventsByDate.get(date);
            dayData.otherExpenses.push(e);
            dayData.totalAmount += Number(e.total_amount || 0);
          });
        
        // Create events: first event shows total, subsequent events show products
        const allEvents = [];
        eventsByDate.forEach((dayData, date) => {
          // First event: Daily total
          allEvents.push({
            id: `total-${date}`,
            start: date,
            title: `Total: ₹${dayData.totalAmount.toLocaleString('en-IN')}`,
            extendedProps: { type: 'daily-total', date, dayData },
            classNames: ['fc-event-total']
          });
          
          // Product events (limited to top items)
          dayData.products.slice(0, 3).forEach((product, idx) => {
            allEvents.push({
              id: `product-${date}-${idx}`,
              start: date,
              title: `${product.name || 'Product'} × ${product.quantity}${product.unit ? ' ' + product.unit : ''}`,
              extendedProps: { type: 'product', date, product, dayData },
              classNames: ['fc-event-product']
            });
          });
          
          // If more products, add a "more items" event
          if (dayData.products.length > 3 || dayData.otherExpenses.length > 0) {
            const moreCount = Math.max(0, dayData.products.length - 3) + dayData.otherExpenses.length;
            if (moreCount > 0) {
              allEvents.push({
                id: `more-${date}`,
                start: date,
                title: `+${moreCount} more items`,
                extendedProps: { type: 'more', date, dayData },
                classNames: ['fc-event-more']
              });
            }
          }
        });

        setEvents(allEvents);

        // Build dayItems map combining POs (products) and other expenses/payments
        const map = new Map();
        // Seed days within range
        const start = parseYMD(effectiveRange.start_date);
        const end = parseYMD(effectiveRange.end_date);
        if (start && end) {
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            map.set(toLocalYMD(d), { products: [], pos: [], otherExpenses: [], payments: [] });
          }
        }

        // Fill POs
        poItems.forEach((po) => {
          if (!po.order_date) return;
          const parsedDate = parseYMD(po.order_date);
          if (!parsedDate) return;
          const day = toLocalYMD(parsedDate);
          if (!map.has(day)) map.set(day, { products: [], pos: [], otherExpenses: [], payments: [] });
          const bucket = map.get(day);
          bucket.pos.push(po);
          (po.purchase_order_items || []).forEach((item) => {
            bucket.products.push({
              name: item.item_name,
              quantity: item.quantity,
              unit: item.unit,
              po_number: po.po_number,
              vendor_name: po?.party?.name
            });
          });
        });

        // Fill other expenses/payments from unified transactions
        txnItems.forEach((e) => {
          if (!e.transaction_date) return;
          const parsedDate = parseYMD(e.transaction_date);
          if (!parsedDate) return;
          const day = toLocalYMD(parsedDate);
          if (!map.has(day)) map.set(day, { products: [], pos: [], otherExpenses: [], payments: [] });
          const bucket = map.get(day);
          if (e.expense_category === 'Vendor Payment') {
            bucket.payments.push(e);
          } else if (e.expense_category && e.expense_category !== 'Vendor Order') {
            bucket.otherExpenses.push(e);
          }
        });

        setDayItems(map);
      } catch (err) {
        console.error('Error fetching calendar data:', err);
        // Show error to user but don't silently fail
        alert(`Failed to load calendar data: ${err.message || 'Unknown error'}`);
        setEvents([]);
        setDayItems(new Map());
      } finally {
        setLoading(false);
      }
    };
    fetchForRange();
  }, [apiBaseUrl, effectiveRange.start_date, effectiveRange.end_date, filters?.searchTerm, filters?.selectedCategory, filters?.selectedPaymentMethod]);

  // Build simple day grid
  const days = useMemo(() => {
    const start = parseYMD(effectiveRange.start_date);
    const end = parseYMD(effectiveRange.end_date);
    const out = [];
    if (start && end) {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = toLocalYMD(d);
        out.push({ iso, label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) });
      }
    }
    return out;
  }, [effectiveRange]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const day of days) map.set(day.iso, []);
    for (const ev of events) {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [days, events]);

  return (
    <div className="h-full flex flex-col relative">
      {loading && (
        <div className="calendar-loading-overlay">
          <div className="calendar-spinner">
            <svg className="animate-spin h-12 w-12 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-3 text-slate-700 font-medium">Loading expenses...</p>
          </div>
        </div>
      )}
      <div className="premium-calendar-wrapper flex-1">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={scope === 'week' ? 'dayGridWeek' : 'dayGridMonth'}
          headerToolbar={false}
          buttonText={{ today: 'Today', month: 'Month', week: 'Week' }}
          events={events}
          height="100%"
          dayMaxEventRows={5}
          dayMaxEvents={5}
          moreLinkClick="none"
          displayEventTime={false}
          weekends={true}
          showNonCurrentDates={true}
          fixedWeekCount={true}
          datesSet={(arg) => {
            // Debounce to prevent rapid-fire calls during calendar initialization
            if (datesSetTimeoutRef.current) {
              clearTimeout(datesSetTimeoutRef.current);
            }
            
            datesSetTimeoutRef.current = setTimeout(() => {
              const start = toLocalYMD(arg.start);
              const end = toLocalYMD(new Date(arg.end.getTime() - 86400000));
              console.log('Calendar datesSet:', start, 'to', end);
              onRangeChange({ start_date: start, end_date: end });
            }, 100); // 100ms debounce
          }}
          eventClick={(info) => {
            const { extendedProps } = info.event;
            const eventType = extendedProps?.type;
            
            if (eventType === 'daily-total' || eventType === 'product' || eventType === 'more') {
              // Open day detail modal
              setDetailDay(extendedProps.date);
              info.jsEvent.preventDefault(); // Prevent default popover
              info.jsEvent.stopPropagation();
            }
          }}
          moreLinkClick={(info) => {
            // Open day detail modal when clicking "more" link
            const date = toLocalYMD(info.date);
            setDetailDay(date);
            return 'none'; // Prevent default popover
          }}
          eventClassNames={(arg) => {
            const t = arg.event.extendedProps?.type;
            if (t === 'daily-total') return ['fc-event-total'];
            if (t === 'product') return ['fc-event-product'];
            if (t === 'more') return ['fc-event-more'];
            return [];
          }}
          eventContent={(arg) => {
            const t = arg.event.extendedProps?.type;
            
            if (t === 'daily-total') {
              return (
                <div className="flex items-center gap-2 px-2 py-1 w-full">
                  <svg className="w-4 h-4 flex-shrink-0 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                  </svg>
                  <span className="font-bold text-white text-sm">{arg.event.title}</span>
                </div>
              );
            }
            
            if (t === 'product') {
              const product = arg.event.extendedProps?.product || {};
              const productName = product.name || arg.event.title || 'Product';
              const quantity = product.quantity || '';
              const unit = product.unit || '';
              
              return (
                <div className="flex items-center gap-1.5 px-2 py-0.5 w-full">
                  <svg className="w-3 h-3 flex-shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"/>
                  </svg>
                  <span className="font-semibold text-xs truncate flex-1 text-slate-800">{productName}</span>
                  {quantity && (
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">×{quantity}{unit ? ' ' + unit : ''}</span>
                  )}
                </div>
              );
            }
            
            if (t === 'more') {
              return (
                <div className="flex items-center justify-center gap-1 px-2 py-0.5 w-full">
                  <svg className="w-3 h-3 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-xs font-bold text-slate-700">{arg.event.title}</span>
                </div>
              );
            }
            
            return null;
          }}
        />
      </div>

      {/* Day/PO detail modal */}
      {detailDay && (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900/60 via-blue-900/40 to-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn" onClick={() => setDetailDay(null)}>
          <div className="bg-white rounded-3xl shadow-[0_24px_48px_rgba(0,0,0,0.2)] w-full max-w-4xl max-h-[90vh] overflow-hidden animate-slideUp border border-white/20" onClick={(e) => e.stopPropagation()}>
            <div className="px-8 py-6 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
              
              <div className="flex items-start justify-between w-full relative z-10">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center shadow-xl border border-white/30 ring-4 ring-white/10 flex-shrink-0">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-xl font-bold text-white mb-1">{new Date(detailDay).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    <div className="text-sm text-white/80 font-medium">Transaction Summary</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {(() => {
                    const bucket = dayItems.get(detailDay) || { products: [], pos: [], otherExpenses: [], payments: [] };
                    const purchaseAmount = bucket.pos.reduce((sum, po) => sum + Number(po.final_amount || po.total_amount || 0), 0) +
                                          bucket.otherExpenses.reduce((sum, e) => sum + Number(e.total_amount || 0), 0);
                    const paymentAmount = bucket.payments.reduce((sum, e) => sum + Number(e.total_amount || 0), 0);
                    
                    return (
                      <>
                        <div className="px-4 py-2 bg-emerald-500/30 backdrop-blur-xl rounded-xl border border-white/30 shadow-lg">
                          <div className="text-[10px] text-white/90 font-semibold uppercase tracking-wide">Purchases</div>
                          <div className="text-lg font-bold text-white whitespace-nowrap">₹{purchaseAmount.toLocaleString('en-IN')}</div>
                        </div>
                        
                        {paymentAmount > 0 && (
                          <div className="px-4 py-2 bg-red-500/30 backdrop-blur-xl rounded-xl border border-white/30 shadow-lg">
                            <div className="text-[10px] text-white/90 font-semibold uppercase tracking-wide">Paid Out</div>
                            <div className="text-lg font-bold text-white whitespace-nowrap">₹{paymentAmount.toLocaleString('en-IN')}</div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  
                  <button className="p-2.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm hover:scale-110" onClick={() => setDetailDay(null)}>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="p-8 bg-gradient-to-br from-gray-50 to-white overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                {(() => {
                  const bucket = dayItems.get(detailDay) || { products: [], pos: [], otherExpenses: [], payments: [] };
                  return (
                    <>
                    {/* Products grouped by PO */}
                    {bucket.pos.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 pb-3 border-b-2 border-gradient-to-r from-slate-200 to-slate-100">
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg ring-4 ring-slate-100">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd"/>
                            </svg>
                          </div>
                          <div>
                            <div className="text-base font-bold text-slate-900">Purchase Orders</div>
                            <div className="text-sm text-slate-600">{bucket.pos.length} order{bucket.pos.length !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {bucket.pos.map((po) => (
                            <div key={po.id} className="bg-gradient-to-br from-white to-slate-50/30 border-2 border-slate-200/50 rounded-2xl p-5 hover:shadow-xl hover:border-slate-400 transition-all duration-300 cursor-pointer group hover:-translate-y-1">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center group-hover:from-slate-200 group-hover:to-slate-300 transition-colors shadow-md">
                                    <svg className="w-5 h-5 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="text-base font-bold text-slate-900">{po?.party?.name || 'Vendor'}</div>
                                    <div className="text-sm text-slate-600 font-medium">{po.po_number || 'PO'}</div>
                                  </div>
                                </div>
                                <div className="px-4 py-2 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-base font-bold rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
                                  ₹{Number(po.final_amount || po.total_amount || 0).toLocaleString('en-IN')}
                                </div>
                              </div>
                              <div className="space-y-2 mt-4">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Products</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {(po.purchase_order_items || []).map((it) => (
                                    <div key={it.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 hover:shadow-md hover:border-emerald-300 transition-all group">
                                      <div className="flex items-center gap-2 flex-1">
                                        <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"/>
                                        </svg>
                                        <div className="flex-1">
                                          <div className="text-sm font-bold text-slate-900">{it.item_name}</div>
                                          <div className="text-xs text-slate-600">
                                            Qty: <span className="font-semibold text-emerald-700">{it.quantity} {it.unit || ''}</span>
                                            {it.rate && <span className="ml-2">@ ₹{Number(it.rate).toLocaleString('en-IN')}</span>}
                                          </div>
                                        </div>
                                      </div>
                                      {it.total_amount && (
                                        <div className="ml-2 px-2.5 py-1 bg-white text-emerald-700 text-sm font-bold rounded-lg shadow-sm">
                                          ₹{Number(it.total_amount).toLocaleString('en-IN')}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Other expenses */}
                    {bucket.otherExpenses.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 pb-3 border-b-2 border-gradient-to-r from-slate-200 to-slate-100">
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg ring-4 ring-slate-100">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                            </svg>
                          </div>
                          <div>
                            <div className="text-base font-bold text-slate-900">Other Expenses</div>
                            <div className="text-sm text-slate-600">{bucket.otherExpenses.length} transaction{bucket.otherExpenses.length !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {bucket.otherExpenses.map((e) => (
                            <button key={e.id} className="w-full text-left px-5 py-4 rounded-2xl bg-gradient-to-br from-white to-slate-50/50 border-2 border-slate-200/70 hover:border-slate-400 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1" onClick={() => onSelectExpense?.(e)}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center group-hover:from-slate-200 group-hover:to-slate-300 transition-colors shadow-md">
                                    <svg className="w-5 h-5 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-slate-500 mb-0.5">{e.expense_category}</div>
                                    <div className="text-base text-slate-900 truncate font-semibold">{e.description}</div>
                                  </div>
                                </div>
                                <div className="ml-4 px-4 py-2 bg-gradient-to-br from-slate-600 to-slate-700 text-white text-base font-bold rounded-xl shadow-lg">
                                  ₹{Number(e.total_amount || 0).toLocaleString('en-IN')}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payments */}
                    {bucket.payments.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 pb-3 border-b-2 border-gradient-to-r from-slate-200 to-slate-100">
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg ring-4 ring-slate-100">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                            </svg>
                          </div>
                          <div>
                            <div className="text-base font-bold text-slate-900">Vendor Payments</div>
                            <div className="text-sm text-slate-600">{bucket.payments.length} payment{bucket.payments.length !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {bucket.payments.map((e) => (
                            <button key={e.id} className="w-full text-left px-5 py-4 rounded-2xl bg-gradient-to-br from-white to-slate-50/50 border-2 border-slate-200/70 hover:border-slate-400 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1" onClick={() => onSelectExpense?.(e)}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center group-hover:from-slate-200 group-hover:to-slate-300 transition-colors shadow-md">
                                    <svg className="w-5 h-5 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-base text-slate-900 truncate font-semibold">{e.description}</div>
                                    <div className="text-sm text-slate-600 font-medium">{e.reference_number || 'Payment'}</div>
                                  </div>
                                </div>
                                <div className="ml-4 px-4 py-2 bg-gradient-to-br from-slate-600 to-slate-700 text-white text-base font-bold rounded-xl shadow-lg">
                                  ₹{Number(e.total_amount || 0).toLocaleString('en-IN')}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesCalendar;


