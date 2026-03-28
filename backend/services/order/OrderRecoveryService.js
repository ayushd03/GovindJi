const { createBackendSupabaseClient } = require('../../config/supabaseClient');

class OrderRecoveryService {
  constructor() {
    this.supabase = createBackendSupabaseClient({ preferServiceRole: true });
  }

  normalizeOrderPaymentStatus(paymentStatus) {
    if (paymentStatus === 'EXPIRED') {
      return 'FAILED';
    }

    return paymentStatus;
  }

  isRecoverableOrder(order) {
    if (!order) {
      return false;
    }

    if (order.payment_status === 'PAID') {
      return false;
    }

    return !['completed', 'delivered'].includes(order.status);
  }

  canAcceptPayment(order) {
    if (!order) {
      return false;
    }

    if (order.payment_status === 'PAID') {
      return false;
    }

    return !['cancelled', 'completed', 'delivered'].includes(order.status);
  }

  async getOrderWithItems(orderId) {
    const { data, error } = await this.supabase
      .from('orders')
      .select('id, status, payment_status, order_items(product_id, variant_id, quantity)')
      .eq('id', orderId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async restoreStockForItems(items = []) {
    if (!items.length) {
      return [];
    }

    return Promise.all(
      items.map((item) => (
        this.supabase.rpc('restore_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
          p_variant_id: item.variant_id || null,
        })
      ))
    );
  }

  async cancelUnpaidOrder(orderId, {
    paymentStatus = 'FAILED',
    orderStatus = 'cancelled',
    additionalUpdates = {},
  } = {}) {
    const order = await this.getOrderWithItems(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (!this.isRecoverableOrder(order)) {
      return {
        order,
        stock_restored: false,
        skipped: true,
        reason: 'Order is already paid or finalized',
      };
    }

    const shouldRestoreStock = order.status !== 'cancelled';
    if (shouldRestoreStock) {
      await this.restoreStockForItems(order.order_items || []);
    }

    const updatePayload = {
      status: orderStatus,
      updated_at: new Date().toISOString(),
      ...additionalUpdates,
    };

    if (paymentStatus) {
      updatePayload.payment_status = this.normalizeOrderPaymentStatus(paymentStatus);
    }

    const { data, error } = await this.supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      order: data,
      stock_restored: shouldRestoreStock,
    };
  }
}

module.exports = new OrderRecoveryService();
