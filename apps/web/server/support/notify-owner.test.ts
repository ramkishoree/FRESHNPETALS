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
    items: [{ name: 'Dozen Red Roses', quantity: 1, imageUrl: 'https://cdn/a/rose.jpg' }],
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

  it('sends one message per item, each carrying that item’s own photo', async () => {
    // A template header holds exactly one image, so the only way to show
    // every product is one message each — the owner's explicit call.
    await notifyOwnerOrderPlaced(
      makeParams({
        items: [
          { name: 'Dozen Red Roses', quantity: 2, imageUrl: 'https://cdn/a/rose.jpg' },
          { name: 'Lily Box', quantity: 1, imageUrl: 'https://cdn/a/lily.jpg' },
          { name: 'Orchid Vase', quantity: 1, imageUrl: 'https://cdn/a/orchid.jpg' },
        ],
      }),
    );

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(3);
    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0].headerImageUrl).toBe(
      'https://cdn/a/rose.jpg',
    );
    expect(sendWhatsAppTemplateMock.mock.calls[1]?.[0].headerImageUrl).toBe(
      'https://cdn/a/lily.jpg',
    );
    expect(sendWhatsAppTemplateMock.mock.calls[2]?.[0].headerImageUrl).toBe(
      'https://cdn/a/orchid.jpg',
    );
  });

  it('numbers each message so the owner knows how many are coming', async () => {
    await notifyOwnerOrderPlaced(
      makeParams({
        items: [
          { name: 'Dozen Red Roses', quantity: 2, imageUrl: null },
          { name: 'Lily Box', quantity: 1, imageUrl: null },
        ],
      }),
    );

    const [first, second] = sendWhatsAppTemplateMock.mock.calls.map(
      (call) => call[0].bodyParams[1],
    );
    expect(first).toContain('Dozen Red Roses ×2');
    expect(first).toContain('item 1 of 2');
    expect(first).toContain('3 units total');
    expect(second).toContain('item 2 of 2');
  });

  it('keeps the label plain for a single-item order', async () => {
    await notifyOwnerOrderPlaced(makeParams());

    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0].bodyParams[1]).toBe('Dozen Red Roses ×1');
  });

  it('one failing item does not silence the rest of the order', async () => {
    sendWhatsAppTemplateMock
      .mockRejectedValueOnce(new Error('(#132012) Template parameter format mismatch'))
      .mockRejectedValueOnce(new Error('retry without header also failed'))
      .mockResolvedValue({ messageId: 'wamid.2' });

    await notifyOwnerOrderPlaced(
      makeParams({
        items: [
          { name: 'Broken', quantity: 1, imageUrl: 'https://cdn/a/broken.jpg' },
          { name: 'Fine', quantity: 1, imageUrl: 'https://cdn/a/fine.jpg' },
        ],
      }),
    );

    // 2 attempts for the first item (with header, then without), then the
    // second item still gets its message.
    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(3);
    expect(sendWhatsAppTemplateMock.mock.calls[2]?.[0].bodyParams[1]).toContain('Fine');
  });

  it('points the header at the .jpg sibling when the photo is a webp', async () => {
    isSupportedHeaderImageUrlMock.mockImplementation((url: string) => url.endsWith('.jpg'));

    await notifyOwnerOrderPlaced(
      makeParams({
        items: [{ name: 'Rose', quantity: 1, imageUrl: 'https://cdn/media/products/a/rose.webp' }],
      }),
    );

    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0]).toMatchObject({
      headerImageUrl: 'https://cdn/media/products/a/rose.jpg',
    });
  });

  it('sends without a header rather than not at all when the format is unusable', async () => {
    isSupportedHeaderImageUrlMock.mockReturnValue(false);

    await notifyOwnerOrderPlaced(
      makeParams({ items: [{ name: 'Rose', quantity: 1, imageUrl: 'https://cdn/a/rose.tiff' }] }),
    );

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0]).not.toHaveProperty('headerImageUrl');
  });

  it('still alerts the owner when the order has no items on file', async () => {
    await notifyOwnerOrderPlaced(makeParams({ items: [] }));

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0].bodyParams[1]).toContain('No items on file');
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
