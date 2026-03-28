const { createBackendSupabaseClient } = require('../../config/supabaseClient');

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

class DeliverySettingsService {
  constructor() {
    this.supabase = createBackendSupabaseClient({ preferServiceRole: true });
  }

  getDefaults() {
    return {
      provider: 'DELHIVERY',
      is_enabled: true,
      auto_move_orders_to_processing: true,
      auto_create_shipment: true,
      auto_schedule_pickup: true,
      pickup_location: process.env.DELHIVERY_WAREHOUSE_NAME || 'Main Warehouse',
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
  }

  sanitizeSettings(input = {}) {
    const defaults = this.getDefaults();
    const operatingDays = Array.isArray(input.operating_days)
      ? [...new Set(input.operating_days.map((day) => String(day).toUpperCase()).filter((day) => DAYS.includes(day)))]
      : defaults.operating_days;
    const surfaceMinDeliveryDays = this.normalizeTransitDays(input.surface_min_delivery_days, defaults.surface_min_delivery_days);
    const surfaceMaxDeliveryDays = Math.max(
      surfaceMinDeliveryDays,
      this.normalizeTransitDays(input.surface_max_delivery_days, defaults.surface_max_delivery_days)
    );
    const expressMinDeliveryDays = this.normalizeTransitDays(input.express_min_delivery_days, defaults.express_min_delivery_days);
    const expressMaxDeliveryDays = Math.max(
      expressMinDeliveryDays,
      this.normalizeTransitDays(input.express_max_delivery_days, defaults.express_max_delivery_days)
    );

    return {
      provider: 'DELHIVERY',
      is_enabled: input.is_enabled ?? defaults.is_enabled,
      auto_move_orders_to_processing: input.auto_move_orders_to_processing ?? defaults.auto_move_orders_to_processing,
      auto_create_shipment: input.auto_create_shipment ?? defaults.auto_create_shipment,
      auto_schedule_pickup: input.auto_schedule_pickup ?? defaults.auto_schedule_pickup,
      pickup_location: String(input.pickup_location || defaults.pickup_location).trim(),
      pickup_time: this.normalizeTime(input.pickup_time || defaults.pickup_time),
      pickup_cutoff_time: this.normalizeTime(input.pickup_cutoff_time || defaults.pickup_cutoff_time),
      pickup_buffer_days: Math.max(0, Math.min(14, Number.parseInt(input.pickup_buffer_days ?? defaults.pickup_buffer_days, 10) || 0)),
      allow_same_day_pickup: input.allow_same_day_pickup ?? defaults.allow_same_day_pickup,
      operating_days: operatingDays.length > 0 ? operatingDays : defaults.operating_days,
      shipping_mode: ['Surface', 'Express'].includes(input.shipping_mode) ? input.shipping_mode : defaults.shipping_mode,
      free_shipping_threshold: this.normalizeCurrency(input.free_shipping_threshold, defaults.free_shipping_threshold),
      surface_delivery_fee: this.normalizeCurrency(input.surface_delivery_fee, defaults.surface_delivery_fee),
      express_delivery_fee: this.normalizeCurrency(input.express_delivery_fee, defaults.express_delivery_fee),
      surface_min_delivery_days: surfaceMinDeliveryDays,
      surface_max_delivery_days: surfaceMaxDeliveryDays,
      express_min_delivery_days: expressMinDeliveryDays,
      express_max_delivery_days: expressMaxDeliveryDays,
      default_package_length: this.normalizeDimension(input.default_package_length, defaults.default_package_length),
      default_package_width: this.normalizeDimension(input.default_package_width, defaults.default_package_width),
      default_package_height: this.normalizeDimension(input.default_package_height, defaults.default_package_height)
    };
  }

  normalizeCurrency(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : fallback;
  }

  normalizeDimension(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  normalizeTransitDays(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 30) : fallback;
  }

  normalizeTime(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

    if (!match) return '10:00:00';

    const hours = Math.max(0, Math.min(23, Number.parseInt(match[1], 10)));
    const minutes = Math.max(0, Math.min(59, Number.parseInt(match[2], 10)));
    const seconds = Math.max(0, Math.min(59, Number.parseInt(match[3] || '00', 10)));

    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  }

  async getSettings() {
    const defaults = this.getDefaults();

    const { data, error } = await this.supabase
      .from('delivery_settings')
      .select('*')
      .eq('provider', 'DELHIVERY')
      .maybeSingle();

    if (error) {
      console.warn('[DeliverySettingsService] Failed to load settings, using defaults:', error.message);
      return defaults;
    }

    return data ? this.sanitizeSettings(data) : defaults;
  }

  async saveSettings(input, updatedBy = null) {
    const settings = this.sanitizeSettings(input);

    const payload = {
      ...settings,
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('delivery_settings')
      .upsert(payload, { onConflict: 'provider' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.sanitizeSettings(data);
  }

  getIndianNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  }

  combineDateAndTime(date, timeString) {
    const [hours, minutes, seconds] = this.normalizeTime(timeString).split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, seconds, 0);
    return result;
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  calculateNextPickupSlot(settings, now = this.getIndianNow()) {
    const sanitized = this.sanitizeSettings(settings);
    const current = new Date(now);
    const preferredPickup = this.combineDateAndTime(current, sanitized.pickup_time);
    const cutoff = this.combineDateAndTime(current, sanitized.pickup_cutoff_time);

    let daysToAdd = sanitized.pickup_buffer_days;

    if (!sanitized.allow_same_day_pickup || current > cutoff || preferredPickup <= current) {
      daysToAdd += 1;
    }

    const slot = new Date(current);
    slot.setHours(0, 0, 0, 0);
    slot.setDate(slot.getDate() + daysToAdd);

    while (!sanitized.operating_days.includes(DAYS[slot.getDay()])) {
      slot.setDate(slot.getDate() + 1);
    }

    return {
      pickup_date: this.formatDate(slot),
      pickup_time: sanitized.pickup_time,
      pickup_location: sanitized.pickup_location,
      reasoning: {
        current_time_ist: current.toISOString(),
        cutoff_time: sanitized.pickup_cutoff_time,
        operating_days: sanitized.operating_days,
        pickup_buffer_days: sanitized.pickup_buffer_days,
        allow_same_day_pickup: sanitized.allow_same_day_pickup
      }
    };
  }
}

module.exports = new DeliverySettingsService();
