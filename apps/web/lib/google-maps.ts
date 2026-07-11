/**
 * Google Maps script loader singleton. Returns a promise that resolves
 * once the Maps JavaScript API (plus Places library) has finished loading.
 * Uses a class so the same promise is reused across all callers.
 *
 * Usage:
 *   const maps = await loadGoogleMaps();
 *   const map = new maps.Map(element, { ... });
 */

const API_KEY: string | undefined = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'];

let pendingPromise: Promise<any> | null = null;

export function loadGoogleMaps(): Promise<any> {
  if (pendingPromise) return pendingPromise;

  if (!API_KEY) {
    pendingPromise = Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set.'));
    return pendingPromise;
  }

  // Already loaded (e.g. by a previous route)
  const w = typeof window !== 'undefined' ? (window as any) : null;
  if (w?.google?.maps) {
    return Promise.resolve(w.google.maps);
  }

  pendingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const w2 = window as any;
      if (w2.google?.maps) {
        resolve(w2.google.maps);
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
