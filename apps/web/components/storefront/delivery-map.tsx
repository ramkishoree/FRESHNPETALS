'use client';

import * as React from 'react';
import { loadGoogleMaps } from '@/lib/google-maps';

export interface MapLocation {
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface DeliveryMapProps {
  /** Called whenever the user selects or drags the pin to a new location. */
  onLocationChange: (location: MapLocation) => void;
  /** Center the map on these coords initially (default: Lucknow city centre). */
  defaultCenter?: { lat: number; lng: number };
}

/**
 * Ch.12 §26a Delivery Map — Google Maps with a draggable pin and Places
 * Autocomplete search box. The customer pins exactly where they want their
 * order delivered; the distance from the selected outlet to this pin
 * determines the delivery fee.
 */
export function DeliveryMap({ onLocationChange, defaultCenter }: DeliveryMapProps) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const markerRef = React.useRef<google.maps.Marker | null>(null);
  const mapInstanceRef = React.useRef<google.maps.Map | null>(null);
  const autocompleteElementRef = React.useRef<google.maps.places.PlaceAutocompleteElement | null>(
    null,
  );
  const geocoderRef = React.useRef<google.maps.Geocoder | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const maps = await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;

        geocoderRef.current = new maps.Geocoder();

        const center = defaultCenter ?? { lat: 26.8467, lng: 80.9462 }; // Lucknow

        const map = new maps.Map(mapRef.current, {
          center,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        });
        mapInstanceRef.current = map;

        // Draggable marker
        const marker = new maps.Marker({
          position: center,
          map,
          draggable: true,
          animation: maps.Animation.DROP,
          title: 'Drop your delivery location here',
        });
        markerRef.current = marker;

        // Reverse geocode on first placement & drag-end
        async function updateLocation(lat: number, lng: number) {
          if (!geocoderRef.current) return;
          try {
            const result = await geocoderRef.current.geocode({ location: { lat, lng } });
            const formattedAddress =
              result.results[0]?.formatted_address ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            if (!cancelled) {
              onLocationChange({ lat, lng, formattedAddress });
            }
          } catch {
            if (!cancelled) {
              onLocationChange({
                lat,
                lng,
                formattedAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              });
            }
          }
        }

        // Initial geocode
        await updateLocation(center.lat, center.lng);

        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          if (pos) {
            map.panTo(pos);
            void updateLocation(pos.lat(), pos.lng());
          }
        });

        // Places Autocomplete for the search box — the modern
        // PlaceAutocompleteElement, not the legacy Autocomplete class
        // (Google silently returns zero results from `Autocomplete` for
        // any API key created after March 1 2025; PlaceAutocompleteElement
        // is the only version that actually works for a new project).
        if (searchContainerRef.current) {
          const autocompleteElement = new maps.places.PlaceAutocompleteElement({
            includedRegionCodes: ['IN'],
          });
          autocompleteElement.placeholder = 'Search your delivery address…';
          // The element's Shadow DOM defaults to an intrinsic width
          // (~400px) regardless of its container — on a phone-width
          // screen that alone forces the whole checkout grid wider than
          // the viewport (a CSS grid item without min-width:0 expands to
          // fit its widest child), producing real horizontal page scroll.
          // Explicit inline width, not just a container class, since a
          // custom element's own default sizing otherwise wins.
          autocompleteElement.style.width = '100%';
          searchContainerRef.current.appendChild(autocompleteElement);
          autocompleteElementRef.current = autocompleteElement;

          autocompleteElement.addEventListener('gmp-select', async (event) => {
            const place = event.placePrediction.toPlace();
            await place.fetchFields({ fields: ['location', 'formattedAddress'] });
            if (!place.location) return;
            const loc = place.location;
            map.setCenter(loc);
            map.setZoom(15);
            marker.setPosition(loc);
            if (!cancelled) {
              onLocationChange({
                lat: loc.lat(),
                lng: loc.lng(),
                formattedAddress:
                  place.formattedAddress ?? `${loc.lat().toFixed(4)}, ${loc.lng().toFixed(4)}`,
              });
            }
          });
        }

        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err instanceof Error ? err.message : 'Failed to load map');
        }
      }
    })();

    return () => {
      cancelled = true;
      autocompleteElementRef.current?.remove();
      autocompleteElementRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      {/* Search box — PlaceAutocompleteElement renders its own input
          internally and takes ownership of this container's DOM subtree,
          same reasoning as the map container below: this div must never
          have React-rendered children. */}
      <div ref={searchContainerRef} className="w-full" />

      {/* Map container — `mapRef`'s own div must never have React-rendered
          children. Once Google Maps calls `new maps.Map(mapRef.current)` it
          takes direct ownership of that node's DOM subtree (wipes it and
          injects its own canvas/panes); if React later re-renders a child
          into the very same node (e.g. a loading/error message toggled by
          `status`), React's reconciler tries to remove a node Google's SDK
          already deleted — "Failed to execute 'removeChild': the node to be
          removed is not a child of this node," an uncaught exception that
          crashed the entire /checkout page in production. The loading/error
          UI is now a sibling overlay instead, positioned on top — `mapRef`
          stays a single empty leaf div for Maps to own exclusively. */}
      <div className="relative h-64 w-full overflow-hidden rounded-[var(--r-lg)] border border-[var(--sf-border)] sm:h-80">
        <div ref={mapRef} className="absolute inset-0" />
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--sf-surface)] text-sm text-[var(--sf-ink-muted)]">
            Loading map…
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--sf-surface)] p-4 text-center text-sm text-[var(--sale)]">
            <span>Map unavailable</span>
            {errorMsg && <span className="text-xs text-[var(--sf-ink-muted)]">{errorMsg}</span>}
          </div>
        )}
      </div>

      <p className="text-caption text-[var(--sf-ink-muted)]">
        Drag the pin to your exact delivery location. Distance from the selected outlet determines
        the delivery fee.
      </p>
    </div>
  );
}
