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
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const markerRef = React.useRef<google.maps.Marker | null>(null);
  const mapInstanceRef = React.useRef<google.maps.Map | null>(null);
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
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

        // Places Autocomplete for the search input
        if (searchRef.current) {
          autocompleteRef.current = new maps.places.Autocomplete(searchRef.current, {
            componentRestrictions: { country: 'IN' },
            fields: ['formatted_address', 'geometry'],
          });

          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current!.getPlace();
            if (!place.geometry?.location) return;
            const loc = place.geometry.location;
            map.setCenter(loc);
            map.setZoom(15);
            marker.setPosition(loc);
            void updateLocation(loc.lat(), loc.lng());
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      {/* Search box */}
      <input
        ref={searchRef}
        type="text"
        placeholder="Search your delivery address…"
        className="w-full rounded-[var(--r-md)] border border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--gold)]"
      />

      {/* Map container */}
      <div
        ref={mapRef}
        className="h-64 w-full overflow-hidden rounded-[var(--r-lg)] border border-[var(--sf-border)] sm:h-80"
      >
        {status === 'loading' && (
          <div className="flex h-full items-center justify-center text-sm text-[var(--sf-ink-muted)]">
            Loading map…
          </div>
        )}
        {status === 'error' && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-[var(--sale)]">
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
