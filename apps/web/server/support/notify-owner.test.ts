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
    itemsSummary: 'Dozen Red Roses ×1',
    customerName: 'Anaya Sharma',
    customerPhone: '+911234567890',
    deliveryAddress: '4/122 Vipul Khand, Gomti Nagar, Lucknow',
    paymentMethod: 'Cash on delivery',
    deliveryDate: '20 July 2026',
    deliveryTime: '9 AM - 11 AM',
    firstItemImageUrl: null as string | null,
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

  it('attaches the header image when Meta supports its format', async () => {
    await notifyOwnerOrderPlaced(makeParams({ firstItemImageUrl: 'https://cdn/rose.jpg' }));

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0]).toMatchObject({
      headerImageUrl: 'https://cdn/rose.jpg',
      templateName: 'order_placed_alert_v3',
      to: '911234567890',
    });
  });

  it('sends without a header rather than at all when the image format is unsupported', async () => {
    isSupportedHeaderImageUrlMock.mockReturnValue(false);

    await notifyOwnerOrderPlaced(makeParams({ firstItemImageUrl: 'https://cdn/rose.webp' }));

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppTemplateMock.mock.calls[0]?.[0]).not.toHaveProperty('headerImageUrl');
  });

  it('retries without the header when a send carrying one fails', async () => {
    sendWhatsAppTemplateMock
      .mockRejectedValueOnce(new Error('(#131053) Media upload error'))
      .mockResolvedValueOnce({ messageId: 'wamid.2' });

    await notifyOwnerOrderPlaced(makeParams({ firstItemImageUrl: 'https://cdn/rose.jpg' }));

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(2);
    expect(sendWhatsAppTemplateMock.mock.calls[1]?.[0]).not.toHaveProperty('headerImageUrl');
  });

  it('does not retry a header-less send that failed on its own', async () => {
    sendWhatsAppTemplateMock.mockRejectedValue(new Error('Template name does not exist'));

    await notifyOwnerOrderPlaced(makeParams());

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
  });

  it('never throws when the send fails outright', async () => {
    sendWhatsAppTemplateMock.mockRejectedValue(new Error('boom'));

    await expect(notifyOwnerOrderPlaced(makeParams())).resolves.toBeUndefined();
  });

  it('skips entirely when WhatsApp is not configured', async () => {
    isWhatsAppConfiguredMock.mockReturnValue(false);

    await notifyOwnerOrderPlaced(makeParams());

    expect(sendWhatsAppTemplateMock).not.toHaveBeenCalled();
  });
});
