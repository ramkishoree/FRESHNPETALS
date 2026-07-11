/**
 * Google Maps script loader singleton. Returns a promise that resolves
 * once the Maps JavaScript API (plus Places library) has finished loading.
 * Uses a class so the same promise is reused across all callers.
 *
 * Usage:
 *   const maps = await loadGoogleMaps();
 *   const map = new maps.Map(element, { ... });
 */

import { getPublicEnv } from '@/config/env';

let pendingPromise: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (pendingPromise) return pendingPromise;

  const API_KEY = getPublicEnv().NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!API_KEY) {
    pendingPromise = Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set.'));
    return pendingPromise;
  }

  // Already loaded (e.g. by a previous route)
  if (typeof window !== 'undefined' && window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  pendingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps loaded but google.maps is undefined.'));
      }
    };
    script.onerror = () => {
      pendingPromise = null;
      reject(new Error('Failed to load Google Maps script.'));
    };
    document.head.appendChild(script);
  });

  return pendingPromise;
}
