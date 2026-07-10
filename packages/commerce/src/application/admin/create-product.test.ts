import { isErr, isOk } from '@prana/core';
import { describe, expect, it } from 'vitest';
import { CreateProductService } from './create-product';
import { FakeAdminProductRepository, makeValidInput } from './product-test-fakes';

describe('CreateProductService', () => {
  it('creates a product when input satisfies Ch.8 §20', async () => {
    const service = new CreateProductService(new FakeAdminProductRepository());

    const result = await service.execute(makeValidInput(), 'actor-1');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.sku).toBe('SKU-1');
    }
  });

  it('rejects a name shorter than 3 characters', async () => {
    const service = new CreateProductService(new FakeAdminProductRepository());

    const result = await service.execute(makeValidInput({ name: 'Ro' }), 'actor-1');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects a description shorter than 100 characters', async () => {
    const service = new CreateProductService(new FakeAdminProductRepository());

    const result = await service.execute(makeValidInput({ description: 'too short' }), 'actor-1');

    expect(isErr(result)).toBe(true);
  });

  it('rejects a price of zero', async () => {
    const service = new CreateProductService(new FakeAdminProductRepository());

    const result = await service.execute(makeValidInput({ basePrice: 0 }), 'actor-1');

    expect(isErr(result)).toBe(true);
  });

  it('rejects an uppercase slug', async () => {
    const service = new CreateProductService(new FakeAdminProductRepository());

    const result = await service.execute(makeValidInput({ slug: 'Rose-Bouquet' }), 'actor-1');

    expect(isErr(result)).toBe(true);
  });

  it('rejects a sale price above the base price', async () => {
    const service = new CreateProductService(new FakeAdminProductRepository());

    const result = await service.execute(
      makeValidInput({ basePrice: 500, salePrice: 600 }),
      'actor-1',
    );

    expect(isErr(result)).toBe(true);
  });
});
