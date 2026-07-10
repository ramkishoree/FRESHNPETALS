import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupportConversationStatus } from '@prana/operations';

export interface SupportConversation {
  id: string;
  customerId: string | null;
  orderId: string | null;
  whatsappWaId: string;
  status: SupportConversationStatus;
  aiAttemptCount: number;
}

export interface OrderContext {
  orderId: string;
  customerId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  grandTotal: number;
  deliveryStatus: string | null;
  estimatedDelivery: string | null;
  trackingCode: string | null;
}

/**
 * Infrastructure implementation for the WhatsApp Support domain
 * (packages/operations owns the pure decision logic) — same split as
 * SupabaseProductRepository/ProductRepository. Uses the admin client
 * (service_role): the webhook has no Supabase Auth session to act as
 * (Meta calls it directly, not a logged-in customer), same reasoning as
 * the Razorpay webhook using `createSupabaseAdminClient()`.
 */
export class SupportRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findOpenConversationByWaId(waId: string): Promise<SupportConversation | null> {
    const { data, error } = await this.client
      .from('support_conversations')
      .select('id, customer_id, order_id, whatsapp_wa_id, status, ai_attempt_count')
      .eq('whatsapp_wa_id', waId)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? this.mapConversation(data) : null;
  }

  async createConversation(params: {
    waId: string;
    orderId?: string | null;
    customerId?: string | null;
  }): Promise<SupportConversation> {
    const { data, error } = await this.client
      .from('support_conversations')
      .insert({
        whatsapp_wa_id: params.waId,
        order_id: params.orderId ?? null,
        customer_id: params.customerId ?? null,
      })
      .select('id, customer_id, order_id, whatsapp_wa_id, status, ai_attempt_count')
      .single();

    if (error) throw new Error(error.message);
    return this.mapConversation(data);
  }

  async updateConversation(
    id: string,
    fields: Partial<{
      status: SupportConversationStatus;
      aiAttemptCount: number;
      lastCustomerMessageAt: string;
      escalatedAt: string;
      resolvedAt: string;
      closedAt: string;
    }>,
  ): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (fields.status !== undefined) patch['status'] = fields.status;
    if (fields.aiAttemptCount !== undefined) patch['ai_attempt_count'] = fields.aiAttemptCount;
    if (fields.lastCustomerMessageAt !== undefined) {
      patch['last_customer_message_at'] = fields.lastCustomerMessageAt;
    }
    if (fields.escalatedAt !== undefined) patch['escalated_at'] = fields.escalatedAt;
    if (fields.resolvedAt !== undefined) patch['resolved_at'] = fields.resolvedAt;
    if (fields.closedAt !== undefined) patch['closed_at'] = fields.closedAt;

    const { error } = await this.client.from('support_conversations').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async appendMessage(params: {
    conversationId: string;
    sender: 'customer' | 'bot' | 'owner';
    body: string;
    whatsappMessageId?: string | null;
  }): Promise<void> {
    const { error } = await this.client.from('support_messages').insert({
      conversation_id: params.conversationId,
      sender: params.sender,
      body: params.body,
      whatsapp_message_id: params.whatsappMessageId ?? null,
    });
    if (error) throw new Error(error.message);
  }

  async getRecentMessages(
    conversationId: string,
    limit = 10,
  ): Promise<Array<{ sender: string; body: string }>> {
    const { data, error } = await this.client
      .from('support_messages')
      .select('sender, body')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  /** Looks up an order by its customer-facing order number (e.g. from a deep-link's "Order #FP-00123" prefix). */
  async findOrderContextByOrderNumber(orderNumber: string): Promise<OrderContext | null> {
    const { data, error } = await this.client
      .from('orders')
      .select(
        'id, customer_id, order_number, status, payment_status, fulfillment_status, grand_total, deliveries(status, estimated_delivery, tracking_code)',
      )
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    return this.mapOrderContext(data);
  }

  async findOrderContextById(orderId: string): Promise<OrderContext | null> {
    const { data, error } = await this.client
      .from('orders')
      .select(
        'id, customer_id, order_number, status, payment_status, fulfillment_status, grand_total, deliveries(status, estimated_delivery, tracking_code)',
      )
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    return this.mapOrderContext(data);
  }

  private mapOrderContext(row: {
    id: string;
    customer_id: string;
    order_number: string;
    status: string;
    payment_status: string;
    fulfillment_status: string;
    grand_total: string | number;
    deliveries: unknown;
  }): OrderContext {
    const deliveryRaw = Array.isArray(row.deliveries)
      ? (row.deliveries[0] ?? null)
      : row.deliveries;
    const delivery = deliveryRaw as {
      status?: string;
      estimated_delivery?: string | null;
      tracking_code?: string | null;
    } | null;

    return {
      orderId: row.id,
      customerId: row.customer_id,
      orderNumber: row.order_number,
      status: row.status,
      paymentStatus: row.payment_status,
      fulfillmentStatus: row.fulfillment_status,
      grandTotal: Number(row.grand_total),
      deliveryStatus: delivery?.status ?? null,
      estimatedDelivery: delivery?.estimated_delivery ?? null,
      trackingCode: delivery?.tracking_code ?? null,
    };
  }

  private mapConversation(row: {
    id: string;
    customer_id: string | null;
    order_id: string | null;
    whatsapp_wa_id: string;
    status: SupportConversationStatus;
    ai_attempt_count: number;
  }): SupportConversation {
    return {
      id: row.id,
      customerId: row.customer_id,
      orderId: row.order_id,
      whatsappWaId: row.whatsapp_wa_id,
      status: row.status,
      aiAttemptCount: row.ai_attempt_count,
    };
  }
}
