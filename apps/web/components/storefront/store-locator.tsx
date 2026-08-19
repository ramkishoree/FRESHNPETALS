'use client';

import * as React from 'react';

export interface LocatorLocation {
  title: string;
  address1: string;
  address2: string;
  coords: { lat: number; lng: number };
  placeId: string | null;
}

/**
 * Google's Locator Plus web component, driven from the `outlets` table.
 *
 * The owner asked for this specific component. Worth recording what it
 * does and does not do: it is not a ranking signal — Google does not
 * reward a site for embedding Google's own widgets — and because it
 * renders client-side, nothing inside it is reliably indexable. That is
 * why the server-rendered shop list above it stays: the list is what a
 * crawler reads, this is what a visitor drags around.
 *
 * The configuration is built from the same rows the rest of the site
 * uses rather than pasted as a literal, so an address corrected in the
 * admin cannot leave a second, stale copy sitting in the locator.
 */
export function StoreLocator({ locations }: { locations: LocatorLocation[] }) {
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function configure() {
      // The element is defined by a module script the page loads; on a
      // slow connection this resolves well after mount.
      await customElements.whenDefined('gmpx-store-locator');
      if (cancelled) return;

      const element = ref.current as
        | (HTMLElement & {
            configureFromQuickBuilder?: (config: unknown) => void;
          })
        | null;
      element?.configureFromQuickBuilder?.({
        locations: locations.map((location) => ({
          title: location.title,
          address1: location.address1,
          address2: location.address2,
          coords: location.coords,
          ...(location.placeId ? { placeId: location.placeId } : {}),
        })),
        mapOptions: {
          // Centred on Lucknow rather than the middle of the United
          // States, which is what the Quick Builder export shipped with.
          center: { lat: 26.8467, lng: 80.9462 },
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          zoom: 11,
          zoomControl: true,
          maxZoom: 17,
          mapId: '',
        },
        capabilities: {
          input: true,
          autocomplete: true,
          directions: false,
          distanceMatrix: true,
          details: false,
          actions: false,
        },
      });
    }

    void configure();
    return () => {
      cancelled = true;
    };
  }, [locations]);

  return React.createElement('gmpx-store-locator', {
    ref,
    'map-id': 'DEMO_MAP_ID',
    class: 'store-locator',
  });
}
