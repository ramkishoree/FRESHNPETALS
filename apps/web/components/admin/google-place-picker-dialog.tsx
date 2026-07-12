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
import { Input } from '@/components/ui/input';

/**
 * Search-and-link the outlet's real Google Business Profile (Places
 * Autocomplete restricted to `establishment`, not addresses — the owner
 * is picking a business listing, not a delivery point). On selection,
 * posts the place_id to the server, which fetches and stores the real
 * name/cover photo/reviews immediately.
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
  const inputRef = React.useRef<HTMLInputElement>(null);
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);

  React.useEffect(() => {
    if (!open || !inputRef.current || autocompleteRef.current) return;
    let cancelled = false;

    void (async () => {
      const maps = await loadGoogleMaps();
      if (cancelled || !inputRef.current) return;
      autocompleteRef.current = new maps.places.Autocomplete(inputRef.current, {
        types: ['establishment'],
        componentRestrictions: { country: 'IN' },
        fields: ['place_id', 'name', 'geometry'],
      });
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current!.getPlace();
        if (place.place_id && place.name) {
          const location = place.geometry?.location;
          setSelectedPlace({
            placeId: place.place_id,
            name: place.name,
            lat: location ? location.lat() : null,
            lng: location ? location.lng() : null,
          });
        }
      });
    })();

    return () => {
      cancelled = true;
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
          <Input ref={inputRef} placeholder="Search your business on Google Maps…" />
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
