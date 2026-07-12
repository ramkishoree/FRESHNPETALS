import { isErr, isOk } from '@prana/core';
import { describe, expect, it } from 'vitest';
import type {
  AdminInventoryAdjustment,
  InventoryRecord,
  InventoryRepository,
} from '../../domain/inventory';
import { AdjustInventoryService } from './adjust-inventory';

function makeRecord(overrides: Partial<InventoryRecord> = {}): InventoryRecord {
  return {
    id: 'inv-1',
    productId: 'prod-1',
    outletId: 'outlet-1',
    physicalQuantity: 10,
    reservedQuantity: 2,
    availableQuantity: 8,
    lowStockThreshold: 5,
    criticalThreshold: 1,
    reorderQuantity: 20,
    ...overrides,
  };
}

class FakeInventoryRepository implements InventoryRepository {
  constructor(private record: InventoryRecord | null) {}

  findById(id: string): Promise<InventoryRecord | null> {
    return Promise.resolve(this.record && this.record.id === id ? this.record : null);
  }

  findMany(): Promise<{ items: InventoryRecord[]; nextCursor: string | null }> {
    return Promise.resolve({ items: this.record ? [this.record] : [], nextCursor: null });
  }

  findByProductAndOutlet(): Promise<InventoryRecord | null> {
    return Promise.resolve(this.record);
  }

  adjust(id: string, adjustment: AdminInventoryAdjustment): Promise<InventoryRecord> {
    if (!this.record) throw new Error('not found');
    this.record = {
      ...this.record,
      physicalQuantity: this.record.physicalQuantity + adjustment.quantityDelta,
    };
    return Promise.resolve(this.record);
  }

  setStock(productId: string, outletId: string, quantity: number): Promise<InventoryRecord> {
    this.record = {
      ...(this.record ?? makeRecord({ productId, outletId })),
      productId,
      outletId,
      physicalQuantity: quantity,
    };
    return Promise.resolve(this.record);
  }
}

describe('AdjustInventoryService', () => {
  it('adds stock', async () => {
    const service = new AdjustInventoryService(new FakeInventoryRepository(makeRecord()));

    const result = await service.execute(
      'inv-1',
      { transactionType: 'stock_added', quantityDelta: 5 },
      'actor-1',
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.physicalQuantity).toBe(15);
  });

  it('rejects a negative delta for stock_added', async () => {
    const service = new AdjustInventoryService(new FakeInventoryRepository(makeRecord()));

    const result = await service.execute(
      'inv-1',
      { transactionType: 'stock_added', quantityDelta: -3 },
      'actor-1',
    );

    expect(isErr(result)).toBe(true);
  });

  it('requires a reason when recording damage', async () => {
    const service = new AdjustInventoryService(new FakeInventoryRepository(makeRecord()));

    const result = await service.execute(
      'inv-1',
      { transactionType: 'damage', quantityDelta: -2 },
      'actor-1',
    );

    expect(isErr(result)).toBe(true);
  });

  it('rejects an adjustment that would take stock below zero', async () => {
    const service = new AdjustInventoryService(
      new FakeInventoryRepository(makeRecord({ physicalQuantity: 3 })),
    );

    const result = await service.execute(
      'inv-1',
      { transactionType: 'damage', quantityDelta: -5, reason: 'Water damage' },
      'actor-1',
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toMatch(/below zero/);
    }
  });

  it('returns a 404-shaped error for a missing inventory record', async () => {
    const service = new AdjustInventoryService(new FakeInventoryRepository(null));

    const result = await service.execute(
      'missing',
      { transactionType: 'correction', quantityDelta: 1 },
      'actor-1',
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.httpStatus).toBe(404);
  });
});
