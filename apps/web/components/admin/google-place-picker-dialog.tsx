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
 * created after that date, which is what broke this the first time.
 * `PlaceAutocompleteElement` renders its own input internally rather
 * than attaching to an existing one, and takes direct ownership of the
 * DOM node it's mounted into.
 *
 * Mounts via a callback ref rather than a `useEffect` keyed on `open` —
 * a callback ref fires synchronously the instant React actually attaches
 * the DOM node, with no dependency on exactly when that happens relative
 * to Radix Dialog's own open/animation lifecycle. An effect keyed on
 * `[open]` can silently no-op forever if the container isn't mounted yet
 * on the one render where the effect happens to run, since it never gets
 * a second chance to retry.
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
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = React.useState<{
    placeId: string;
    name: string;
    lat: number | null;
    lng: number | null;
  } | null>(null);
  const elementRef = React.useRef<google.maps.places.PlaceAutocompleteElement | null>(null);

  const mountAutocomplete = React.useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      elementRef.current?.remove();
      elementRef.current = null;
      return;
    }

    void (async () => {
      try {
        const maps = await loadGoogleMaps();
        const element = new maps.places.PlaceAutocompleteElement({
          includedRegionCodes: ['IN'],
          includedPrimaryTypes: ['establishment'],
        });
        element.placeholder = 'Search your business on Google Maps…';
        node.appendChild(element);
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
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        console.error('google_place_picker.load_failed', message);
        setLoadError(message);
      }
    })();
  }, []);

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
          <div ref={mountAutocomplete} />
          {loadError && (
            <p className="text-caption text-destructive">
              Could not load Google Maps search: {loadError}
            </p>
          )}
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
