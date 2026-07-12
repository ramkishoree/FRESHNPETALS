import { isErr, isOk } from '@prana/core';
import { describe, expect, it } from 'vitest';
import type { InventoryRecord, InventoryRepository } from '../../domain/inventory';
import { SetOutletStockService } from './set-outlet-stock';

function makeRecord(overrides: Partial<InventoryRecord> = {}): InventoryRecord {
  return {
    id: 'inv-1',
    productId: 'prod-1',
    outletId: 'outlet-1',
    physicalQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    lowStockThreshold: 5,
    criticalThreshold: 1,
    reorderQuantity: 20,
    ...overrides,
  };
}

class FakeInventoryRepository implements Pick<InventoryRepository, 'setStock'> {
  public lastCall: { productId: string; outletId: string; quantity: number } | null = null;

  setStock(productId: string, outletId: string, quantity: number): Promise<InventoryRecord> {
    this.lastCall = { productId, outletId, quantity };
    return Promise.resolve(makeRecord({ productId, outletId, physicalQuantity: quantity }));
  }
}

describe('SetOutletStockService', () => {
  it('sets stock for a product/outlet pair that has never had a row before', async () => {
    const repo = new FakeInventoryRepository();
    const service = new SetOutletStockService(repo as unknown as InventoryRepository);

    const result = await service.execute('prod-1', 'outlet-1', 25, 'actor-1');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.physicalQuantity).toBe(25);
    expect(repo.lastCall).toEqual({ productId: 'prod-1', outletId: 'outlet-1', quantity: 25 });
  });

  it('rejects a negative quantity', async () => {
    const repo = new FakeInventoryRepository();
    const service = new SetOutletStockService(repo as unknown as InventoryRepository);

    const result = await service.execute('prod-1', 'outlet-1', -5, 'actor-1');

    expect(isErr(result)).toBe(true);
    expect(repo.lastCall).toBeNull();
  });

  it('rejects a non-integer quantity', async () => {
    const repo = new FakeInventoryRepository();
    const service = new SetOutletStockService(repo as unknown as InventoryRepository);

    const result = await service.execute('prod-1', 'outlet-1', 3.5, 'actor-1');

    expect(isErr(result)).toBe(true);
    expect(repo.lastCall).toBeNull();
  });
});
