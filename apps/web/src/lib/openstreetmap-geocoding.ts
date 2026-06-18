"use client";

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  suburb?: string;
  neighbourhood?: string;
  country?: string;
};

type NominatimSearchResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
};

type NominatimReverseResult = {
  display_name?: string;
  address?: NominatimAddress;
};

export type FreeGeocodeResult = {
  latitude: number;
  longitude: number;
  label: string;
};

const reverseCache = new Map<string, string>();
const searchCache = new Map<string, FreeGeocodeResult | null>();

function buildCoordinateKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

function formatAddressLabel(
  address: NominatimAddress | undefined,
  fallback: string,
) {
  const townLike =
    address?.city ||
    address?.town ||
    address?.village ||
    address?.municipality ||
    address?.suburb ||
    address?.neighbourhood ||
    address?.county ||
    address?.state;
  const country = address?.country;

  if (townLike && country) {
    return `${townLike}, ${country}`;
  }

  return townLike || country || fallback;
}

function getPreferredLanguage() {
  if (typeof navigator === "undefined") {
    return "en";
  }

  return navigator.languages?.join(",") || navigator.language || "en";
}

export async function reverseGeocodeFree(
  latitude: number,
  longitude: number,
): Promise<string> {
  const cacheKey = buildCoordinateKey(latitude, longitude);
  const cached = reverseCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "jsonv2",
    addressdetails: "1",
    zoom: "14",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    {
      headers: {
        "Accept-Language": getPreferredLanguage(),
      },
    },
  );

  if (!response.ok) {
    throw new Error("Location details could not be loaded.");
  }

  const result = (await response.json()) as NominatimReverseResult;
  const label = formatAddressLabel(
    result.address,
    result.display_name?.trim() || "",
  );

  if (label) {
    reverseCache.set(cacheKey, label);
  }

  return label;
}

export async function searchAddressFree(
  query: string,
): Promise<FreeGeocodeResult | null> {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (searchCache.has(normalized)) {
    return searchCache.get(normalized) ?? null;
  }

  const params = new URLSearchParams({
    q: query.trim(),
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        "Accept-Language": getPreferredLanguage(),
      },
    },
  );

  if (!response.ok) {
    throw new Error("Address search is unavailable right now.");
  }

  const results = (await response.json()) as NominatimSearchResult[];
  const match = results[0];
  const latitude = Number(match?.lat);
  const longitude = Number(match?.lon);

  if (!match || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    searchCache.set(normalized, null);
    return null;
  }

  const resolved = {
    latitude,
    longitude,
    label: formatAddressLabel(
      match.address,
      match.display_name?.trim() || query.trim(),
    ),
  };

  searchCache.set(normalized, resolved);
  reverseCache.set(buildCoordinateKey(latitude, longitude), resolved.label);
  return resolved;
}
