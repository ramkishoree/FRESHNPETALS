'use client';

import * as React from 'react';

export type LocationState = 'idle' | 'loading' | 'ok' | 'denied' | 'unavailable' | 'manual';

export interface LocationCoords {
  lat: number;
  lng: number;
}

const STORAGE_KEY = 'fnp-location';

/**
 * Ch.12 §19 Location Detection — GPS is prompted *once* when the user first
 * visits the site (not at checkout), so the delivery fee is always computed
 * from a known location and cannot be bypassed by denying the prompt at the
 * last minute.
 *
 * Returns the current `LocationCoords` and a `LocationState` that drives UI.
 * On `denied` / `unavailable` the caller should present a manual area
 * selector and then call `setManualLocation()` to set coordinates without
 * GPS.
 *
 * Coordinates are cached in `localStorage` so repeat visits do not re-prompt.
 */
export function useLocation() {
  const [coords, setCoords] = React.useState<LocationCoords | null>(null);
  const [state, setState] = React.useState<LocationState>('idle');
  const [manual, setManual] = React.useState<LocationCoords | null>(null);

  // Hydrate from localStorage on mount (avoids re-prompting).
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocationCoords;
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          setCoords(parsed);
          setState('ok');
          return;
        }
      }
    } catch {
      // Corrupted cache — ignore and request fresh.
    }
    requestGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cacheAndSet(c: LocationCoords) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } catch {
      // localStorage may be full or disabled — non-fatal.
    }
    setCoords(c);
    setState('ok');
  }

  function requestGps() {
    if (!navigator.geolocation) {
      setState('unavailable');
      return;
    }
    setState('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cacheAndSet({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }

  function retry() {
    setManual(null);
    setState('idle');
    requestGps();
  }

  function setManualLocation(coords: LocationCoords) {
    cacheAndSet(coords);
    setManual(coords);
    setState('manual');
  }

  return {
    coords,
    state,
    manual,
    retry,
    setManualLocation,
  };
}
