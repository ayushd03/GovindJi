import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { deliveryAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { useToast } from '../../../hooks/useToast';
import { ADMIN_PERMISSIONS } from '../../../enums/roles';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  MapPinIcon,
  TruckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const defaultForm = {
  is_enabled: true,
  auto_move_orders_to_processing: true,
  auto_create_shipment: true,
  auto_schedule_pickup: true,
  pickup_location: '',
  pickup_time: '10:00:00',
  pickup_cutoff_time: '14:00:00',
  pickup_buffer_days: 0,
  allow_same_day_pickup: true,
  operating_days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  shipping_mode: 'Surface',
  free_shipping_threshold: 0,
  surface_delivery_fee: 0,
  express_delivery_fee: 120,
  surface_min_delivery_days: 3,
  surface_max_delivery_days: 5,
  express_min_delivery_days: 1,
  express_max_delivery_days: 2,
  default_package_length: 20,
  default_package_width: 15,
  default_package_height: 15
};

const automationOptions = [
  ['is_enabled', 'Enable Delhivery', 'Pause courier automation without deleting your saved defaults.'],
  ['auto_move_orders_to_processing', 'Move ready orders to processing', 'New paid and COD orders move to processing automatically. When off, they stay pending until you move them manually.'],
  ['auto_create_shipment', 'Create shipment automatically', 'Generate the AWB as soon as the order is ready for courier handover.'],
  ['auto_schedule_pickup', 'Request pickup automatically', 'Use the next saved slot and reuse an open request when one already exists.']
];

const formatDateTime = (date, time) => {
  if (!date) return 'Not scheduled';
  const value = time ? `${date}T${time}` : date;
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatOperatingDays = (days = []) => {
  if (!days.length) return 'No working days selected';
  return days.map((day) => `${day[0]}${day.slice(1).toLowerCase()}`).join(', ');
};

const formatCurrency = (value) => `₹${Number.parseFloat(value || 0).toFixed(2)}`;

const formatCourierStatusLabel = (status = '') => (
  status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
);

const OrderFulfillmentPanel = ({ initialOpen = false }) => {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const canManage = hasPermission(ADMIN_PERMISSIONS.MANAGE_ORDERS);
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [showPackageDefaults, setShowPackageDefaults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [nextSlot, setNextSlot] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [pickupRequests, setPickupRequests] = useState([]);

  useEffect(() => {
    if (initialOpen) {
      setIsOpen(true);
    }
  }, [initialOpen]);

  const fetchData = useCallback(async () => {
    try {
      // Only set loading for initial load, use isRefreshing for subsequent refreshes
      if (!isOpen) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const [settingsResponse, shipmentsResponse, pickupResponse] = await Promise.all([
        deliveryAPI.getSettings(),
        deliveryAPI.getShipments({ limit: 5 }),
        deliveryAPI.getPickupRequests()
      ]);

      setForm({ ...defaultForm, ...settingsResponse.data.settings });
      setNextSlot(settingsResponse.data.next_pickup_slot || null);
      setShipments(shipmentsResponse.data.shipments || []);
      setPickupRequests(pickupResponse.data.pickup_requests || []);
    } catch (error) {
      toast({
        title: 'Unable to load courier settings',
        description: error.response?.data?.error || 'Please refresh and try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [toast, isOpen]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = useMemo(() => {
    const pendingPickupCount = shipments.filter(
      (shipment) => ['MANIFESTED', 'PENDING'].includes(shipment.status) && !shipment.pickup_scheduled_date
    ).length;

    return {
      pendingPickupCount,
      openPickupRequests: pickupRequests.filter((request) => ['SCHEDULED', 'REQUESTED', 'CREATED'].includes(request.status)).length,
      latestPickup: pickupRequests[0] || null
    };
  }, [pickupRequests, shipments]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day) => {
    setForm((prev) => {
      const exists = prev.operating_days.includes(day);
      const operating_days = exists
        ? prev.operating_days.filter((item) => item !== day)
        : [...prev.operating_days, day];

      return { ...prev, operating_days };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await deliveryAPI.updateSettings(form);
      setForm({ ...defaultForm, ...response.data.settings });
      setNextSlot(response.data.next_pickup_slot || null);
      toast({
        title: 'Courier settings updated',
        description: 'New ready-to-ship orders will follow the latest pickup defaults.'
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error.response?.data?.error || 'Please review the settings and try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="admin-section p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Fulfillment & Delhivery</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Courier settings stay attached to orders, but the detailed setup opens separately so the order list stays visible.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchData}
              className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
            >
              <TruckIcon className="h-4 w-4" />
              Open settings
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
            <span className="text-sm text-muted-foreground">Loading fulfillment overview...</span>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">Next slot: {formatDateTime(nextSlot?.pickup_date, nextSlot?.pickup_time)}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">Pickup: {form.pickup_location || 'Not set'}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next slot</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formatDateTime(nextSlot?.pickup_date, nextSlot?.pickup_time)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Awaiting pickup</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{summary.pendingPickupCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Open requests</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{summary.openPickupRequests}</p>
              </div>
            </div>
          </>
        )}
      </section>

      <Transition show={isOpen} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-3 text-center sm:items-center sm:p-6">
              <Transition.Child
                as={React.Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-3xl border bg-card text-left shadow-2xl transition-all w-full max-w-6xl sm:my-8">
                  <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <Dialog.Title as="h3" className="text-lg font-semibold text-foreground">Fulfillment & Delhivery</Dialog.Title>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Keep daily courier controls modular, without burying the actual orders table on the main page.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3 pr-10 sm:pr-12">
                        <button
                          onClick={fetchData}
                          disabled={isRefreshing}
                          className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                          {isRefreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={!canManage || saving}
                          className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="absolute right-4 top-4 rounded-md bg-card text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
                    {loading ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                        <span className="ml-3 text-sm text-muted-foreground">Loading fulfillment settings...</span>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Next pickup slot</p>
                                <p className="mt-2 text-base font-bold text-foreground">{formatDateTime(nextSlot?.pickup_date, nextSlot?.pickup_time)}</p>
                                <p className="mt-2 text-sm text-muted-foreground">{nextSlot?.pickup_location || form.pickup_location || 'Pickup location not set'}</p>
                              </div>
                              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                                <ClockIcon className="h-6 w-6" />
                              </div>
                            </div>
                          </div>

                          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Awaiting pickup</p>
                                <p className="mt-2 text-2xl font-bold text-foreground">{summary.pendingPickupCount}</p>
                                <p className="mt-2 text-sm text-muted-foreground">Manifested shipments still waiting for a pickup slot.</p>
                              </div>
                              <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                                <CubeIcon className="h-6 w-6" />
                              </div>
                            </div>
                          </div>

                          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Open pickup requests</p>
                                <p className="mt-2 text-2xl font-bold text-foreground">{summary.openPickupRequests}</p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {summary.latestPickup
                                    ? `Latest: ${formatDateTime(summary.latestPickup.pickup_date, summary.latestPickup.pickup_time)}`
                                    : 'No pickup requests yet.'}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-violet-50 p-3 text-violet-600">
                                <MapPinIcon className="h-6 w-6" />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
                          <div className="space-y-6">
                            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                              <div className="mb-4">
                                <h3 className="text-base font-semibold text-foreground">Automation rules</h3>
                                <p className="mt-1 text-sm text-muted-foreground">These apply to new live orders. Shipment and pickup automation only start after the order reaches processing, either automatically or when you move it manually.</p>
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                {automationOptions.map(([key, label, description]) => (
                                  <label key={key} className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <p className="text-sm font-semibold text-foreground">{label}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(form[key])}
                                        disabled={!canManage}
                                        onChange={(event) => updateField(key, event.target.checked)}
                                        className="mt-1 h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                      />
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                              <div className="mb-4">
                                <h3 className="text-base font-semibold text-foreground">Pickup defaults</h3>
                                <p className="mt-1 text-sm text-muted-foreground">These settings decide when pickup is requested for ready shipments.</p>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                  <label className="mb-2 block text-sm font-medium text-foreground">Pickup location name</label>
                                  <input
                                    value={form.pickup_location}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('pickup_location', event.target.value)}
                                    className="input-field"
                                    placeholder="Main Warehouse"
                                  />
                                  <p className="mt-2 text-xs text-muted-foreground">Use the exact warehouse name saved in Delhivery.</p>
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Preferred pickup time</label>
                                  <input
                                    type="time"
                                    value={form.pickup_time.slice(0, 5)}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('pickup_time', `${event.target.value}:00`)}
                                    className="input-field"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Same-day order cutoff</label>
                                  <input
                                    type="time"
                                    value={form.pickup_cutoff_time.slice(0, 5)}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('pickup_cutoff_time', `${event.target.value}:00`)}
                                    className="input-field"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Packing lead time (days)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="14"
                                    value={form.pickup_buffer_days}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('pickup_buffer_days', Number(event.target.value))}
                                    className="input-field"
                                  />
                                  <p className="mt-2 text-xs text-muted-foreground">Use this if you usually need an extra day before dispatch.</p>
                                </div>

                                <label className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">Allow same-day pickup</p>
                                      <p className="mt-1 text-sm text-muted-foreground">If the order is ready before cutoff, request pickup on the same day.</p>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={form.allow_same_day_pickup}
                                      disabled={!canManage}
                                      onChange={(event) => updateField('allow_same_day_pickup', event.target.checked)}
                                      className="mt-1 h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                    />
                                  </div>
                                </label>

                                <div className="md:col-span-2">
                                  <p className="mb-2 text-sm font-medium text-foreground">Working pickup days</p>
                                  <div className="flex flex-wrap gap-2">
                                    {DAYS.map((day) => {
                                      const active = form.operating_days.includes(day);
                                      return (
                                        <button
                                          key={day}
                                          type="button"
                                          disabled={!canManage}
                                          onClick={() => toggleDay(day)}
                                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                            active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'
                                          } disabled:cursor-not-allowed disabled:opacity-60`}
                                        >
                                          {day}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                              <div className="mb-4">
                                <h3 className="text-base font-semibold text-foreground">Customer delivery quotes</h3>
                                <p className="mt-1 text-sm text-muted-foreground">These fees and ETA windows power the delivery options shown on the storefront and get saved on every order.</p>
                              </div>

                              <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Free shipping threshold</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.free_shipping_threshold}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('free_shipping_threshold', Number(event.target.value))}
                                    className="input-field"
                                  />
                                  <p className="mt-2 text-xs text-muted-foreground">Surface shipping becomes free once the order subtotal reaches this amount.</p>
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Normal delivery fee</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.surface_delivery_fee}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('surface_delivery_fee', Number(event.target.value))}
                                    className="input-field"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Express delivery fee</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.express_delivery_fee}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('express_delivery_fee', Number(event.target.value))}
                                    className="input-field"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Normal ETA start (days)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={form.surface_min_delivery_days}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('surface_min_delivery_days', Number(event.target.value))}
                                    className="input-field"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Normal ETA end (days)</label>
                                  <input
                                    type="number"
                                    min={form.surface_min_delivery_days}
                                    max="30"
                                    value={form.surface_max_delivery_days}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('surface_max_delivery_days', Number(event.target.value))}
                                    className="input-field"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Default storefront mode</label>
                                  <select
                                    value={form.shipping_mode}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('shipping_mode', event.target.value)}
                                    className="input-field"
                                  >
                                    <option value="Surface">Normal delivery</option>
                                    <option value="Express">Express delivery</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Express ETA start (days)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={form.express_min_delivery_days}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('express_min_delivery_days', Number(event.target.value))}
                                    className="input-field"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Express ETA end (days)</label>
                                  <input
                                    type="number"
                                    min={form.express_min_delivery_days}
                                    max="30"
                                    value={form.express_max_delivery_days}
                                    disabled={!canManage}
                                    onChange={(event) => updateField('express_max_delivery_days', Number(event.target.value))}
                                    className="input-field"
                                  />
                                </div>
                              </div>
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h3 className="text-base font-semibold text-foreground">Package defaults</h3>
                                  <p className="mt-1 text-sm text-muted-foreground">Fallback box settings used only when an order does not provide better package data.</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowPackageDefaults((prev) => !prev)}
                                  className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
                                >
                                  {showPackageDefaults ? 'Hide' : 'Show'}
                                </button>
                              </div>

                              {showPackageDefaults && (
                                <div className="mt-4 grid gap-4 md:grid-cols-4">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-foreground">Courier speed</label>
                                    <select
                                      value={form.shipping_mode}
                                      disabled={!canManage}
                                      onChange={(event) => updateField('shipping_mode', event.target.value)}
                                      className="input-field"
                                    >
                                      <option value="Surface">Surface</option>
                                      <option value="Express">Express</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-foreground">Length (cm)</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={form.default_package_length}
                                      disabled={!canManage}
                                      onChange={(event) => updateField('default_package_length', Number(event.target.value))}
                                      className="input-field"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-foreground">Width (cm)</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={form.default_package_width}
                                      disabled={!canManage}
                                      onChange={(event) => updateField('default_package_width', Number(event.target.value))}
                                      className="input-field"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-foreground">Height (cm)</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={form.default_package_height}
                                      disabled={!canManage}
                                      onChange={(event) => updateField('default_package_height', Number(event.target.value))}
                                      className="input-field"
                                    />
                                  </div>
                                </div>
                              )}
                            </section>
                          </div>

                          <div className="space-y-6">
                            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                              <h3 className="text-base font-semibold text-foreground">At a glance</h3>
                              <div className="mt-4 space-y-3 text-sm text-slate-700">
                                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <span className="text-muted-foreground">Pickup location</span>
                                  <span className="text-right font-medium">{form.pickup_location || 'Not set'}</span>
                                </div>
                                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <span className="text-muted-foreground">Working days</span>
                                  <span className="text-right font-medium">{formatOperatingDays(form.operating_days)}</span>
                                </div>
                                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <span className="text-muted-foreground">Same-day cutoff</span>
                                  <span className="text-right font-medium">{form.pickup_cutoff_time.slice(0, 5)}</span>
                                </div>
                                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <span className="text-muted-foreground">Package fallback</span>
                                  <span className="text-right font-medium">
                                    {form.shipping_mode}, {form.default_package_length}x{form.default_package_width}x{form.default_package_height} cm
                                  </span>
                                </div>
                                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <span className="text-muted-foreground">Storefront delivery</span>
                                  <span className="text-right font-medium">
                                    Normal {formatCurrency(form.surface_delivery_fee)} • Express {formatCurrency(form.express_delivery_fee)}
                                  </span>
                                </div>
                                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <span className="text-muted-foreground">Delivery ETA</span>
                                  <span className="text-right font-medium">
                                    Normal {form.surface_min_delivery_days}-{form.surface_max_delivery_days}d • Express {form.express_min_delivery_days}-{form.express_max_delivery_days}d
                                  </span>
                                </div>
                              </div>
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                              <h3 className="text-base font-semibold text-foreground">Recent pickup requests</h3>
                              <div className="mt-4 space-y-3">
                                {pickupRequests.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No pickup requests recorded yet.</p>
                                ) : (
                                  pickupRequests.slice(0, 4).map((request) => (
                                    <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="text-sm font-semibold text-foreground">{request.pickup_location}</p>
                                          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(request.pickup_date, request.pickup_time)}</p>
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                          {formatCourierStatusLabel(request.status)}
                                        </span>
                                      </div>
                                      <p className="mt-3 text-sm text-muted-foreground">Expected packages: {request.expected_package_count}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                              <h3 className="text-base font-semibold text-foreground">Latest shipments</h3>
                              <div className="mt-4 space-y-3">
                                {shipments.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No manifested shipments available yet.</p>
                                ) : (
                                  shipments.map((shipment) => (
                                    <div key={shipment.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="text-sm font-semibold text-foreground">AWB {shipment.awb_number}</p>
                                          <p className="mt-1 text-sm text-muted-foreground">
                                            {shipment.pickup_scheduled_date
                                              ? `Pickup: ${formatDateTime(shipment.pickup_scheduled_date, shipment.pickup_scheduled_time)}`
                                              : 'Waiting for pickup scheduling'}
                                          </p>
                                          {shipment.pickup_error && (
                                            <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                              {shipment.pickup_error}
                                            </p>
                                          )}
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                          {formatCourierStatusLabel(shipment.status)}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </section>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default OrderFulfillmentPanel;
