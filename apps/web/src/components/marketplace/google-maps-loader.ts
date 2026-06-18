"use client";

declare global {
  interface Window {
    __googleMapsApiPromise?: Promise<void>;
  }
}

export type GoogleMapsWindow = Window & {
  google?: { maps?: any };
};

type GeocoderAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GeocoderResultLike = {
  formatted_address?: string;
  address_components?: GeocoderAddressComponent[];
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

function getAddressComponent(
  result: GeocoderResultLike,
  type: string,
): string | null {
  const component = result.address_components?.find((entry) =>
    entry.types?.includes(type),
  );

  return component?.long_name?.trim() || component?.short_name?.trim() || null;
}

export function formatCompactGeocodeLabel(
  result: GeocoderResultLike | null | undefined,
): string {
  if (!result) {
    return "";
  }

  const townLikeLabel =
    getAddressComponent(result, "locality") ||
    getAddressComponent(result, "postal_town") ||
    getAddressComponent(result, "administrative_area_level_2") ||
    getAddressComponent(result, "sublocality_level_1") ||
    getAddressComponent(result, "administrative_area_level_3") ||
    getAddressComponent(result, "administrative_area_level_1");
  const countryLabel = getAddressComponent(result, "country");

  if (townLikeLabel && countryLabel) {
    return `${townLikeLabel}, ${countryLabel}`;
  }

  if (townLikeLabel) {
    return townLikeLabel;
  }

  if (countryLabel) {
    return countryLabel;
  }

  return result.formatted_address?.trim() ?? "";
}
