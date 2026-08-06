// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyOwnerOrderPlaced } from './notify-owner';

const { isWhatsAppConfiguredMock, sendWhatsAppTemplateMock, isSupportedHeaderImageUrlMock } =
  vi.hoisted(() => ({
    isWhatsAppConfiguredMock: vi.fn(),
    sendWhatsAppTemplateMock: vi.fn(),
    isSupportedHeaderImageUrlMock: vi.fn(),
  }));

vi.mock('@/server/whatsapp/meta-client', () => ({
  isWhatsAppConfigured: isWhatsAppConfiguredMock,
  sendWhatsAppTemplate: sendWhatsAppTemplateMock,
  isSupportedHeaderImageUrl: isSupportedHeaderImageUrlMock,
}));

vi.mock('@/config/env', () => ({
  getServerEnv: () => ({ META_WHATSAPP_OWNER_WA_ID: '911234567890' }),
}));

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    orderNumber: 'FNP-2026-000001',
    grandTotal: 999,
    currency: 'INR',
    items: [{ name: 'Dozen Red Roses', quantity: 1, color: 'Red' }],
    headerImageUrl: 'https://cdn/a/collage.jpg',
    customerName: 'Anaya Sharma',
    customerPhone: '+911234567890',
    deliveryAddress: '4/122 Vipul Khand, Gomti Nagar, Lucknow',
    paymentMethod: 'Cash on delivery',
    deliveryDate: '20 July 2026',
    deliveryTime: '9 AM - 11 AM',
    ...overrides,
  };
}

describe('notifyOwnerOrderPlaced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isWhatsAppConfiguredMock.mockReturnValue(true);
    sendWhatsAppTemplateMock.mockResolvedValue({ messageId: 'wamid.1' });
    isSupportedHeaderImageUrlMock.mockReturnValue(true);
  });

  it('sends exactly one message for the whole order, whatever the item count', async () => {
    // One message per item was tried and rejected: it bills per item and
    // buzzes the phone once per product. The collage carries the photos
    // instead, so the order stays a single alert.
    await notifyOwnerOrderPlaced(
      makeParams({
        items: [
          { name: 'Dozen Red Roses', quantity: 2, color: 'Red' },
          { name: 'Lily Box', quantity: 1, color: 'White' },
          { name: 'Orchid Vase', quantity: 6, color: 'Purple' },
        ],
      }),
    );

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0].headerImageUrl).toBe(
      'https://cdn/a/collage.jpg',
    );
  });

  it('names every item with its colour and unit count', async () => {
    // Titles alone are ambiguous between similar arrangements — the
    // colour is what identifies the flower while packing.
    await notifyOwnerOrderPlaced(
      makeParams({
        items: [
          { name: 'Dozen Red Roses', quantity: 2, color: 'Red' },
          { name: 'Lily Box', quantity: 1, color: 'White' },
          { name: 'Orchid Vase', quantity: 6, color: 'Purple' },
        ],
      }),
    );

    // Formatting itself is covered by order-item-label.test.ts; what
    // matters here is that every item reaches the parameter with its
    // colour and count intact.
    const summary = sendWhatsAppTemplateMock.mock.calls[0]?.[0].bodyParams[1];
    expect(summary).toContain('Dozen Red Roses — Red ×2');
    expect(summary).toContain('Lily Box — White ×1');
    expect(summary).toContain('Orchid Vase — Purple ×6');
    expect(summary).toContain('3 products, 9 units');
  });

  it('never puts a newline in a template parameter', async () => {
    // Meta rejects parameters containing newline or tab characters, so
    // the item list must be joined inline or the send fails outright.
    await notifyOwnerOrderPlaced(
      makeParams({
        items: [
          { name: 'A', quantity: 1, color: 'Red' },
          { name: 'B', quantity: 1, color: 'White' },
        ],
      }),
    );

    for (const param of sendWhatsAppTemplateMock.mock.calls[0]?.[0].bodyParams ?? []) {
      expect(param).not.toMatch(/[\n\t]/);
    }
  });

  it('omits the brackets for a product with no colour recorded', async () => {
    await notifyOwnerOrderPlaced(
      makeParams({ items: [{ name: 'Mystery Bunch', quantity: 3, color: null }] }),
    );

    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0].bodyParams[1]).toContain('Mystery Bunch ×3');
    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0].bodyParams[1]).not.toContain('()');
  });

  it('carries the total, payment method, slot and address', async () => {
    await notifyOwnerOrderPlaced(makeParams());

    const body = sendWhatsAppTemplateMock.mock.calls[0]?.[0].bodyParams;
    expect(body[2]).toBe('INR 999.00');
    expect(body[5]).toBe('4/122 Vipul Khand, Gomti Nagar, Lucknow');
    expect(body[6]).toBe('Cash on delivery');
    expect(body[7]).toBe('20 July 2026');
    expect(body[8]).toBe('9 AM - 11 AM');
  });

  it('sends without a header rather than not at all when the collage is unusable', async () => {
    isSupportedHeaderImageUrlMock.mockReturnValue(false);

    await notifyOwnerOrderPlaced(makeParams());

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0]).not.toHaveProperty('headerImageUrl');
  });

  it('still alerts the owner when the order has no items on file', async () => {
    await notifyOwnerOrderPlaced(makeParams({ items: [] }));

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0].bodyParams[1]).toBe('No items on file');
  });

  it('never throws when a send fails outright', async () => {
    sendWhatsAppTemplateMock.mockRejectedValue(new Error('boom'));

    await expect(notifyOwnerOrderPlaced(makeParams())).resolves.toBeUndefined();
  });

  it('skips entirely when WhatsApp is not configured', async () => {
    isWhatsAppConfiguredMock.mockReturnValue(false);

    await notifyOwnerOrderPlaced(makeParams());

    expect(sendWhatsAppTemplateMock).not.toHaveBeenCalled();
  });
});
