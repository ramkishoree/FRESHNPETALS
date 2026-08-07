'use client';

import * as React from 'react';
import { computeDeliveryFee, rankOutletsByDistance } from '@prana/commerce';
import type { MapLocation } from '@/components/storefront/delivery-map';

export interface OutletWithStock {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  googleBusinessName: string | null;
  googleRating: number | null;
  googleRatingCount: number | null;
  stock: Record<string, number>;
}

interface OutletSelectorProps {
  outlets: OutletWithStock[];
  /** Cart items keyed by productId so we can show what the customer needs. */
  cartItems: { productId: string; name: string; quantity: number }[];
  deliveryPin: MapLocation | null;
  selectedOutletId: string | null;
  onSelect: (outletId: string) => void;
}

/**
 * Ch.12 §26b Outlet Selector — the customer sees every outlet with its
 * stock for the items in their cart, sorted by distance from their
 * delivery pin. They pick which outlet fulfills the order; the delivery
 * fee updates accordingly. Like Blinkit's "Available from" section.
 */
export function OutletSelector({
  outlets,
  cartItems,
  deliveryPin,
  selectedOutletId,
  onSelect,
}: OutletSelectorProps) {
  // Rank outlets by distance to the delivery pin (if known), else show all.
  const ranked = React.useMemo(() => {
    if (deliveryPin) {
      return rankOutletsByDistance(
        outlets.map((o) => ({
          id: o.id,
          latitude: o.latitude,
          longitude: o.longitude,
          deliveryRadiusKm: o.deliveryRadiusKm,
          isActive: true,
        })),
        deliveryPin.lat,
        deliveryPin.lng,
      );
    }
    // No pin yet — show all in original order with distance = 0
    return outlets.map((o) => ({
      outlet: {
        id: o.id,
        latitude: o.latitude,
        longitude: o.longitude,
        deliveryRadiusKm: o.deliveryRadiusKm,
        isActive: true,
      },
      distanceKm: 0,
    }));
  }, [outlets, deliveryPin]);

  if (outlets.length === 0) {
    return (
      <p className="text-sm text-[var(--sf-ink-muted)]">
        No outlets are currently available for delivery.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-caption text-[var(--sf-ink-muted)]">
        {ranked.length} outlet{ranked.length !== 1 ? 's' : ''} near your delivery pin — select one
        to see the exact delivery fee.
      </p>

      {ranked.map((entry) => {
        const outlet = outlets.find((o) => o.id === entry.outlet.id)!;
        const isSelected = selectedOutletId === outlet.id;
        const deliveryFee = computeDeliveryFee(deliveryPin ? entry.distanceKm : null);
        const canFulfill = cartItems.every(
          (item) => (outlet.stock[item.productId] ?? 0) >= item.quantity,
        );

        return (
          <button
            key={outlet.id}
            type="button"
            onClick={() => onSelect(outlet.id)}
            className={`w-full rounded-[var(--r-lg)] border p-4 text-left transition-colors ${
              isSelected
                ? 'border-[var(--gold)] bg-[var(--gold)]/5'
                : 'border-[var(--sf-border)] bg-[var(--sf-surface)] hover:border-[var(--sf-border-strong)]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {outlet.googleBusinessName ?? outlet.name}
                  </span>
                  {!canFulfill && (
                    <span className="rounded-full bg-[var(--sale)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--sale)]">
                      Low stock
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[var(--sf-ink-muted)]">{outlet.address}</p>
                {outlet.googleRating != null && (
                  <p className="mt-0.5 text-xs font-medium text-[var(--gold-deep)]">
                    {outlet.googleRating}★ on Google
                    {outlet.googleRatingCount != null && ` (${outlet.googleRatingCount})`}
                  </p>
                )}

                {/* Stock breakdown per cart item */}
                {cartItems.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {cartItems.map((item) => {
                      const available = outlet.stock[item.productId] ?? 0;
                      const enough = available >= item.quantity;
                      return (
                        <div
                          key={item.productId}
                          className={`flex items-center gap-2 text-xs ${
                            enough ? 'text-[var(--sf-ink-muted)]' : 'text-[var(--sale)]'
                          }`}
                        >
                          <span className="truncate">{item.name}</span>
                          <span className="shrink-0">
                            × {item.quantity}
                            {enough ? ` — ${available} in stock` : ` — only ${available} available`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Distance + delivery fee */}
              <div className="shrink-0 text-right">
                {deliveryPin && (
                  <p className="text-xs text-[var(--sf-ink-muted)]">
                    {entry.distanceKm < 1 ? `<1 km` : `${entry.distanceKm.toFixed(1)} km`}
                  </p>
                )}
                <p className="mt-0.5 text-sm font-semibold">
                  {deliveryFee > 0 ? `₹${deliveryFee}` : 'Free'}
                </p>
              </div>
            </div>

            {isSelected && (
              <div className="mt-2 border-t border-[var(--sf-border)] pt-2 text-xs text-[var(--gold)]">
                ✓ Selected — delivery fee calculated from this outlet
              </div>
            )}
          </button>
        );
      })}

      {!deliveryPin && (
        <p className="text-xs text-[var(--sf-ink-muted)]">
          Pin your delivery location on the map above to see exact distances and rates.
        </p>
      )}
    </div>
  );
}
