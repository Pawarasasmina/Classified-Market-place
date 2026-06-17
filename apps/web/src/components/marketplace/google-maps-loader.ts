"use client";

declare global {
  interface Window {
    __googleMapsApiPromise?: Promise<void>;
  }
}

export type GoogleMapsWindow = Window & {
  google?: { maps?: any };
};

export const googleMapsApiKey =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export const defaultMapCenter = { lat: 25.2048, lng: 55.2708 };

export function loadGoogleMapsScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps only loads in the browser."));
  }

  const googleWindow = window as GoogleMapsWindow;

  if (!googleMapsApiKey) {
    return Promise.reject(
      new Error("Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the map picker."),
    );
  }

  if (googleWindow.google?.maps) {
    return Promise.resolve();
  }

  if (googleWindow.__googleMapsApiPromise) {
    return googleWindow.__googleMapsApiPromise;
  }

  googleWindow.__googleMapsApiPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps-loader="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google Maps could not be loaded.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      googleMapsApiKey,
    )}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Google Maps could not be loaded."));
    document.head.appendChild(script);
  });

  return googleWindow.__googleMapsApiPromise;
}
