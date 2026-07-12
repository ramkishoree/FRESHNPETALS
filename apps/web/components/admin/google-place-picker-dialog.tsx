'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { loadGoogleMaps } from '@/lib/google-maps';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Search-and-link the outlet's real Google Business Profile.
 *
 * Uses the modern `PlaceAutocompleteElement`, not the legacy
 * `google.maps.places.Autocomplete` class — as of March 1st 2025, Google
 * silently returns zero predictions for `Autocomplete` on any API key
 * created after that date (no error, the dropdown just never appears),
 * which is exactly what happened here. `PlaceAutocompleteElement`
 * renders its own input internally rather than attaching to an existing
 * one, and — like the Google Map instance itself — takes direct
 * ownership of the DOM node it's mounted into. `containerRef`'s div must
 * therefore stay a permanently empty leaf that React never renders
 * children into (same removeChild lesson as delivery-map.tsx).
 */
export function GooglePlacePickerDialog({
  outletId,
  outletName,
  onLinked,
}: {
  outletId: string;
  outletName: string;
  onLinked: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [isLinking, setIsLinking] = React.useState(false);
  const [selectedPlace, setSelectedPlace] = React.useState<{
    placeId: string;
    name: string;
    lat: number | null;
    lng: number | null;
  } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const elementRef = React.useRef<google.maps.places.PlaceAutocompleteElement | null>(null);

  React.useEffect(() => {
    if (!open || !containerRef.current) return;
    let cancelled = false;

    void (async () => {
      const maps = await loadGoogleMaps();
      if (cancelled || !containerRef.current) return;

      const element = new maps.places.PlaceAutocompleteElement({
        includedRegionCodes: ['IN'],
        includedPrimaryTypes: ['establishment'],
      });
      element.placeholder = 'Search your business on Google Maps…';
      containerRef.current.appendChild(element);
      elementRef.current = element;

      element.addEventListener('gmp-select', async (event) => {
        const place = event.placePrediction.toPlace();
        await place.fetchFields({ fields: ['id', 'displayName', 'location'] });
        setSelectedPlace({
          placeId: place.id,
          name: place.displayName ?? place.id,
          lat: place.location?.lat() ?? null,
          lng: place.location?.lng() ?? null,
        });
      });
    })();

    return () => {
      cancelled = true;
      elementRef.current?.remove();
      elementRef.current = null;
    };
  }, [open]);

  async function link() {
    if (!selectedPlace) return;
    setIsLinking(true);
    try {
      const response = await fetch(`/api/v1/admin/outlets/${outletId}/link-google-place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: selectedPlace.placeId,
          ...(selectedPlace.lat != null && selectedPlace.lng != null
            ? { lat: selectedPlace.lat, lng: selectedPlace.lng }
            : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Failed to link.');
      toast.success(`Linked to "${body.data.name}" — ${body.data.reviews.length} reviews synced.`);
      setOpen(false);
      setSelectedPlace(null);
      onLinked();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to link.');
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Link Google Business
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link {outletName} to Google Business Profile</DialogTitle>
            <DialogDescription>
              Search for the real listing on Google Maps. This pulls the business name, cover photo,
              and up to 5 reviews (Google&apos;s own API limit).
            </DialogDescription>
          </DialogHeader>
          <div ref={containerRef} />
          {selectedPlace && (
            <p className="text-caption text-muted-foreground">Selected: {selectedPlace.name}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={link} disabled={!selectedPlace || isLinking}>
              {isLinking ? 'Linking...' : 'Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
